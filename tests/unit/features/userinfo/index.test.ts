// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {ROWS_HIDDEN_EVENT} from "@/core/block";
import type {IpCategory} from "@/core/database";
import type {GallogActivity} from "@/core/gallog";
import userinfo from "@/features/userinfo/index";
import {useMemosStore} from "@/stores/memos";
import {DEFAULT_BADGE_VIEW, useUiStore} from "@/stores/ui";

import {stored, tick} from "../../../helpers";
import {type Running, runModule} from "../module";

// IP·밴 DB와 갤로그는 저장소·네트워크 대신 표로 둔다.
const db = vi.hoisted(() => ({
    ips: new Map<string, { label: string; title: string; category: IpCategory }>(),
    bans: new Map<string, string>(),
    listeners: new Set<() => void>()
}));
vi.mock("@/core/database", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/database")>(),
    initDatabase: async () => {},
    ipInfoOf: (ip: string) => db.ips.get(ip),
    banReasonsOf: (uid: string) => db.bans.get(uid),
    subscribeDatabase: (listener: () => void) => {
        db.listeners.add(listener);
        return () => db.listeners.delete(listener);
    }
}));

const gallog = vi.hoisted(() => ({activity: new Map<string, GallogActivity>(), asked: new Array<string>()}));
vi.mock("@/core/gallog", () => ({
    getGallogActivity: async (uid: string) => {
        gallog.asked.push(uid);
        return gallog.activity.get(uid);
    }
}));

const RATIO_KEY = "refresher:module:userinfo:data";

interface Writer {
    no: string;
    nick?: string;
    uid?: string;
    ip?: string;
    icon?: string;
}

const row = ({no, nick = "닉", uid = "", ip = "", icon}: Writer): string =>
    `<tr class="ub-content" data-no="${no}"><td class="gall_writer ub-writer" data-nick="${nick}" data-uid="${uid}" data-ip="${ip}">` +
    `<span class="nickname"><em>${nick}</em></span>${ip ? `<span class="ip">(${ip})</span>` : ""}` +
    `${icon ? `<a class="writer_nikcon"><img src="https://nstatic.dcinside.com/dc/w/images/${icon}"></a>` : ""}</td></tr>`;

const mountRows = (writers: Writer[]): void => {
    document.body.innerHTML = `<table class="gall_list"><tbody>${writers.map(row).join("")}</tbody></table>`;
};

const badges = (no: string): string[] =>
    Array.from(document.querySelectorAll(`tr[data-no="${no}"] .refresher-user-badges > span`), (span) => span.textContent ?? "");

const badge = (no: string, text: string): HTMLElement | undefined =>
    Array.from(document.querySelectorAll<HTMLElement>(`tr[data-no="${no}"] .refresher-user-badges > span`)).find((span) => span.textContent === text);

let running: Running<{ checkNewPosts(elements: HTMLElement[]): void }> | undefined;
const start = async (patch = {}) => (running = await runModule(userinfo, patch));

beforeEach(() => {
    db.ips.clear();
    db.bans.clear();
    db.listeners.clear();
    gallog.activity.clear();
    gallog.asked.length = 0;
    useMemosStore.setState({memos: {UID: {}, NICK: {}, IP: {}}});
    useUiStore.setState({selected: null, bubble: null});
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

describe("아이디·IP 배지", () => {
    it("회원은 아이디를, 유동은 IP 정보를 붙인다", async () => {
        db.ips.set("1.2", {label: "KT", title: "KT\nSK", category: "korea"});
        mountRows([{no: "1", uid: "member"}, {no: "2", ip: "1.2"}, {no: "3", ip: "9.9"}]);
        await start();
        expect(badges("1")).toEqual(["(member)"]);
        expect(badges("2")).toEqual(["[KT]"]);
        expect(badge("2", "[KT]")?.title).toBe("KT\nSK");
        expect(badge("2", "[KT]")?.style.color).toBe("rgb(100, 149, 237)");
        // IP 정보가 없는 유동은 배지 묶음을 만들지 않는다.
        expect(document.querySelector("tr[data-no='3'] .refresher-user-badges")).toBeNull();
    });

    it("배지는 IP 바로 뒤에 넣는다", async () => {
        db.ips.set("1.2", {label: "KT", title: "KT", category: "korea"});
        mountRows([{no: "1", ip: "1.2"}]);
        await start();
        expect(document.querySelector(".ip")?.nextElementSibling?.className).toBe("refresher-user-badges");
    });

    it("IP 표시 대상을 거른다", async () => {
        db.ips.set("1.2", {label: "KT", title: "KT", category: "korea"});
        db.ips.set("3.4", {label: "Tencent (VPN)", title: "Tencent", category: "vpn"});
        mountRows([{no: "1", ip: "1.2"}, {no: "2", ip: "3.4"}]);
        await start({ipInfoFilter: "foreign"});
        expect(badges("1")).toEqual([]);
        expect(badges("2")).toEqual(["[Tencent (VPN)]"]);
    });

    it("고정닉·반고정닉 아이디는 설정대로 숨긴다", async () => {
        mountRows([{no: "1", uid: "fixed", icon: "fix_nik.gif"}, {no: "2", uid: "half", icon: "nik.gif"}]);
        const {change} = await start({showFixedNickUID: false});
        expect(badges("1")).toEqual([]);
        expect(badges("2")).toEqual(["(half)"]);

        change({showFixedNickUID: true, showHalfFixedNickUID: false});
        expect(badges("1")).toEqual(["(fixed)"]);
        expect(badges("2")).toEqual([]);
    });

    it("디시가 처리한 user_name 칸은 건너뛴다", async () => {
        document.body.innerHTML = "<table><tbody><tr class=\"ub-content\" data-no=\"1\"><td class=\"ub-writer\" user_name=\"운영자\" data-uid=\"admin\"></td></tr></tbody></table>";
        await start();
        expect(document.querySelector(".refresher-user-badges")).toBeNull();
    });
});

describe("메모·순서·갱차", () => {
    it("메모를 붙이고 메모가 바뀌면 다시 그린다", async () => {
        mountRows([{no: "1", uid: "member"}]);
        await start();
        useMemosStore.setState({memos: {UID: {member: {text: "친구", color: "#00ff00"}}, NICK: {}, IP: {}}});
        expect(badges("1")).toEqual(["(member)", "[친구]"]);
        expect(badge("1", "[친구]")?.style.color).toBe("rgb(0, 255, 0)");
    });

    it("다른 갤러리 전용 메모는 붙이지 않는다", async () => {
        useMemosStore.setState({memos: {UID: {member: {text: "다른 곳", color: "", gallery: "other"}}, NICK: {}, IP: {}}});
        mountRows([{no: "1", uid: "member"}]);
        await start();
        expect(badges("1")).toEqual(["(member)"]);
    });

    it("배치 순서를 따른다", async () => {
        useMemosStore.setState({memos: {UID: {member: {text: "메모", color: ""}}, NICK: {}, IP: {}}});
        db.bans.set("member", "어느갤");
        mountRows([{no: "1", uid: "member"}]);
        await start({badgeOrder: ["PERMBAN", "MEMO", "UID", "RATIO"], checkPermBan: true});
        expect(badges("1")).toEqual(["[어느갤]", "[메모]", "(member)"]);
    });

    it("갱차 조회를 끄면 갱차 배지를 붙이지 않는다", async () => {
        db.bans.set("member", "어느갤");
        mountRows([{no: "1", uid: "member"}]);
        await start();
        expect(badges("1")).toEqual(["(member)"]);
        expect(useUiStore.getState().badgeColors.permBan).toBeUndefined();
    });

    it("DB가 갱신되면 다시 그린다", async () => {
        mountRows([{no: "1", ip: "1.2"}]);
        await start();
        db.ips.set("1.2", {label: "KT", title: "KT", category: "korea"});
        for (const listener of db.listeners) listener();
        expect(badges("1")).toEqual(["[KT]"]);
    });
});

describe("글댓비·깡계", () => {
    const saveRatio = async (ratio: Record<string, { article: number; comment: number; date: number }>): Promise<void> =>
        fakeBrowser.storage.local.set({[RATIO_KEY]: {ratio}});

    it("저장된 글댓비를 붙인다", async () => {
        await saveRatio({member: {article: 10, comment: 20, date: Date.now()}});
        mountRows([{no: "1", uid: "member"}]);
        await start({checkRatio: true});
        expect(badges("1")).toEqual(["(member)", "[10/20]"]);
        expect(useUiStore.getState().ratios?.cache.member?.article).toBe(10);
    });

    it("글댓비 표시를 끄면 붙이지 않는다", async () => {
        await saveRatio({member: {article: 10, comment: 20, date: Date.now()}});
        mountRows([{no: "1", uid: "member"}]);
        await start();
        expect(badges("1")).toEqual(["(member)"]);
        expect(useUiStore.getState().ratios).toBeNull();
    });

    it("깡계는 [깡계] 표시를 붙인다", async () => {
        await saveRatio({low: {article: 1, comment: 2, date: Date.now()}, high: {article: 100, comment: 0, date: Date.now()}});
        mountRows([{no: "1", uid: "low"}, {no: "2", uid: "high"}]);
        await start({checkRatio: true, alarmRatio: 10});
        expect(badges("1")).toEqual(["(low)", "[1/2]", "[깡계]"]);
        expect(badge("1", "[1/2]")?.style.color).toBe("rgb(255, 0, 0)");
        expect(badges("2")).toEqual(["(high)", "[100/0]"]);
    });

    it("기준이 0이면 깡계로 보지 않는다", async () => {
        await saveRatio({low: {article: 0, comment: 0, date: Date.now()}});
        mountRows([{no: "1", uid: "low"}]);
        await start({checkRatio: true, alarmRatio: 0});
        expect(badges("1")).toEqual(["(low)", "[0/0]"]);
    });

    it("흐리게·숨기기는 행에 걸고 알리고, 설정을 바꾸면 뗀다", async () => {
        await saveRatio({low: {article: 1, comment: 2, date: Date.now()}});
        mountRows([{no: "1", uid: "low"}]);
        const notified = vi.fn();
        document.addEventListener(ROWS_HIDDEN_EVENT, notified);

        const {change} = await start({checkRatio: true, alarmRatio: 10, lowActivityAction: "blur"});
        const tr = document.querySelector("tr")!;
        expect(tr.classList.contains("refresherLowActivityBlur")).toBe(true);
        await tick();
        expect(notified).toHaveBeenCalledTimes(1);

        change({lowActivityAction: "hide"});
        expect(tr.classList.contains("refresherLowActivityBlur")).toBe(false);
        expect(tr.classList.contains("refresherLowActivityHide")).toBe(true);

        change({alarmRatio: 0});
        expect(tr.className).toBe("ub-content");
        document.removeEventListener(ROWS_HIDDEN_EVENT, notified);
    });

    it("글 보기 머리는 가리지 않는다", async () => {
        await saveRatio({low: {article: 1, comment: 2, date: Date.now()}});
        document.body.innerHTML = "<div class=\"gallview_head ub-content\"><div class=\"gall_writer ub-writer\" data-nick=\"a\" data-uid=\"low\" data-ip=\"\"></div></div>";
        await start({checkRatio: true, alarmRatio: 10, lowActivityAction: "hide"});
        expect(document.querySelector(".refresherLowActivityHide")).toBeNull();
    });

    it("새 글 작성자의 글댓비를 받아 그리고 모아서 저장한다", async () => {
        gallog.activity.set("fresh", {article: 3, comment: 4});
        mountRows([{no: "1", uid: "fresh"}, {no: "2", uid: "fresh"}]);
        const {api, stop} = await start({checkRatio: true});
        api.checkNewPosts([...document.querySelectorAll<HTMLElement>("tr")]);
        await vi.waitFor(() => expect(badges("1")).toEqual(["(fresh)", "[3/4]"]));
        expect(badges("2")).toEqual(["(fresh)", "[3/4]"]);
        // 같은 사람은 한 번만 묻는다.
        expect(gallog.asked).toEqual(["fresh"]);
        expect(await stored(RATIO_KEY)).toBeUndefined();

        // 모듈을 끌 때 모아 둔 것을 저장한다.
        stop();
        running = undefined;
        await vi.waitFor(async () => expect(await stored(RATIO_KEY)).toEqual({ratio: {fresh: {article: 3, comment: 4, date: expect.any(Number)}}}));
    });

    it("1시간 안에 받은 값과 실패한 유저는 다시 묻지 않는다", async () => {
        await saveRatio({recent: {article: 1, comment: 1, date: Date.now()}});
        mountRows([{no: "1", uid: "recent"}, {no: "2", uid: "missing"}]);
        const {api} = await start({checkRatio: true});
        const rows = [...document.querySelectorAll<HTMLElement>("tr")];
        api.checkNewPosts(rows);
        await vi.waitFor(() => expect(gallog.asked).toEqual(["missing"]));
        await tick();
        api.checkNewPosts(rows);
        await tick();
        expect(gallog.asked).toEqual(["missing"]);
    });

    it("앞 10개 글만 묻는다", async () => {
        mountRows(Array.from({length: 12}, (_, index) => ({no: String(index), uid: `u${index}`})));
        const {api} = await start({checkRatio: true});
        api.checkNewPosts([...document.querySelectorAll<HTMLElement>("tr")]);
        await vi.waitFor(() => expect(gallog.asked).toHaveLength(10));
        expect(gallog.asked).not.toContain("u10");
    });

    it("다른 탭이 저장한 글댓비를 받아 그 유저만 다시 그린다", async () => {
        mountRows([{no: "1", uid: "a"}, {no: "2", uid: "b"}]);
        await start({checkRatio: true});
        const untouched = document.querySelector("tr[data-no='2'] .refresher-user-badges");
        await saveRatio({a: {article: 5, comment: 6, date: Date.now()}});
        await vi.waitFor(() => expect(badges("1")).toEqual(["(a)", "[5/6]"]));
        expect(document.querySelector("tr[data-no='2'] .refresher-user-badges")).toBe(untouched);
    });
});

describe("미리보기 공유·끄기", () => {
    it("배지 색·표시 조건을 ui 스토어에 올리고, 끄면 되돌린다", async () => {
        db.ips.set("1.2", {label: "KT", title: "KT", category: "korea"});
        mountRows([{no: "1", ip: "1.2"}]);
        const {stop} = await start({checkPermBan: true, uidColor: "#123456"});
        const state = useUiStore.getState();
        expect(state.badgeColors.uid).toBe("#123456");
        expect(state.badgeColors.permBan).toBe("#e8645f");
        expect(state.badgeView).toEqual({order: ["UID", "MEMO", "RATIO", "PERMBAN"], fixedUid: true, halfFixedUid: true, ipFilter: "all"});

        stop();
        running = undefined;
        expect(useUiStore.getState().badgeColors).toEqual({});
        expect(useUiStore.getState().badgeView).toBe(DEFAULT_BADGE_VIEW);
        expect(document.querySelector(".refresher-user-badges")).toBeNull();
    });

    it("작성자 칸을 우클릭하면 유저 버블을 연다", async () => {
        mountRows([{no: "1", nick: "닉", uid: "member"}]);
        await start();
        document.querySelector(".ub-writer em")!.dispatchEvent(new MouseEvent("contextmenu", {bubbles: true, cancelable: true}));
        expect(useUiStore.getState().selected).toEqual({nick: "닉", uid: "member", ip: ""});
    });
});
