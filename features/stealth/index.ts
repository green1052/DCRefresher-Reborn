import type {ModuleContext, ModuleDefinition} from "@/core/module/types";
import {useUiStore} from "@/stores/ui";

const CONTROL_BUTTON = ".stealth_control_button";
const TEMPORARY_STEALTH = "stlth";

const EYE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

// 버튼 마운트 위치일 뿐이고, stlth 토글 상태는 CSS가 보는 documentElement에 있어야 한다.
const tempButtonCreate = (mount: HTMLElement): void => {
    if (document.querySelector(CONTROL_BUTTON)) return;

    const buttonFrame = document.createElement("div");
    buttonFrame.classList.add(CONTROL_BUTTON.replace(".", ""));
    buttonFrame.classList.add("blur");
    buttonFrame.innerHTML = `
  <div class="button" id="tempview">
    ${EYE_SVG}
    <p id="temp_button_text">이미지 숨기기</p>
  </div>
`;
    const button = buttonFrame.querySelector<HTMLElement>("#tempview");
    const buttonText = buttonFrame.querySelector<HTMLElement>("#temp_button_text");

    button?.addEventListener("click", () => {
        const shown = document.documentElement.classList.toggle(TEMPORARY_STEALTH);
        if (buttonText) buttonText.innerText = shown ? "이미지 보이기" : "이미지 숨기기";
    });

    mount.prepend(buttonFrame);
};

const stealthModule: ModuleDefinition = {
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

        if (document.readyState === "complete") {
            tempButtonCreate(document.documentElement);
        } else {
            const onLoad = (): void => tempButtonCreate(document.documentElement);
            window.addEventListener("load", onLoad, {once: true});
            ctx.addCleanup(() => window.removeEventListener("load", onLoad));
        }

        // v6: 오버레이(#dcr-root)가 React 루트로 영속 마운트되므로 contentPreview 재마운트는 불필요
    },

    revoke() {
        document.documentElement.classList.remove("refresherStealth", TEMPORARY_STEALTH);

        for (const element of document.querySelectorAll<HTMLElement>(CONTROL_BUTTON)) {
            element.remove();
        }
    }
};

export default stealthModule;
