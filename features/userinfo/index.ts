import QuickLRU from "quick-lru";

import {banReasonsOf, initDatabase, ipInfoOf, passesIpFilter, subscribeDatabase} from "@/core/database";
import {defineModule} from "@/core/module/define";
import {type GallogActivity, getGallogActivity} from "@/core/gallog";
import {ROWS_HIDDEN_EVENT} from "@/core/block";
import {queryString} from "@/core/http/urls";
import {ROW_SELECTOR} from "@/core/list";
import {batchedSave} from "@/core/storage/batched";
import {moduleDataKey, moduleDataStorage} from "@/core/storage/items";
import {watchStorage} from "@/core/storage/sync";
import {findMemo, useMemosStore} from "@/stores/memos";
import {type BadgeView, DEFAULT_BADGE_VIEW, isFresh, isLowActivity, openWriterBubble, showsUid, useUiStore} from "@/stores/ui";
import {objectFromEntries, objectKeys} from "@/utils/typed";

import meta, {BADGE_COLORS, type BadgeColor, type Ctx} from "./meta";

interface RatioInfo {
    article: number;
    comment: number;
    date: number;
}

/** 저장소의 글댓비 캐시 (moduleDataStorage). */
type RatioData = { ratio?: Record<string, RatioInfo> };

type BadgeColors = Partial<Record<BadgeColor, string>>;

const colorsOf = (ctx: Ctx): BadgeColors =>
    objectFromEntries(objectKeys(BADGE_COLORS).map((key) => [key, ctx.settings[`${key}Color`]] as const));

const badgeViewOf = (ctx: Ctx): BadgeView => ({
    order: ctx.settings.badgeOrder,
    fixedUid: ctx.settings.showFixedNickUID,
    halfFixedUid: ctx.settings.showHalfFixedNickUID,
    ipFilter: ctx.settings.ipInfoFilter
});

/** 설정에서 만든 배지 색·표시 조건. 작성자 칸마다(목록 새로고침마다 수십 개) 다시 만들지 않고 설정이 바뀔 때(publishBadges) 한 번 만든다. */
let colors: BadgeColors = {};
let view: BadgeView = DEFAULT_BADGE_VIEW;
/** 이 문서의 갤러리 id. 미리보기가 pushState로 주소를 바꿔도 같은 갤러리다. */
let gallery: string | null = null;

let ratios: Record<string, RatioInfo> = {};

/** 배지를 붙이는 작성자 칸. user_name이 붙은 칸은 디시가 이미 처리한 자리라 건너뛴다. */
const WRITER_SELECTOR = ".ub-writer:not([user_name])";
/** 작성자 칸 하나에 붙이는 배지 묶음. core/filtering이 이 클래스의 노드는 훑지 않는다. */
const BADGES_CLASS = "refresher-user-badges";

/** 글댓비 저장 상한. 최근에 받은 사람부터 이만큼만 남긴다. */
const MAX_RATIOS = 500;

/**
 * 받은 글댓비를 모아 두었다가 저장하는 간격 (ms). 저장할 때마다 캐시 전체가 열린 디시 탭마다 전달되고 크롬 서비스 워커도 깨므로,
 * 자동 새로고침마다 쓰지 않는다. 이 탭은 받은 즉시 그리고, 탭을 숨기거나 떠날 때도 저장한다.
 */
const RATIO_SAVE_DELAY = 30_000;

const trimRatios = (all: Record<string, RatioInfo>): Record<string, RatioInfo> =>
    Object.fromEntries(Object.entries(all).sort(([, a], [, b]) => b.date - a.date).slice(0, MAX_RATIOS));

/** 글댓비를 받지 못한 유저 (임시 차단 포함). 디시가 막거나 실패하는 동안 새 목록마다 다시 묻지 않게 5분 동안 건너뛴다. */
const failedRatios = new QuickLRU<string, true>({maxSize: 500, maxAge: 5 * 60_000});

const buildBadgeSpan = (text: string, color?: string, title?: string, className = "refresherUserData"): HTMLElement => {
    const span = Object.assign(document.createElement("span"), {className, textContent: text});
    if (color) span.style.color = color;
    if (title) span.title = title;
    return span;
};

/** 작성자 영역의 닉콘/IP 바로 뒤에 배지 묶음을 넣는다. */
const insertBadges = (element: HTMLElement, badges: HTMLElement): void => {
    const container = element.querySelector<HTMLElement>(".addbox") ?? element.querySelector<HTMLElement>(".fl > span") ?? element;
    const anchor = container.querySelector<HTMLElement>(".writer_nikcon, .ip");

    if (anchor) anchor.after(badges);
    else container.append(badges);
};

const LOW_ACTIVITY_CLASSES = {blur: "refresherLowActivityBlur", hide: "refresherLowActivityHide"} as const;
const LOW_ACTIVITY_CLASS_LIST = Object.values(LOW_ACTIVITY_CLASSES);
const LOW_ACTIVITY_SELECTOR = LOW_ACTIVITY_CLASS_LIST.map((name) => `.${name}`).join(",");

/**
 * 깡계 숨김·흐림을 바꿨다고 알린다. 차단 모듈이 같은 댓글을 다시 접는다 (가린 댓글은 세지 않는다).
 * 차단 모듈의 접기는 이 모듈이 DB를 읽기 전에 먼저 돈다. 작성자마다 부르므로 한 번에 모아 보낸다.
 */
let notifyQueued = false;
const notifyRowsHidden = (): void => {
    if (notifyQueued) return;
    notifyQueued = true;
    queueMicrotask(() => {
        notifyQueued = false;
        document.dispatchEvent(new Event(ROWS_HIDDEN_EVENT));
    });
};

/** 깡계 흐림·숨김을 모두 뗀다. 뗀 것이 있었는지 돌려준다. */
const clearLowActivity = (): boolean => {
    const marked = document.querySelectorAll(LOW_ACTIVITY_SELECTOR);
    for (const element of marked) element.classList.remove(...LOW_ACTIVITY_CLASS_LIST);
    return marked.length > 0;
};

const process = (ctx: Ctx, element: HTMLElement): void => {
    // 완료 표시 없이 매번 다시 그린다. 파싱 중인 작성자 칸(닉콘·IP 전)에서 먼저 불려도, 칸이 다 읽혀 다시 불릴 때 배지가 제자리를 찾는다.
    element.querySelector(`.${BADGES_CLASS}`)?.remove();

    const {nick, uid, ip} = element.dataset;
    // 묶음 요소는 붙일 배지가 있을 때만 만든다. 배지가 없는 작성자 칸이 대부분이다.
    const badges: HTMLElement[] = [];
    let lowActivity = false;

    const appendIdentity = (): void => {
        if (uid) {
            if (showsUid(view, element.querySelector<HTMLImageElement>("img")?.src)) badges.push(buildBadgeSpan(`(${uid})`, colors.uid, uid, "ip refresherUserData"));
            return;
        }

        const info = ip ? ipInfoOf(ip) : undefined;
        if (info && passesIpFilter(info, view.ipFilter)) badges.push(buildBadgeSpan(`[${info.label}]`, colors[info.category], info.title));
    };

    for (const key of view.order) {
        if (key === "UID") appendIdentity();

        if (key === "MEMO") {
            const memo = findMemo({uid, ip, nick}, gallery);
            if (memo) badges.push(buildBadgeSpan(`[${memo.text}]`, memo.color || undefined, memo.text));
        }

        if (key === "RATIO" && uid && ctx.settings.checkRatio) {
            const cached = Object.hasOwn(ratios, uid) ? ratios[uid] : undefined;
            if (cached) {
                const text = `${cached.article}/${cached.comment}`;
                lowActivity = isLowActivity(cached, ctx.settings.alarmRatio);
                badges.push(buildBadgeSpan(`[${text}]`, lowActivity ? colors.ratioAlarm : colors.ratio, text, "ip refresherUserData"));
            }
        }

        if (key === "PERMBAN" && uid && ctx.settings.checkPermBan) {
            const reasons = banReasonsOf(uid);
            if (reasons) badges.push(buildBadgeSpan(`[${reasons}]`, colors.permBan, reasons, "ip refresherUserData"));
        }
    }

    // 깡계는 글댓비를 받아 둔 유저만 판정한다. 목록 전체를 조회하면 갤로그 요청이 너무 많다.
    const action = ctx.settings.lowActivityAction;
    if (lowActivity && action === "tag") badges.push(buildBadgeSpan("[깡계]", colors.ratioAlarm, `글댓합 ${ctx.settings.alarmRatio}개 이하`));
    // 글 보기 머리는 가리지 않는다. 머리만 가리면 본문은 그대로 보인다 (배지 색으로만 알린다).
    if (lowActivity && (action === "blur" || action === "hide") && !element.closest(".gallview_head")) {
        (element.closest<HTMLElement>(ROW_SELECTOR) ?? element).classList.add(LOW_ACTIVITY_CLASSES[action]);
        notifyRowsHidden();
    }

    if (badges.length > 0) {
        const group = Object.assign(document.createElement("span"), {className: BADGES_CLASS});
        group.append(...badges);
        insertBadges(element, group);
    }
};

/** 미리보기 작성자 표시가 같은 색·순서·표시 조건을 쓰도록 ui 스토어에 올린다. */
const publishBadges = (ctx: Ctx): void => {
    colors = colorsOf(ctx);
    view = badgeViewOf(ctx);
    gallery = queryString("id");
    useUiStore.setState({
        badgeColors: {
            ...colors,
            // 갱차 조회를 끄면 미리보기에서도 숨긴다.
            permBan: ctx.settings.checkPermBan ? colors.permBan : undefined
        },
        badgeView: view
    });
};

/** 미리보기도 같은 글댓비를 쓰도록 ui 스토어에 올린다. 지난 값은 미리보기·버블이 읽을 때 isFresh로 걸러 새로 조회한다. */
const publishRatios = (ctx: Ctx): void => {
    useUiStore.setState({ratios: ctx.settings.checkRatio ? {cache: ratios, alarm: ctx.settings.alarmRatio} : null});
};

// 숨김이 다시 붙으면 process가 알린다. 여기서는 뗀 것이 있을 때만 알려 차단 모듈이 같은 댓글 접기를 괜히 다시 하지 않게 한다.
const rebuildAll = (ctx: Ctx): void => {
    const cleared = clearLowActivity();
    // 배지가 없던 작성자도 돈다. 설정을 켜서 새로 생기는 배지가 있다 (필터 선택자와 같은 대상).
    for (const element of document.querySelectorAll<HTMLElement>(WRITER_SELECTOR)) process(ctx, element);
    if (cleared) notifyRowsHidden();
};

/** 몇몇 유저의 작성자 칸만 다시 그린다. 깡계 흐림·숨김은 process가 더하기만 하므로 먼저 뗀다. */
const rebuildUsers = (ctx: Ctx, uids: string[]): void => {
    // 작성자 칸을 한 번만 훑는다. 다른 탭이 글댓비를 쓸 때마다(새 글마다 최대 10명) 유저 수만큼 문서를 다시 찾지 않는다.
    const changed = new Set(uids);
    let cleared = false;
    for (const element of document.querySelectorAll<HTMLElement>(WRITER_SELECTOR)) {
        if (!changed.has(element.dataset.uid ?? "")) continue;
        const row = element.closest<HTMLElement>(ROW_SELECTOR) ?? element;
        cleared ||= row.matches(LOW_ACTIVITY_SELECTOR);
        row.classList.remove(...LOW_ACTIVITY_CLASS_LIST);
        process(ctx, element);
    }
    if (cleared) notifyRowsHidden();
};

export default defineModule({
    ...meta,

    async setup(ctx) {
        // await 전에 알린다. 뒤에 두면 기다리는 동안 모듈이 꺼졌을 때 revoke가 지운 값을 다시 쓴다.
        publishBadges(ctx);
        ctx.onSettingsChanged(() => {
            publishBadges(ctx);
            publishRatios(ctx);
            rebuildAll(ctx);
        });

        // await 뒤마다 확인해, 그사이 모듈이 꺼졌으면 revoke가 지운 배지·글댓비를 다시 그리지 않는다.
        const {signal} = ctx;

        // 글댓비 캐시. 다른 탭의 쓰기도 watch로 받는다. moduleDataStorage 키라 백업·내보내기에서 빠진다.
        // setup에서 만든다: defineItem은 만드는 순간 값을 읽으므로, 모듈 scope에 두면 features를 불러오는 모든 페이지·팝업·옵션이 이 캐시를 읽는다.
        const ratioStorage = moduleDataStorage<RatioData>("userinfo", {});

        // 작성자 우클릭으로 유저 버블(메모·차단·갤로그)을 연다. 메모는 이 모듈의 기능이라 차단 모듈이 꺼져 있어도 열려야 한다.
        document.addEventListener("contextmenu", openWriterBubble, {capture: true, signal});

        // IP/밴 DB는 모듈 설정을 읽은 뒤 여기서 처음 읽는다 (콘텐츠 스크립트도 부르지만 이 모듈이 꺼졌을 때를 위한 것이다).
        // 읽기가 끝난 뒤 필터를 걸어야 첫 배지부터 IP 정보가 붙는다.
        const [stored] = await Promise.all([ratioStorage.getValue(), initDatabase()]);
        if (signal.aborted) return;
        ratios = stored.ratio ?? {};
        publishRatios(ctx);
        // 받았지만 아직 저장하지 않은 글댓비 (RATIO_SAVE_DELAY).
        let unsaved: Record<string, RatioInfo> = {};
        // 저장소를 다시 읽지 않고 메모리의 값을 한 번에 쓴다 (batchedSave). ratios는 아래 감시가 다른 탭이 저장한 값과 합쳐 두었다.
        // 쓰기가 끝난 뒤에 unsaved를 비워, 그사이 다른 탭의 저장이 와도 이 탭의 값이 남는다.
        const saver = batchedSave(ctx, RATIO_SAVE_DELAY, async () => {
            const batch = unsaved;
            if (Object.keys(batch).length === 0) return;
            await ratioStorage.setValue({ratio: ratios});
            unsaved = Object.fromEntries(Object.entries(unsaved).filter(([uid, info]) => batch[uid] !== info));
        });

        // 다른 탭이 저장한 글댓비가 여기로 온다 (이 탭의 저장도 돌아온다). 열린 디시 탭마다 오므로, 값이 바뀐 유저의 칸만 다시 그린다.
        watchStorage<RatioData>(moduleDataKey("userinfo"), (next) => {
            const before = ratios;
            ratios = trimRatios({...next?.ratio, ...unsaved});
            const changed = [...new Set([...Object.keys(before), ...Object.keys(ratios)])]
                .filter((uid) => before[uid]?.date !== ratios[uid]?.date || before[uid]?.article !== ratios[uid]?.article || before[uid]?.comment !== ratios[uid]?.comment);
            if (changed.length === 0) return;

            publishRatios(ctx);
            rebuildUsers(ctx, changed);
        }, signal);

        ctx.addFilter(
            WRITER_SELECTOR,
            (element) => process(ctx, element)
        );

        const unsubscribeMemos = useMemosStore.subscribe((state, previous) => {
            if (state.memos !== previous.memos) rebuildAll(ctx);
        });

        // IP DB가 갱신되거나 갱차 목록을 다 읽으면 다시 그린다. 갱차 목록은 banReasonsOf를 처음 부를 때 읽기 시작한다.
        const unwatchDatabase = subscribeDatabase(() => rebuildAll(ctx));

        // 조회 중인 uid. 응답이 새로고침 주기보다 늦어도 다음 새로고침이 같은 요청을 또 보내지 않게 한다.
        const pending = new Set<string>();

        // 새 글 작성자의 글댓비를 조회한다 (1시간 캐시, 앞 10개만). 새로고침 모듈이 목록에 새 글을 넣을 때 부른다.
        const checkNewPosts = (elements: HTMLElement[]): void => {
            if (!ctx.settings.checkRatio) return;

            const stale = [...new Set(elements.slice(0, 10).flatMap((post) => post.querySelector<HTMLElement>(".ub-writer")?.dataset.uid || []))]
                .filter((uid) => !isFresh(ratios[uid]) && !failedRatios.has(uid) && !pending.has(uid));
            if (stale.length === 0) return;
            for (const uid of stale) pending.add(uid);

            // 실패는 uid마다 흡수한다. 한 명이 실패해도 받아 온 나머지는 저장한다 (실패한 사람은 배지만 빠진다).
            // 버블·미리보기가 이미 받았거나 받는 중인 사람은 그 결과를 같이 쓴다 (getGallogActivity의 캐시).
            void Promise.all(stale.map(async (uid) => [uid, await getGallogActivity(uid)] as const)).then(async (results) => {
                for (const [uid, info] of results) {
                    if (!info) failedRatios.set(uid, true);
                }
                const fresh = results.filter((entry): entry is [string, GallogActivity] => Boolean(entry[1]));
                if (fresh.length === 0) return;

                if (signal.aborted) return;

                // 이 탭에는 바로 그리고, 저장은 모아서 한다 (RATIO_SAVE_DELAY).
                const now = Date.now();
                const received = Object.fromEntries(fresh.map(([uid, info]) => [uid, {...info, date: now}]));
                Object.assign(unsaved, received);
                ratios = trimRatios({...ratios, ...received});
                publishRatios(ctx);
                rebuildUsers(ctx, Object.keys(received));
                saver.schedule();
            }).catch(console.error).finally(() => {
                for (const uid of stale) pending.delete(uid);
            });
        };

        ctx.addCleanup(() => {
            unsubscribeMemos();
            unwatchDatabase();
        });

        return {checkNewPosts};
    },

    revoke() {
        useUiStore.setState({badgeColors: {}, badgeView: DEFAULT_BADGE_VIEW, ratios: null});
        clearLowActivity();

        // 파이어폭스 재주입으로 새 인스턴스가 setup될 때 옛 인스턴스의 값을 이어받지 않게 비운다.
        colors = {};
        view = DEFAULT_BADGE_VIEW;
        gallery = null;
        ratios = {};
        failedRatios.clear();

        for (const element of document.querySelectorAll(`.${BADGES_CLASS}`)) element.remove();
    }
});
