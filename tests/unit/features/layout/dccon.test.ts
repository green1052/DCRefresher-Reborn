// @vitest-environment-options {"url": "https://dccon.dcinside.com/"}
import {expect, it} from "vitest";

import layout from "@/features/layout/index";

import {runModule} from "../module";

it("디시콘 샵에서는 컴팩트 모드를 강제로 켜도 바꾸지 않는다", async () => {
    const running = await runModule(layout, {forceCompact: true});
    expect(document.documentElement.classList.contains("refresherCompact")).toBe(false);
    running.stop();
});
