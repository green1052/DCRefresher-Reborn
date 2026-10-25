// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {expect, it} from "vitest";

import stealth from "@/features/stealth/index";

import {runModule} from "../module";

it("버튼은 눈 아이콘을 그리고, 누르면 문구와 아이콘이 함께 바뀐다", async () => {
    const running = await runModule(stealth);
    const button = document.querySelector<HTMLButtonElement>(".stealth_control_button > #tempview")!;
    const icons = (): string[] => [...button.querySelectorAll("svg")].map((svg) => svg.dataset.icon ?? "");
    expect(button.textContent).toBe("이미지 보이기");
    expect(icons()).toEqual(["eye"]);

    button.click();
    expect(button.textContent).toBe("이미지 숨기기");
    expect(icons()).toEqual(["eye-off"]);

    running.stop();
});
