import eventBus from "@/core/eventbus";
import changeIcon from "@/assets/icons/change.webp?no-inline";
import toast from "@/utils/toast";

const CONTROL_BUTTON = ".stealth_control_button";
const TEMPORARY_STEALTH = "stlth";

const tempButtonCreate = (element: HTMLElement): void => {
    if (document.querySelector(CONTROL_BUTTON)) return;

    const buttonFrame = document.createElement("div");
    buttonFrame.classList.add(CONTROL_BUTTON.replace(".", ""));
    buttonFrame.classList.add("blur");
    buttonFrame.innerHTML = `      
  <div class="button" id ="tempview">
    <img src="${browser.runtime.getURL(changeIcon as never)}"></img>
    <p id="temp_button_text">이미지 보이기</p>
  </div>
`;
    const button = buttonFrame.querySelector<HTMLElement>("#tempview")!;
    const buttonText = buttonFrame.querySelector<HTMLElement>("#temp_button_text")!;

    button.addEventListener("click", () => {
        if (element.classList.contains(TEMPORARY_STEALTH)) {
            element.classList.remove(TEMPORARY_STEALTH);
            buttonText.innerText = "이미지 보이기";
        } else {
            element.classList.add(TEMPORARY_STEALTH);
            buttonText.innerText = "이미지 숨기기";
        }
    });

    element.prepend(buttonFrame);
};

export default {
    name: "스텔스 모드",
    description: "페이지내에서 표시되는 이미지를 비활성화합니다.",
    memory: {
        contentViewUUID: null,
        loadHandler: null
    },
    enable: false,
    default_enable: false,
    shortcuts: {
        stealthPause() {
            const button = document.querySelector<HTMLElement>(`${CONTROL_BUTTON} > #tempview`);

            if (!button) return;

            button.click();

            const content = document.documentElement.classList.contains(TEMPORARY_STEALTH)
                ? "이미지를 보이게 했습니다."
                : "이미지를 숨겼습니다.";

            toast.show(content, "info");
        }
    },
    func() {
        document.documentElement.classList.add("refresherStealth");

        if (!document.querySelector(CONTROL_BUTTON)) {
            if (document.readyState === "complete") {
                tempButtonCreate(document.documentElement);
            } else {
                this.memory.loadHandler = () => {
                    tempButtonCreate(document.documentElement);
                    this.memory.loadHandler = null;
                };
                window.addEventListener("load", this.memory.loadHandler, {once: true});
            }
        }

        this.memory.contentViewUUID = eventBus.on("contentPreview", (elem) => {
            if (!document.querySelector(CONTROL_BUTTON)) tempButtonCreate(elem);
        });
    },
    revoke() {
        document.documentElement.classList.remove("refresherStealth");

        for (const button of document.querySelectorAll(CONTROL_BUTTON)) {
            button.remove();
        }

        if (this.memory.contentViewUUID !== null) {
            this.memory.contentViewUUID();
            this.memory.contentViewUUID = null;
        }

        if (this.memory.loadHandler) {
            window.removeEventListener("load", this.memory.loadHandler);
            this.memory.loadHandler = null;
        }
    }
} as RefresherModule<{
    data: {};
    memory: {
        contentViewUUID: (() => void) | null;
        loadHandler: (() => void) | null;
    };
    shortcuts: {
        stealthPause(): void;
    };
}>;