import {Eye, EyeOff} from "lucide-react";
import {render as mount} from "preact";
import {createElement} from "react";

import {defineModule} from "@/core/module/define";
import {useUiStore} from "@/stores/ui";

import meta, {REVEAL_TOGGLE} from "./meta";

const CONTROL_BUTTON = ".stealth_control_button";
const TEMPORARY_STEALTH = "stlth";

interface StealthApi {
    isRevealed(): boolean;

    toggle(): void;
}

// 토글 상태는 CSS가 보는 <html>의 stlth 클래스 하나뿐이다. 버튼·단축키·팝업이 같이 읽는다.
const isRevealed = (): boolean => document.documentElement.classList.contains(TEMPORARY_STEALTH);

/** 버튼 문구·아이콘은 현재 상태가 아니라 누르면 할 동작을 보인다. */
const render = (button: HTMLElement): void => {
    const shown = isRevealed();
    // .ts여야 features/index.ts의 ./*/index.ts glob에 잡히므로 JSX 대신 createElement로 그린다.
    mount([createElement("span", null, shown ? "이미지 숨기기" : "이미지 보이기"), createElement(shown ? EyeOff : Eye, {size: 22})], button);
};

const toggle = (): void => {
    document.documentElement.classList.toggle(TEMPORARY_STEALTH);

    const button = document.querySelector<HTMLElement>(`${CONTROL_BUTTON} > #tempview`);
    if (button) render(button);
};

const createButton = (): void => {
    // 죽은 인스턴스(파이어폭스 재주입)가 남긴 버튼은 리스너가 없어 갈아끼운다.
    for (const element of document.querySelectorAll(CONTROL_BUTTON)) element.remove();

    const frame = Object.assign(document.createElement("div"), {className: CONTROL_BUTTON.slice(1)});
    // 미리보기가 뒤 페이지를 inert로 막을 때 이 버튼은 남긴다 (preview/ui/Frame.tsx).
    frame.dataset.refresherUi = "";

    // 키보드로도 누를 수 있게 button으로 만든다.
    const button = Object.assign(document.createElement("button"), {type: "button", className: "button", id: "tempview"});
    render(button);
    button.addEventListener("click", toggle);

    frame.append(button);
    document.body.append(frame);
};

export default defineModule({
    ...meta,

    setup(ctx) {
        document.documentElement.classList.add("refresherStealth");

        // 광고까지 다 받는 load를 기다리면 한참 늦으므로 body가 생기자마자 만든다.
        if (document.body) {
            createButton();
        } else {
            document.addEventListener("DOMContentLoaded", createButton, {once: true, signal: ctx.signal});
        }

        const api: StealthApi = {isRevealed, toggle};
        return api;
    },

    shortcuts: {
        stealthPause: (_ctx, api) => {
            api.toggle();
            useUiStore.getState().showToast(api.isRevealed() ? "이미지를 보이게 했습니다." : "이미지를 숨겼습니다.");
        }
    },

    pageToggles: [{
        ...REVEAL_TOGGLE,
        desc: "스텔스로 숨긴 이미지를 보입니다",
        isOn: (api) => api.isRevealed(),
        toggle: (api) => api.toggle()
    }],

    revoke() {
        document.documentElement.classList.remove("refresherStealth", TEMPORARY_STEALTH);

        for (const element of document.querySelectorAll(CONTROL_BUTTON)) element.remove();
    }
});
