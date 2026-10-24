import {render} from "preact";
import {afterEach, describe, expect, it, vi} from "vitest";

import {clickContents, markMedia, markPressable} from "@/features/preview/ui/contentsClick";
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
    it("'차단 이미지 보기'로 드러낸 관리자 가림 이미지를 크게 보기 버튼으로 알린다", () => {
        const container = document.createElement("div");
        document.body.append(container);
        render(<div onClick={(ev) => clickContents(ev, true)}/>, container);
        const root = container.querySelector("div")!;
        root.innerHTML = "<p><button class=\"btn_img_block\"></button><img data-original=\"https://dcimg.dcinside.com/a.jpg\" data-block=\"\"></p>";
        markPressable(root, true);
        const hidden = root.querySelector("img")!;
        expect(hidden.getAttribute("role")).toBeNull();

        root.querySelector<HTMLButtonElement>(".btn_img_block")!.click();

        expect(hidden.getAttribute("src")).toBe("https://dcimg.dcinside.com/a.jpg");
        expect(hidden.getAttribute("role")).toBe("button");
        expect(hidden.getAttribute("aria-label")).toBe("이미지 크게 보기");
    });

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

    it("링크로 감싼 이미지(링크 미리보기 카드 썸네일)는 크게 보기 목록과 순번에서 뺀다", () => {
        Element.prototype.checkVisibility = () => true;
        const container = document.createElement("div");
        document.body.append(container);
        render(<div onClick={(ev) => clickContents(ev, true)}/>, container);
        const root = container.querySelector("div")!;
        root.innerHTML = `${image("1.jpg", true, 100)}<a class="og-wrap" href="https://example.com"><div class="og-img">${image("card.jpg", true, 100)}</div></a>${image("2.jpg", true, 100)}${image("3.jpg", true, 100)}`;
        setLoadState(root);

        root.querySelectorAll("img")[2]!.click();

        const viewer = usePreviewStore.getState().viewer;
        expect(viewer?.images.map(({src}) => src.split("/").pop())).toEqual(["1.jpg", "2.jpg", "3.jpg"]);
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

    // 글쓴이가 본문에 직접 단 data-pop은 정화를 거쳐도 남으므로 디시 주소만 연다.
    const pops = [
        ["https://image.dcinside.com/viewimagePop.php?no=1", "https://image.dcinside.com/viewimagePop.php?no=1"],
        ["javascript:alert(1)", undefined],
        ["https://evil.example/", undefined]
    ] as const;

    it.each(pops)("크게 보기를 끄면 data-pop이 디시 주소일 때만 새 탭으로 연다 (%s)", (pop, expected) => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        const container = document.createElement("div");
        document.body.append(container);
        render(<div onClick={(ev) => clickContents(ev, false)}/>, container);
        const root = container.querySelector("div")!;
        root.innerHTML = `<img src="a.jpg" data-pop="${pop}">`;

        root.querySelector("img")!.click();

        if (expected) expect(open).toHaveBeenCalledWith(expected, "_blank", "noopener");
        else expect(open).not.toHaveBeenCalled();
    });

    it.each(pops)("크게 보기 목록에는 디시 원본 보기 주소만 남긴다 (%s)", (pop, expected) => {
        Element.prototype.checkVisibility = () => true;
        const container = document.createElement("div");
        document.body.append(container);
        render(<div onClick={(ev) => clickContents(ev, true)}/>, container);
        const root = container.querySelector("div")!;
        root.innerHTML = `<img src="a.jpg" data-width="100" data-pop="${pop}">`;
        setLoadState(root);

        root.querySelector("img")!.click();

        expect(usePreviewStore.getState().viewer?.images[0]?.pop).toBe(expected);
    });
});

describe("markMedia", () => {
    it("깨진 이미지는 크게 보기 표시를 떼고 원본 보기만 남긴다", () => {
        const setLoad = (image: HTMLImageElement, width: number): void => {
            Object.defineProperty(image, "complete", {value: true, configurable: true});
            Object.defineProperty(image, "naturalWidth", {value: width, configurable: true});
        };
        const box = document.createElement("div");
        const breaking = document.createElement("img");
        breaking.dataset.pop = "https://gall.dcinside.com/viewimage.php";
        const fine = document.createElement("img");
        fine.dataset.pop = "https://gall.dcinside.com/viewimage.php";
        setLoad(breaking, 100);
        setLoad(fine, 100);
        box.append(breaking, fine);
        markPressable(box, true);
        expect(breaking.getAttribute("aria-label")).toContain("이미지 크게 보기");

        // 받다가 깨졌다. error는 그 이미지만 다시 맞춘다. 옆의 멀쩡한 이미지는 그대로다.
        setLoad(breaking, 0);
        markMedia(breaking, true);
        expect(breaking.getAttribute("aria-label")).toBe("원본 보기");
        expect(breaking.getAttribute("role")).toBe("button");
        expect(fine.getAttribute("aria-label")).toContain("이미지 크게 보기");
    });
});
