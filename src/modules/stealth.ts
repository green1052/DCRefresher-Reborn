import browser from "webextension-polyfill";
import * as Toast from "../components/toast";

const CONTROL_BUTTON = ".stealth_control_button";
const TEMPORARY_STEALTH = "stlth";

const tempButtonCreate = (elem: HTMLElement): void => {
    const buttonNum = elem.querySelectorAll(CONTROL_BUTTON).length;
    const contentNum = elem.querySelectorAll(".write_div img, .write_div video").length;

    if (buttonNum !== 0 && contentNum === 0) return;

    const buttonFrame = document.createElement("div");
    buttonFrame.classList.add(CONTROL_BUTTON.replace(".", ""));
    buttonFrame.classList.add("blur");
    buttonFrame.innerHTML = `      
  <div class="button" id ="tempview">
    <img src="${browser.runtime.getURL("/assets/icons/change.png")}"></img>
    <p id="temp_button_text">이미지 보이기</p>
  </div>
`;
    const button = buttonFrame.querySelector("#tempview") as HTMLElement;
    const buttonText = buttonFrame.querySelector("#temp_button_text") as HTMLElement;

    button.addEventListener("click", () => {
        if (!elem.className.includes(TEMPORARY_STEALTH)) {
            elem.classList.add(TEMPORARY_STEALTH);
            buttonText.innerText = "이미지 숨기기";
        } else {
            elem.classList.remove(TEMPORARY_STEALTH);
            buttonText.innerText = "이미지 보이기";
        }
    });

    elem.prepend(buttonFrame);
};

export default {
    name: "스텔스 모드",
    description: "페이지내에서 표시되는 이미지를 비활성화합니다.",
    memory: {
        contentViewUUID: ""
    },
    enable: false,
    default_enable: false,
    require: ["eventBus"],
    shortcuts: {
        stealthPause(this: RefresherModule): void {
            const button = document.querySelector(`${CONTROL_BUTTON} > #tempview`) as HTMLElement;

            if (button === null) return;

            button.click();

            let content: string;
            if (document.documentElement.className.includes(TEMPORARY_STEALTH)) {
                content = "이미지를 보이게 했습니다.";
            } else {
                content = "이미지를 숨겼습니다.";
            }

            Toast.show(content, false, 3000);
        }
    },
    func(eventBus: RefresherEventBus): void {
        if (!document.documentElement.className.includes("refresherStealth")) {
            document.documentElement.classList.add("refresherStealth");
        }

        if (!document.querySelectorAll(CONTROL_BUTTON).length) {
            window.addEventListener("load", () => {
                tempButtonCreate(document.documentElement);
            });
        }

        this.memory.contentViewUUID = eventBus.on(
            "contentPreview",
            (elem: HTMLElement) => {
                if (!elem.querySelectorAll(CONTROL_BUTTON).length)
                    tempButtonCreate(elem);
            }
        );
    },

    revoke(eventBus: RefresherEventBus): void {
        document.documentElement.classList.remove("refresherStealth");

        const buttons = document.querySelectorAll(CONTROL_BUTTON);

        for (const button of buttons) {
            button.parentElement?.removeChild(button);
        }

        if (this.memory.contentViewUUID) {
            eventBus.remove("contentPreview", this.memory.contentViewUUID);
        }
    }
};