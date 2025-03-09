import type { Rgb } from "../utils/color";
import * as Color from "../utils/color";
import * as DOM from "../utils/dom";
import $ from "cash-dom";

const DARK_MODE_COLOR: Rgb = [41, 41, 41];

const colorCorrection = (element: HTMLElement) => {
    const $element = $(element);

    const fontAttr = $element.attr("color");

    const color = fontAttr ? fontAttr : $element.css("color");

    if (!color) return;

    const textColor = Color.parse(color);

    const contrast = Color.contrast(textColor, DARK_MODE_COLOR);

    if (contrast < 3) {
        const trans = Color.rgbToHsl([textColor[0], textColor[1], textColor[2]]);
        trans[2] = Color.inverseColor(trans[2]);
        const rollback = Color.hslToRgb([trans[0], trans[1], trans[2]]);

        if (fontAttr) {
            $element.attr("color", Color.rgbToHex(rollback[0], rollback[1], rollback[2]));
        } else {
            $element.css("color", Color.rgbToHex(rollback[0], rollback[1], rollback[2]));
        }
    }
};

const contentColorFix = (element: HTMLElement) => {
    if (!element) return;

    const $element = $(element);

    const qSelector = element.querySelector<HTMLElement>(
        ".refresher-frame:first-child .refresher-preview-contents"
    )!;

    for (const elem of DOM.traversal(qSelector)) {
        const $elem = $(elem);

        if (
            !($elem.css("style") || $elem.attr("color")) ||
            $elem.css("background") !== "transparent" ||
            $elem.css("backgroundColor") !== "transparent"
        )
            continue;

        colorCorrection(elem);
    }
};

export default {
    name: "다크 모드",
    description: "페이지와 DCRefresher Reborn의 창을 어두운 색상으로 변경합니다.",
    memory: {
        uuid: null,
        uuid2: null,
        contentViewUUID: null
    },
    enable: false,
    default_enable: false,
    require: ["filter", "eventBus"],
    func(filter, eventBus) {
        $(document.documentElement).addClass("refresherDark");

        this.memory.uuid = filter.add("html", (element) => {
            $(element).addClass("refresherDark");
        });

        // 다크모드는 반응성이 중요하니깐 모듈에서 바로 로드 시키기
        filter.runSpecific(this.memory.uuid!);

        this.memory.uuid2 = filter.add(
            ".gallview_contents .inner .writing_view_box *",
            (element) => {
                const $element = $(element);

                if ($element.css("style") || $element.attr("color")) return;

                colorCorrection(element);
            },
            {
                skipIfNotExists: true
            }
        );

        this.memory.contentViewUUID = eventBus.on("contentPreview", contentColorFix);
    },
    revoke(filter, eventBus) {
        document.documentElement.classList.remove("refresherDark");

        if (this.memory.uuid) filter.remove(this.memory.uuid, true);

        if (this.memory.uuid2) filter.remove(this.memory.uuid2, true);

        if (this.memory.contentViewUUID)
            eventBus.remove("contentPreview", this.memory.contentViewUUID, true);
    }
} as RefresherModule<{
    memory: {
        uuid: string | null;
        uuid2: string | null;
        contentViewUUID: string | null;
    };
    require: ["filter", "eventBus"];
}>;
