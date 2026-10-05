import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {fitTxtcon} from "@/features/preview/ui/fitTxtcon";

/**
 * jsdom에는 배치가 없다. 글자 크기 f에서 글자마다 f×f, 줄 높이 1.2f인 고정폭 글꼴로 잰다.
 * 상자(.txtcon)는 그려진 것으로 보고, 재는 span은 줄마다 상자 하나를 준다.
 */
const descriptors = {
    getClientRects: Object.getOwnPropertyDescriptor(Element.prototype, "getClientRects"),
    getBoundingClientRect: Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect")
};

const measure = (element: Element) => {
    const lines = (element.textContent ?? "").split("\n");
    const size = parseFloat(element.parentElement?.style.fontSize ?? "") || 16;
    return {lines: lines.length, width: Math.max(...lines.map((line) => Array.from(line).length)) * size, height: lines.length * size * 1.2};
};

beforeEach(() => {
    Object.defineProperty(Element.prototype, "getClientRects", {
        configurable: true,
        value(this: Element) {
            if (this.classList.contains("txtcon")) return [{}];
            return this.tagName === "SPAN" ? Array.from({length: measure(this).lines}, () => ({})) : [];
        }
    });
    Object.defineProperty(Element.prototype, "getBoundingClientRect", {
        configurable: true,
        value(this: Element) {
            const {width, height} = measure(this);
            return {width, height};
        }
    });
});
afterEach(() => {
    for (const [name, descriptor] of Object.entries(descriptors)) if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
    document.body.replaceChildren();
});

const box = (html: string, width: number, height: number): { box: HTMLElement; txt: HTMLElement } => {
    const element = document.createElement("div");
    element.className = "txtcon";
    element.style.padding = "0px";
    element.innerHTML = `<div class="txtcon_txt">${html}</div>`;
    Object.defineProperty(element, "clientWidth", {value: width});
    Object.defineProperty(element, "clientHeight", {value: height});
    document.body.append(element);
    const txt = element.querySelector<HTMLElement>(".txtcon_txt");
    if (!txt) throw new Error("글자콘이 없다");
    return {box: element, txt};
};

describe("fitTxtcon", () => {
    it("넘치지 않는 가장 큰 글자로 맞춘다", () => {
        const {box: element, txt} = box("가나다", 100, 100);
        fitTxtcon(element);
        expect(txt.style.fontSize).toBe("33px");
        expect(txt.style.wordBreak).toBe("keep-all");
    });

    it("높이도 넘치지 않게 한다", () => {
        const {box: element, txt} = box("가<br>나<br>다", 100, 72);
        fitTxtcon(element);
        // 3줄 × 1.2f ≤ 72
        expect(txt.style.fontSize).toBe("20px");
    });

    it("72px을 넘기지 않는다", () => {
        const {box: element, txt} = box("가", 500, 500);
        fitTxtcon(element);
        expect(txt.style.fontSize).toBe("72px");
    });

    it("줄바꿈 태그를 줄로 바꾸고 5글자씩 나눈다", () => {
        const {box: element, txt} = box("가나다라마바<br>사", 300, 300);
        fitTxtcon(element);
        expect(txt.children).toHaveLength(1);
        expect(txt.textContent).toBe("가나다라마\n바\n사");
    });

    it("남는 폭을 자간으로 채운다", () => {
        const {box: element, txt} = box("가나다", 110, 100);
        fitTxtcon(element);
        // 36px × 3 = 108, 남는 2px을 3글자에 나눈다.
        expect(txt.style.fontSize).toBe("36px");
        expect(txt.style.letterSpacing).toBe("calc(-0.045em + 0.67px)");
        expect(txt.style.transform).toBe("translate(0.33px, -0.05em)");
    });

    it("16px로도 넘치면 끊어 쓰고 10px까지 줄인다", () => {
        const {box: element, txt} = box("가나다라마", 40, 100);
        fitTxtcon(element);
        expect(txt.style.wordBreak).toBe("break-all");
        expect(txt.style.fontSize).toBe("10px");
    });

    it("그려지지 않은 상자는 건드리지 않는다", () => {
        const element = document.createElement("div");
        element.innerHTML = "<div class=\"txtcon_txt\">가<br>나</div>";
        fitTxtcon(element);
        expect(element.innerHTML).toBe("<div class=\"txtcon_txt\">가<br>나</div>");
    });
});
