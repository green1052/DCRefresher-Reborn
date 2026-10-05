import {render} from "preact";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {clickContents} from "@/features/preview/ui/contentsClick";
import {usePreviewStore} from "@/features/preview/ui/previewStore";

import "../list";

const initialPreview = usePreviewStore.getState();
let container: HTMLElement;

beforeEach(() => {
    usePreviewStore.setState(initialPreview, true);
    container = document.createElement("div");
    document.body.append(container);
    // jsdom은 이미지를 받지 않는다. data-broken이 없으면 받은 것으로 본다.
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockImplementation(function (this: HTMLImageElement) {
        return this.hasAttribute("data-broken") ? 0 : 100;
    });
});
afterEach(() => {
    render(null, container);
    container.remove();
});

/** 미리보기처럼 본문 HTML을 감싼 상자에 클릭을 단다. */
const show = (html: string, imageViewer = true): HTMLElement => {
    render(<div className="box" onClick={(ev) => clickContents(ev, imageViewer)} dangerouslySetInnerHTML={{__html: html}}/>, container);
    const box = container.querySelector<HTMLElement>(".box");
    if (!box) throw new Error("본문이 없다");
    return box;
};

const click = (box: HTMLElement, selector: string): MouseEvent => {
    const target = box.querySelector(selector);
    if (!target) throw new Error(`${selector}가 없다`);
    const ev = new MouseEvent("click", {bubbles: true, cancelable: true});
    target.dispatchEvent(ev);
    return ev;
};

const DCCON = "https://dcimg5.dcinside.com/dccon.php?no=code1";

describe("clickContents", () => {
    it("디시콘은 정보 창을 연다", () => {
        const box = show(`<img class="written_dccon" src="${DCCON}">`);
        click(box, "img");
        expect(usePreviewStore.getState()).toMatchObject({dcconInfo: "code1", viewer: null});
    });

    it("가린 차단 디시콘은 열지 않는다", () => {
        const box = show(`<span data-blocked="hide"><img class="written_dccon" src="${DCCON}"></span>`);
        click(box, "img");
        expect(usePreviewStore.getState().dcconInfo).toBeNull();
    });

    it("이미지를 누르면 볼 수 있는 이미지만 모아 크게 본다", () => {
        const box = show(`
            <img id="a" src="https://a/1.jpg" alt="첫" data-pop="https://pop/1">
            <img class="written_dccon" src="${DCCON}">
            <img data-block="1" src="https://a/x.jpg">
            <img data-broken src="https://a/broken.jpg">
            <span data-blocked="hide"><img src="https://a/blocked.jpg"></span>
            <img style="display: none" src="https://a/hidden.jpg">
            <img id="b" src="https://a/2.jpg">`);
        click(box, "#b");
        expect(usePreviewStore.getState().viewer).toEqual({
            images: [{src: "https://a/1.jpg", alt: "첫", pop: "https://pop/1"}, {src: "https://a/2.jpg", alt: "", pop: undefined}],
            index: 1
        });
    });

    it("링크로 감싼 이미지는 링크로 연다", () => {
        const box = show("<a href=\"https://gall.dcinside.com/\"><img src=\"https://a/1.jpg\" data-pop=\"https://image.dcinside.com/p\"></a>");
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        click(box, "img");
        expect(usePreviewStore.getState().viewer).toBeNull();
        expect(open).not.toHaveBeenCalled();
    });

    it("크게 보기를 끄면 디시 원본 보기를 새 탭으로 연다", () => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        const box = show("<img src=\"https://a/1.jpg\" data-pop=\"https://image.dcinside.com/viewimagePop.php?no=1\"><img id=\"bad\" src=\"x\" data-pop=\"javascript:alert(1)\">", false);
        click(box, "img");
        click(box, "#bad");
        expect(open.mock.calls).toEqual([["https://image.dcinside.com/viewimagePop.php?no=1", "_blank", "noopener"]]);
        expect(usePreviewStore.getState().viewer).toBeNull();
    });

    it("차단 이미지 보기 버튼은 옆의 가린 이미지만 드러낸다", () => {
        usePreviewStore.setState({imageBlocked: true});
        const box = show(`
            <div id="one"><button class="btn_img_block">보기</button><img data-block="1" data-original="https://a/1.jpg"><span class="refresher-imgnum"><img data-block="1" data-original="https://a/2.jpg"></span></div>
            <div id="two"><button class="btn_img_block">보기</button><img data-block="1" data-original="https://a/3.jpg"></div>`);
        expect(click(box, "#one .btn_img_block").defaultPrevented).toBe(true);
        expect(Array.from(box.querySelectorAll("#one img"), (image) => [image.getAttribute("src"), image.hasAttribute("data-block")])).toEqual([
            ["https://a/1.jpg", false], ["https://a/2.jpg", false]
        ]);
        expect(box.querySelector("#one .btn_img_block")).toBeNull();
        expect(box.querySelector("#two img")?.hasAttribute("data-block")).toBe(true);
        expect(usePreviewStore.getState().imageBlocked).toBe(false);
    });

    it("다른 곳을 누르면 아무것도 하지 않는다", () => {
        const box = show("<p>글</p>");
        const before = usePreviewStore.getState();
        expect(click(box, "p").defaultPrevented).toBe(false);
        expect(usePreviewStore.getState()).toBe(before);
    });
});
