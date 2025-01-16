import * as Toast from "../components/toast";
import $ from "cash-dom";
import browser from "webextension-polyfill";
import {getURL} from "../utils/getURL";

const CONTROL_BUTTON = ".stealth_control_button";
const TEMPORARY_STEALTH = "stlth";

const tempButtonCreate = (element: HTMLElement): void => {
    const $element = $(element);

    const buttonNum = $(CONTROL_BUTTON).length;
    const contentNum = $(".write_div img, .write_div video").length;

    if (buttonNum !== 0 && contentNum === 0) return;

    const buttonFrame = document.createElement("div");
    buttonFrame.classList.add(CONTROL_BUTTON.replace(".", ""));
    buttonFrame.classList.add("blur");
    buttonFrame.innerHTML = `      
  <div class="button" id ="tempview">
    <img src="${getURL("/assets/icons/change.webp")}"></img>
    <p id="temp_button_text">이미지 보이기</p>
  </div>
`;
    const button = buttonFrame.querySelector("#tempview")!;
    const buttonText =
        buttonFrame.querySelector<HTMLElement>("#temp_button_text")!;

    button.addEventListener("click", () => {
        if ($element.hasClass(TEMPORARY_STEALTH)) {
            $element.removeClass(TEMPORARY_STEALTH);
            buttonText.innerText = "이미지 보이기";
        } else {
            $element.addClass(TEMPORARY_STEALTH);
            buttonText.innerText = "이미지 숨기기";
        }
    });

    $element.prepend(buttonFrame);
};

export default {
    name: "스텔스 모드",
    description: "페이지내에서 표시되는 이미지를 비활성화합니다.",
    memory: {
        contentViewUUID: null
    },
    enable: false,
    default_enable: false,
    shortcuts: {
        stealthPause() {
            const button = $(`${CONTROL_BUTTON} > #tempview`);

            if (!button.length) return;

            button.get(0)!.click();

            const content = $(document.documentElement).hasClass(
                TEMPORARY_STEALTH
            )
                ? "이미지를 보이게 했습니다."
                : "이미지를 숨겼습니다.";

            Toast.show(content, false, 3000);
        }
    },
    require: ["eventBus"],
    func(eventBus) {
        $(document.documentElement).addClass("refresherStealth");

        if (!$(CONTROL_BUTTON).length) {
            window.addEventListener("load", () => {
                tempButtonCreate(document.documentElement);
            });
        }

        this.memory.contentViewUUID = eventBus.on(
            "contentPreview",
            (elem: HTMLElement) => {
                if (!$(CONTROL_BUTTON).length) tempButtonCreate(elem);
            }
        );
    },
    revoke(eventBus) {
        $(document.documentElement).removeClass("refresherStealth");

        for (const button of $(CONTROL_BUTTON)) {
            $(button).remove();
        }

        if (this.memory.contentViewUUID !== null) {
            eventBus.remove("contentPreview", this.memory.contentViewUUID);
        }
    }
} as RefresherModule<{
    memory: {
        contentViewUUID: string | null;
    };
    shortcuts: {
        stealthPause(): void;
    };
    require: ["eventBus"];
}>;
