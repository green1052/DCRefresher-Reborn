import {beforeEach, describe, expect, it, vi} from "vitest";

import {DEFAULT_BADGE_VIEW, isFresh, isLowActivity, openWriterBubble, showsUid, useUiStore} from "@/stores/ui";

const initial = useUiStore.getState();
beforeEach(() => useUiStore.setState(initial, true));

const state = () => useUiStore.getState();

describe("토스트", () => {
    it("최근 3개만 남기고 id는 늘 새것이다", () => {
        for (const content of ["1", "2", "3", "4"]) state().showToast(content);

        const {toasts} = state();
        expect(toasts.map((toast) => toast.content)).toEqual(["2", "3", "4"]);
        expect(new Set(toasts.map((toast) => toast.id)).size).toBe(3);
        expect(toasts[0]).toMatchObject({type: "info", autoClose: 5000});
    });

    it("dismissToast는 그 토스트만 닫는다", () => {
        const run = vi.fn();
        state().showToast("a");
        state().showToast("b", "error", 0, {label: "되돌리기", run});
        const [a, b] = state().toasts;

        state().dismissToast(a!.id);

        expect(state().toasts).toEqual([{id: b!.id, content: "b", type: "error", autoClose: 0, action: {label: "되돌리기", run}}]);
    });
});

describe("버블·메모", () => {
    it("openBubble은 대상과 위치를 두고 closeBubble은 위치만 지운다", () => {
        state().openBubble({nick: "n"}, 1, 2);
        expect(state()).toMatchObject({selected: {nick: "n"}, bubble: {x: 1, y: 2}});

        state().closeBubble();
        expect(state()).toMatchObject({selected: {nick: "n"}, bubble: null});
    });

    it("openMemo는 버블을 닫고 아이디 > IP > 닉네임 순으로 처음 종류를 고른다", () => {
        state().openBubble({}, 0, 0);
        state().openMemo({nick: "n", uid: "u", ip: "1.2"});
        expect(state().bubble).toBeNull();
        expect(state().memo).toEqual({targets: {NICK: "n", UID: "u", IP: "1.2"}, initialType: "UID"});

        state().openMemo({nick: "n", ip: "1.2"});
        expect(state().memo?.initialType).toBe("IP");
        state().openMemo({nick: "n", uid: ""});
        expect(state().memo).toEqual({targets: {NICK: "n"}, initialType: "NICK"});

        state().closeMemo();
        expect(state().memo).toBeNull();
    });
});

describe("판정", () => {
    it("isLowActivity는 기준 이하이고 기준이 0이면 끈 것이다", () => {
        expect(isLowActivity({article: 1, comment: 2}, 3)).toBe(true);
        expect(isLowActivity({article: 2, comment: 2}, 3)).toBe(false);
        expect(isLowActivity({article: 0, comment: 0}, 0)).toBe(false);
    });

    it("isFresh는 1시간 안의 값만", () => {
        vi.useFakeTimers({now: 10_000_000});
        expect(isFresh({date: 10_000_000 - 3600_000})).toBe(true);
        expect(isFresh({date: 10_000_000 - 3600_001})).toBe(false);
        expect(isFresh(undefined)).toBe(false);
    });

    it("showsUid는 닉콘 종류에 따른다", () => {
        const view = {...DEFAULT_BADGE_VIEW, fixedUid: false, halfFixedUid: true};
        expect(showsUid(view, "https://x/fix_nik.gif")).toBe(false);
        expect(showsUid(view, "https://x/nik.gif")).toBe(true);
        expect(showsUid({...view, halfFixedUid: false}, "https://x/nik.gif")).toBe(false);
        expect(showsUid({...view, halfFixedUid: false})).toBe(true);
    });
});

describe("openWriterBubble", () => {
    const rightClick = (target: Element, init: MouseEventInit = {}) => {
        const ev = new MouseEvent("contextmenu", {bubbles: true, cancelable: true, clientX: 5, clientY: 6, ...init});
        target.dispatchEvent(ev);
        return ev;
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <span class="ub-writer" data-nick="n" data-uid="u"><em>이름</em></span>
            <span class="ub-writer empty"><em>빈칸</em></span>
            <p class="other"></p>`;
        document.addEventListener("contextmenu", openWriterBubble);
        return () => document.removeEventListener("contextmenu", openWriterBubble);
    });

    it("작성자 칸 안을 우클릭하면 버블을 열고 브라우저 메뉴를 막는다", () => {
        const ev = rightClick(document.querySelector(".ub-writer em")!);

        expect(ev.defaultPrevented).toBe(true);
        expect(state()).toMatchObject({selected: {nick: "n", uid: "u", ip: undefined}, bubble: {x: 5, y: 6}});
    });

    it("Shift·이미 막힌 이벤트·작성자 밖·빈 작성자는 건너뛴다", () => {
        const writer = document.querySelector(".ub-writer em")!;
        expect(rightClick(writer, {shiftKey: true}).defaultPrevented).toBe(false);
        expect(rightClick(document.querySelector(".other")!).defaultPrevented).toBe(false);
        expect(rightClick(document.querySelector(".empty em")!).defaultPrevented).toBe(false);

        writer.addEventListener("contextmenu", (ev) => ev.preventDefault(), {once: true});
        rightClick(writer);

        expect(state().bubble).toBeNull();
    });
});
