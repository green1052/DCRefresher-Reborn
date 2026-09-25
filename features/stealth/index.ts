import {defineModule} from "@/core/module/define";
import {eventBus} from "@/core/eventbus/bus";
import {useUiStore} from "@/stores/ui";

const CONTROL_BUTTON = ".stealth_control_button";
const TEMPORARY_STEALTH = "stlth";

const svg = (paths: string): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

// lucide eye / eye-off
const EYE_SVG = svg("<path d=\"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>");
const EYE_OFF_SVG = svg(
    "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"/><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"/><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"/><path d=\"m2 2 20 20\"/>"
);

/** 버튼 문구·아이콘은 누르면 할 동작 */
const render = (button: HTMLElement): void => {
    const shown = document.documentElement.classList.contains(TEMPORARY_STEALTH);
    button.innerHTML = `<p>${shown ? "이미지 숨기기" : "이미지 보이기"}</p>${shown ? EYE_OFF_SVG : EYE_SVG}`;
};

// stlth 토글 상태는 CSS가 보는 documentElement에 둔다
const createButton = (): void => {
    if (document.querySelector(CONTROL_BUTTON)) return;

    const frame = document.createElement("div");
    frame.className = CONTROL_BUTTON.slice(1);

    const button = document.createElement("div");
    button.className = "button";
    button.id = "tempview";
    render(button);
    button.addEventListener("click", () => {
        document.documentElement.classList.toggle(TEMPORARY_STEALTH);
        render(button);
    });

    frame.append(button);
    document.body.append(frame);
};

export default defineModule({
    id: "stealth",
    name: "스텔스 모드",
    description: "페이지내에서 표시되는 이미지를 비활성화합니다.",
    defaultEnable: false,

    shortcuts: {
        stealthPause: () => {
            const button = document.querySelector<HTMLElement>(`${CONTROL_BUTTON} > #tempview`);
            if (!button) return;

            button.click();

            useUiStore
                .getState()
                .showToast(
                    document.documentElement.classList.contains(TEMPORARY_STEALTH) ? "이미지를 보이게 했습니다." : "이미지를 숨겼습니다."
                );
        }
    },

    setup(ctx) {
        document.documentElement.classList.add("refresherStealth");

        // 광고까지 다 받는 load를 기다리면 한참 늦으므로 body가 생기자마자 만든다
        if (document.body) {
            createButton();
        } else {
            document.addEventListener("DOMContentLoaded", createButton, {once: true});
            ctx.addCleanup(() => document.removeEventListener("DOMContentLoaded", createButton));
        }

        // DC는 목록을 갈아끼우므로 버튼이 사라졌으면 다시 만든다
        const offNewPostList = eventBus.on("newPostList", () => {
            if (document.body) createButton();
        });
        ctx.addCleanup(() => void offNewPostList());
    },

    revoke() {
        document.documentElement.classList.remove("refresherStealth", TEMPORARY_STEALTH);

        for (const element of document.querySelectorAll<HTMLElement>(CONTROL_BUTTON)) {
            element.remove();
        }
    }
});
