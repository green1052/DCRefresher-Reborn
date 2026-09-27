import {LayoutPanelTop} from "lucide-react";

import {defineModule} from "@/core/module/define";
import type {ModuleContext, SettingSchema, SettingsSchema} from "@/core/module/types";
import {isViewPage} from "@/core/http/urls";

/**
 * 체크하면 숨기는 영역. 설정 이름·설명과 숨길 선택자를 한 곳에 둔다 —
 * 켜진 항목의 선택자로 <style>을 만들어 넣으므로 새 항목은 여기 한 줄만 추가하면 된다.
 */
const HIDE_OPTIONS = {
    hideGalleryView: {name: "갤러리 뷰 숨기기", desc: "갤러리 정보, 최근 방문 갤러리 영역을 숨깁니다.", selector: ".issue_wrap, #visit_history"},
    hideUselessView: {
        name: "잡다 링크 숨기기",
        desc: "이슈줌, 타갤 개념글, 뉴스, 힛갤 등의 컨텐츠를 오른쪽 영역에서 숨깁니다.",
        selector: "section.right_content article"
    },
    hideNft: {name: "NFT 숨기기", desc: "NFT 관련 내용을 숨깁니다.", selector: ".btn_nftbox, .nft_informationwrap"},
    hideGalleryImage: {name: "갤러리 대문 숨기기", desc: "갤러리 대문을 숨깁니다.", selector: "#zzbang_div"},
    removeNotice: {name: "갤러리 공지 숨기기", desc: "글 목록에서 공지사항을 숨깁니다.", selector: "tr:has(em[class*=icon_notice])"},
    removeDCNotice: {
        name: "디시 공지 숨기기",
        desc: "글 목록에서 운영자의 게시글을 숨깁니다.",
        // 설문·광고 행은 user_name 칸, 운영자 글은 식별 코드·IP가 빈 운영자 작성자 칸
        selector: "tr[class*=ub-content]:has(> td[user_name=운영자]), tr.ub-content:has(> .ub-writer[data-nick=운영자][data-uid=\"\"][data-ip=\"\"])"
    },
    removeGamemeca: {name: "게임메카 숨기기", desc: "글 목록에서 게임메카 게시글을 숨깁니다.", selector: "tr[data-type=icon_fnews]"}
} satisfies Record<string, { name: string; desc: string; selector: string }>;

type HideKey = keyof typeof HIDE_OPTIONS;
const HIDE_KEYS = Object.keys(HIDE_OPTIONS) as HideKey[];

const COMPACT_KEYS = new Set(["activePixel", "forceCompact", "useCompactModeOnView"]);
const PUSH_CLASS = "refresherPushToRight";
const HIDE_STYLE_ID = "refresher-layout-hide";

let hideStyle: HTMLStyleElement | null = null;
let widthQuery: MediaQueryList | null = null;
let widthWatch: AbortController | null = null;

const applyCompact = (ctx: Ctx): void => {
    const compact = widthQuery?.matches === true || ctx.settings.forceCompact;
    // /board/view에서는 '게시글 보기 컴팩트 모드'가 켜졌을 때만 적용
    const useCompact = compact && (!isViewPage || ctx.settings.useCompactModeOnView);

    document.documentElement.classList.toggle("refresherCompact", useCompact);
};

/** 창 폭이 기준(activePixel)을 넘나들 때만 다시 맞춘다 — resize는 창 크기를 바꾸는 동안 수십 번 온다 */
const watchWidth = (ctx: Ctx): void => {
    widthWatch?.abort();
    widthWatch = new AbortController();
    widthQuery = window.matchMedia(`(max-width: ${ctx.settings.activePixel}px)`);
    widthQuery.addEventListener("change", () => applyCompact(ctx), {signal: AbortSignal.any([ctx.signal, widthWatch.signal])});
    applyCompact(ctx);
};

const applyHide = (ctx: Ctx): void => {
    // 공지 모아보기(?exception_mode=notice)에서는 공지를 숨기지 않는다 (디시 공지도)
    const noticePage = location.search.includes("exception_mode=notice");

    // 선택자마다 규칙을 따로 둔다 — 하나로 합치면 :has 등을 모르는 브라우저에서 규칙 전체가 무시된다.
    // 죽은 인스턴스(파이어폭스 재주입)가 남긴 것은 id로 찾아 이어 쓴다 — 새로 붙이면 옛 규칙이 끌 수 없게 남는다
    hideStyle ??= document.querySelector<HTMLStyleElement>(`style#${HIDE_STYLE_ID}`)
        ?? document.documentElement.appendChild(Object.assign(document.createElement("style"), {id: HIDE_STYLE_ID}));
    hideStyle.textContent = HIDE_KEYS
        .filter((key) => ctx.settings[key] && !(noticePage && (key === "removeNotice" || key === "removeDCNotice")))
        .map((key) => `${HIDE_OPTIONS[key].selector} { display: none !important; }`)
        .join("\n");

    // 본문 확장은 잡다 링크가 숨겨졌을 때만 (layout.scss의 폭 조정)
    document.documentElement.classList.toggle(PUSH_CLASS, ctx.settings.pushToRight && ctx.settings.hideUselessView);
};

const settings = {
    activePixel: {
        type: "range",
        name: "컴팩트 모드 활성화 조건",
        desc: "브라우저 가로가 이 값보다 작을 경우 컴팩트 모드를 활성화합니다.",
        default: 900,
        min: 100,
        // 모니터마다 다른 screen.width로 두면 큰 모니터에서 저장한 값이 작은 모니터에서 잘린다
        max: 3840,
        step: 1,
        unit: "px"
    },
    forceCompact: {
        type: "check",
        name: "컴팩트 모드 강제 사용",
        desc: "항상 컴팩트 모드를 사용합니다.",
        default: false
    },
    useCompactModeOnView: {
        type: "check",
        name: "게시글 보기 컴팩트 모드",
        desc: "게시글 보기에서도 컴팩트 모드를 사용합니다.",
        default: true
    },
    ...(Object.fromEntries(HIDE_KEYS.map((key) => [key, {type: "check", name: HIDE_OPTIONS[key].name, desc: HIDE_OPTIONS[key].desc, default: false}])) as
        Record<HideKey, Extract<SettingSchema, { type: "check" }>>),
    pushToRight: {
        type: "check",
        name: "본문 영역 전체로 확장",
        desc: "\"잡다 링크 숨기기\" 옵션이 켜진 경우 본문 영역을 확장합니다.",
        default: false
    }
} satisfies SettingsSchema;

type Ctx = ModuleContext<typeof settings>;

export default defineModule({
    id: "layout",
    name: "레이아웃 수정",
    description: "디시 레이아웃을 변경합니다.",
    icon: LayoutPanelTop,

    settings,

    setup(ctx) {
        watchWidth(ctx);
        applyHide(ctx);
    },

    onChanged(ctx, key) {
        if (key === "activePixel") watchWidth(ctx);
        else if (COMPACT_KEYS.has(key)) applyCompact(ctx);
        else applyHide(ctx);
    },

    revoke() {
        hideStyle?.remove();
        hideStyle = null;
        widthWatch?.abort();
        widthQuery = null;

        document.documentElement.classList.remove("refresherCompact", PUSH_CLASS);
    }
});
