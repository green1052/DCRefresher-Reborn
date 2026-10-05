import {afterEach, expect, it} from "vitest";

import fonts from "@/features/fonts/index";

import {type Running, runModule} from "../module";

let running: Running<void> | undefined;

afterEach(() => {
    running?.stop();
    running = undefined;
});

const css = (): string | null | undefined => document.querySelector("style#refresher-fonts")?.textContent;

it("폰트 변수와 디시 폰트·본문 크기 규칙을 쓴다", async () => {
    running = await runModule(fonts, {customFonts: "A", bodyFontSize: 15});
    expect(css()).toContain(":root { --refresher-font: \"A\", sans-serif; --refresher-preview-font-size: 17px; }");
    expect(css()).toContain(":root body, :root button");
    expect(css()).toContain(":root .write_div { font-size: 15px; }");
});

it("디시 폰트 교체를 끄면 변수만 쓰고, 설정이 바뀌면 다시 쓴다", async () => {
    running = await runModule(fonts, {changeDCFont: false});
    expect(css()).not.toContain(".write_div");

    running.change({changeDCFont: true, customFonts: "B"});
    expect(css()).toContain("font-family: \"B\", sans-serif;");
    expect(document.querySelectorAll("style#refresher-fonts")).toHaveLength(1);
});

it("모듈을 끄면 style을 뗀다", async () => {
    running = await runModule(fonts);
    running.stop();
    running = undefined;
    expect(document.querySelector("style#refresher-fonts")).toBeNull();
});
