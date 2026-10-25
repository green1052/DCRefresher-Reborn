import {defineModule} from "@/core/module/define";
import {useUiStore} from "@/stores/ui";

import meta from "./meta";

const CONTROL_BUTTON = ".stealth_control_button";
const TEMPORARY_STEALTH = "stlth";

// 토글 상태는 CSS가 보는 <html>의 stlth 클래스 하나뿐이다. 버튼·단축키·팝업이 같이 읽는다.
const isRevealed = (): boolean => document.documentElement.classList.contains(TEMPORARY_STEALTH);

// 눈 아이콘(lucide-react 1.61의 eye·eye-off). 문구 하나·아이콘 하나짜리 버튼에 react-dom을 끌어들이지 않게 여기는 React 없이 그린다.
const icon = (name: "eye" | "eye-off", paths: string): string =>
    `<svg data-icon="${name}" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const EYE = icon("eye", `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>`);
const EYE_OFF = icon("eye-off", `<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>`);

/** 버튼 문구·아이콘은 현재 상태가 아니라 누르면 할 동작을 보인다. */
const render = (button: HTMLElement): void => {
    const shown = isRevealed();
    const label = Object.assign(document.createElement("span"), {textContent: shown ? "이미지 숨기기" : "이미지 보이기"});
    button.replaceChildren(label);
    button.insertAdjacentHTML("beforeend", shown ? EYE_OFF : EYE);
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

export default defineModule(meta, {
    setup(ctx) {
        ctx.onRevoke(() => {
            document.documentElement.classList.remove("refresherStealth", TEMPORARY_STEALTH);

            for (const element of document.querySelectorAll(CONTROL_BUTTON)) element.remove();
        });

        document.documentElement.classList.add("refresherStealth");

        // 광고까지 다 받는 load를 기다리면 한참 늦으므로 body가 생기자마자 만든다.
        if (document.body) {
            createButton();
        } else {
            document.addEventListener("DOMContentLoaded", createButton, {once: true, signal: ctx.signal});
        }

        return {isRevealed, toggle};
    },

    shortcuts: {
        stealthPause: (api) => {
            api.toggle();
            useUiStore.getState().showToast(api.isRevealed() ? "이미지를 보이게 했습니다." : "이미지를 숨겼습니다.");
        }
    },

    pageToggles: {
        reveal: {
            desc: "스텔스로 숨긴 이미지를 보입니다",
            isOn: (api) => api.isRevealed(),
            toggle: (api) => api.toggle()
        }
    }
});
