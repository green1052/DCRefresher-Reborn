// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=7&page=1"}
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {settingsOf} from "@/core/module/settings";
import {type Ctx, settings} from "@/features/preview/meta";
import {bindRows} from "@/features/preview/rows-input";

let controller: AbortController;
const open = vi.fn();
const prefetch = vi.fn();

/** 기본 설정에 patch를 덮어 bindRows를 문서에 붙인다. */
const bind = (patch: Partial<Ctx["settings"]> = {}): void => {
    // settingsOf는 스키마 키로 값을 채우지만 타입은 Record라 meta의 설정 타입으로 되찾는다.
    const values = {...settingsOf({settings}, {}), ...patch} as Ctx["settings"];
    const ctx: Ctx = {settings: values, signal: controller.signal, addFilter: () => () => undefined, addCleanup: () => undefined, onSettingsChanged: () => undefined};
    bindRows(ctx, {open, prefetch, mini: {onMiniEnter: vi.fn(), onMiniMove: vi.fn(), onMiniLeave: vi.fn(), onMiniLeaveSoon: vi.fn()}});
};

const el = (selector: string): HTMLElement => document.querySelector<HTMLElement>(selector)!;

/** 우클릭을 held ms 동안 눌렀다 떼고 contextmenu를 보낸다. contextmenu 이벤트를 돌려준다. */
const rightClick = (target: HTMLElement, held = 0): MouseEvent => {
    target.dispatchEvent(new MouseEvent("mousedown", {button: 2, bubbles: true, cancelable: true}));
    vi.advanceTimersByTime(held);
    target.dispatchEvent(new MouseEvent("mouseup", {button: 2, bubbles: true, cancelable: true}));
    const ev = new MouseEvent("contextmenu", {button: 2, bubbles: true, cancelable: true});
    target.dispatchEvent(ev);
    return ev;
};

beforeEach(() => {
    vi.useFakeTimers();
    controller = new AbortController();
    document.body.innerHTML = `<table class="gall_list"><tbody><tr class="ub-content">
<td class="gall_tit ub-word"><a class="title" href="/board/view/?id=test&no=7&page=1">제목</a><a class="reply_numbox" href="/board/view/?id=test&no=7&t=cv"><span class="reply_num">[3]</span></a></td>
<td class="gall_writer ub-writer"><span class="nickname">작성자</span></td>
<td class="gall_date">10:00</td>
</tr></tbody></table>`;
});

afterEach(() => {
    controller.abort();
});

describe("bindRows", () => {
    it("우클릭을 짧게 누르면 미리보기를 연다", () => {
        bind();
        const ev = rightClick(el("a.title"), 300);
        expect(ev.defaultPrevented).toBe(true);
        expect(open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({gallery: "test", id: "7"}), false);
        expect(prefetch).toHaveBeenCalledOnce();
    });

    it("longPressDelay보다 길게 누르면 브라우저 메뉴로 남기고, 다음 짧은 우클릭은 다시 연다", () => {
        bind({longPressDelay: 500});
        const long = rightClick(el("a.title"), 501);
        expect(long.defaultPrevented).toBe(false);
        expect(open).not.toHaveBeenCalled();

        expect(rightClick(el("a.title"), 100).defaultPrevented).toBe(true);
        expect(open).toHaveBeenCalledOnce();
    });

    it("댓글 수 링크는 댓글만 보기로 연다", () => {
        bind();
        rightClick(el(".reply_num"));
        expect(open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({id: "7"}), true);
    });

    it("행 전체 인식이 꺼져 있으면 제목 칸 밖은 열지 않는다", () => {
        bind();
        expect(rightClick(el(".gall_date")).defaultPrevented).toBe(false);
        expect(open).not.toHaveBeenCalled();
    });

    it("행 전체 인식이면 제목 칸 밖도 열지만 작성자 칸은 열지 않는다", () => {
        bind({expandRecognizeRange: true});
        expect(rightClick(el(".nickname")).defaultPrevented).toBe(false);
        expect(open).not.toHaveBeenCalled();

        expect(rightClick(el(".gall_date")).defaultPrevented).toBe(true);
        expect(open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({id: "7"}), false);
    });

    it("키 반전이면 좌클릭은 미리보기, 우클릭은 글(댓글 수는 댓글 위치)로 이동한다", () => {
        // jsdom은 해시만 바뀌는 이동만 하므로 글 주소에 해시를 붙여 location.href가 바뀌는지 본다.
        el("a.title").setAttribute("href", "/board/view/?id=test&no=7&page=1#title");
        el("a.reply_numbox").setAttribute("href", "/board/view/?id=test&no=7&page=1#reply");
        bind({reversePreviewKey: true});

        const click = new MouseEvent("click", {button: 0, bubbles: true, cancelable: true});
        el("a.title").dispatchEvent(click);
        expect(click.defaultPrevented).toBe(true);
        expect(open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({id: "7"}), false);

        expect(rightClick(el("a.title")).defaultPrevented).toBe(true);
        expect(location.href).toBe("https://gall.dcinside.com/board/view/?id=test&no=7&page=1#title");
        rightClick(el(".reply_num"));
        expect(location.href).toBe("https://gall.dcinside.com/board/view/?id=test&no=7&page=1#reply");
        expect(open).toHaveBeenCalledOnce();
        // 키 반전이면 우클릭으로 열지 않으니 미리 받지도 않는다.
        expect(prefetch).not.toHaveBeenCalled();
    });
});
