import {afterEach, beforeEach, expect, it} from "vitest";

import stealth from "@/features/stealth/index";
import {useUiStore} from "@/stores/ui";

import {type Running, runModule} from "../module";

let running: Running<{ isRevealed(): boolean; toggle(): void }> | undefined;
const root = document.documentElement;
const button = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>(".stealth_control_button > #tempview")!;

beforeEach(() => {
    document.body.innerHTML = "";
    useUiStore.setState({toasts: []});
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

it("켜면 숨기고 버튼으로 잠시 보인다", async () => {
    running = await runModule(stealth);
    expect(root.classList.contains("refresherStealth")).toBe(true);
    expect(button().textContent).toBe("이미지 보이기");
    // 미리보기가 뒤 페이지를 inert로 막아도 남긴다.
    expect(button().parentElement?.hasAttribute("data-refresher-ui")).toBe(true);

    button().click();
    expect(running.api.isRevealed()).toBe(true);
    expect(root.classList.contains("stlth")).toBe(true);
    expect(button().textContent).toBe("이미지 숨기기");
});

it("죽은 인스턴스의 버튼은 갈아끼운다", async () => {
    document.body.innerHTML = "<div class=\"stealth_control_button\"><button id=\"tempview\">옛</button></div>";
    running = await runModule(stealth);
    expect(document.querySelectorAll(".stealth_control_button")).toHaveLength(1);
    expect(button().textContent).toBe("이미지 보이기");
});

it("단축키는 토글하고 알린다", async () => {
    running = await runModule(stealth);
    await stealth.shortcuts?.stealthPause?.(running.ctx, running.api);
    expect(running.api.isRevealed()).toBe(true);
    expect(useUiStore.getState().toasts.at(-1)?.content).toBe("이미지를 보이게 했습니다.");
});

it("끄면 클래스와 버튼을 뗀다", async () => {
    running = await runModule(stealth);
    running.api.toggle();
    running.stop();
    running = undefined;
    expect(root.classList.contains("refresherStealth")).toBe(false);
    expect(root.classList.contains("stlth")).toBe(false);
    expect(document.querySelector(".stealth_control_button")).toBeNull();
});
