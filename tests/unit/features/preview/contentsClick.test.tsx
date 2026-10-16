import {render} from "preact";
import {afterEach, describe, expect, it, vi} from "vitest";

import {clickContents, markPressable} from "@/features/preview/ui/contentsClick";
import {usePreviewStore} from "@/features/preview/ui/previewStore";

/** 받기 상태를 지정한 본문 이미지. 받기 전(lazy)은 complete=false, 깨진 것은 complete=true에 naturalWidth=0이다. */
const image = (src: string, complete: boolean, naturalWidth: number): string =>
    `<img src="${src}" data-complete="${complete}" data-width="${naturalWidth}">`;

/** jsdom은 이미지를 받지 않으므로 data-*에 적은 받기 상태를 complete·naturalWidth로 옮긴다. */
const setLoadState = (root: HTMLElement): void => {
    for (const element of root.querySelectorAll("img")) {
        Object.defineProperty(element, "complete", {value: element.dataset.complete !== "false"});
        Object.defineProperty(element, "naturalWidth", {value: Number(element.dataset.width ?? 0)});
    }
};

afterEach(() => {
    document.body.replaceChildren();
    usePreviewStore.setState({viewer: null});
});

describe("markPressable", () => {
    it("alt가 있으면 이름에 남기고, 없으면 할 일만 읽는다", () => {
        const root = document.createElement("div");
        root.innerHTML = "<img class=\"written_dccon\" alt=\"웃음\"><img class=\"written_dccon\" alt=\" \"><img alt=\"고양이\" src=\"a.jpg\"><img src=\"b.jpg\">";
        markPressable(root, true);

        expect([...root.querySelectorAll("img")].map((element) => element.getAttribute("aria-label")))
            .toEqual(["웃음 (디시콘 정보)", "디시콘 정보", "고양이 (이미지 크게 보기)", "이미지 크게 보기"]);
    });

    it("깨진 이미지는 크게 보기로 알리지 않고, 원본 보기가 있으면 그것만 알린다", () => {
        const root = document.createElement("div");
        root.innerHTML = `${image("a.jpg", false, 0)}${image("b.jpg", true, 0)}<img src="c.jpg" data-complete="true" data-width="0" data-pop="https://gall.dcinside.com/pop">`;
        setLoadState(root);
        markPressable(root, true);

        expect([...root.querySelectorAll("img")].map((element) => element.getAttribute("aria-label")))
            .toEqual(["이미지 크게 보기", null, "원본 보기"]);
    });
});

describe("clickContents", () => {
    it("아직 받지 않은(lazy·받는 중) 이미지도 크게 보기 목록에 넣고, 깨진 이미지만 뺀다", () => {
        Element.prototype.checkVisibility = () => true;
        const container = document.createElement("div");
        document.body.append(container);
        render(<div onClick={(ev) => clickContents(ev, true)}/>, container);
        const root = container.querySelector("div")!;
        root.innerHTML = image("loaded.jpg", true, 100) + image("broken.jpg", true, 0) + image("lazy.jpg", false, 0) + image("after.jpg", true, 100);
        setLoadState(root);

        // 아직 받지 않은 이미지를 눌러도 원본 보기로 빠지지 않고 크게 본다.
        root.querySelectorAll("img")[2]!.click();

        const viewer = usePreviewStore.getState().viewer;
        expect(viewer?.images.map(({src}) => src.split("/").pop())).toEqual(["loaded.jpg", "lazy.jpg", "after.jpg"]);
        expect(viewer?.index).toBe(1);
    });

    it.each([true, false])("차단으로 가린 이미지는 크게 보기도 원본 보기도 열지 않는다 (imageViewer %s)", (imageViewer) => {
        Element.prototype.checkVisibility = () => true;
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        const container = document.createElement("div");
        document.body.append(container);
        render(<div onClick={(ev) => clickContents(ev, imageViewer)}/>, container);
        const root = container.querySelector("div")!;
        root.innerHTML = `<img src="a.jpg" data-width="100" data-blocked="blur" data-pop="https://gall.dcinside.com/pop"><div data-blocked="blur"><img src="b.jpg" data-width="100" data-pop="https://gall.dcinside.com/pop"></div>`;
        setLoadState(root);

        for (const element of root.querySelectorAll("img")) element.click();

        expect(open).not.toHaveBeenCalled();
        expect(usePreviewStore.getState().viewer).toBeNull();
    });
});
