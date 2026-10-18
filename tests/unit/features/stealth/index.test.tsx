// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {expect, it, vi} from "vitest";

import stealth from "@/features/stealth/index";

import {runModule} from "../module";

// lucide는 변환되지 않아 진짜 React를 불러 그려지지 않으므로 어느 아이콘을 골랐는지만 보이는 요소로 바꾼다.
vi.mock("lucide-react", () => ({Eye: () => <svg data-icon="eye"/>, EyeOff: () => <svg data-icon="eye-off"/>, Image: () => null}));

it("버튼은 lucide 눈 아이콘을 그리고, 누르면 문구와 아이콘이 함께 바뀐다", async () => {
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
