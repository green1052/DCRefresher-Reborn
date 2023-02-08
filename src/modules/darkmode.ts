import * as Color from "../utils/color";
import * as DOM from "../utils/dom";
import type { Rgb } from "../utils/color";

const DARK_MODE_COLOR: Rgb = [41, 41, 41];

const colorCorrection = (elem: HTMLElement) => {
    const fontAttr = elem.hasAttribute("color");

    const color = fontAttr ? elem.getAttribute("color") : elem.style.color;

    if (!color) return;

    const textColor = Color.parse(color);

    const contrast = Color.contrast(textColor, DARK_MODE_COLOR);

    if (contrast < 3) {
        const trans = Color.rgbToHsl(textColor[0], textColor[1], textColor[2]);
        trans[2] = Color.inverseColor(trans[2]);
        const rollback = Color.hslToRgb(trans[0], trans[1], trans[2]);

        if (fontAttr) {
            elem.setAttribute(
                "color",
                Color.rgbToHex(rollback[0], rollback[1], rollback[2])
            );
        } else {
            elem.style.color = `rgb(${rollback[0]}, ${rollback[1]}, ${rollback[2]})`;
        }
    }
};

const contentColorFix = (el: HTMLElement) => {
    if (!el) return;

    const qSelector = el.querySelector<HTMLElement>(
        ".refresher-frame:first-child .refresher-preview-contents"
    )!;

    DOM.traversal(qSelector).forEach((elem) => {
        if (
            !elem.style ||
            !(elem.style.color || elem.hasAttribute("color")) ||
            (elem.style.background &&
                elem.style.background !== "transparent") ||
            (elem.style.backgroundColor &&
                elem.style.backgroundColor !== "transparent")
        )
            return;

        colorCorrection(elem);
    });
};

export default {
    name: "다크 모드",
    description:
        "페이지와 DCRefresher Reborn의 창을 어두운 색상으로 변경합니다.",
    memory: {
        uuid: null,
        uuid2: null,
        contentViewUUID: null
    },
    enable: false,
    default_enable: false,
    require: ["filter", "eventBus"],
    func(filter: RefresherFilter, eventBus: RefresherEventBus) {
        if (
            document &&
            document.documentElement &&
            !document.documentElement.className.includes("refresherDark")
        )
            document.documentElement.classList.add("refresherDark");

        this.memory.uuid = filter.add("html", (element) => {
            element.classList.add("refresherDark");
        });

        // 다크모드는 반응성이 중요하니깐 모듈에서 바로 로드 시키기
        filter.runSpecific(this.memory.uuid!);

        this.memory.uuid2 = filter.add(
            ".gallview_contents .inner .writing_view_box *",
            (element) => {
                if (!element.style?.color || element.hasAttribute("color"))
                    return;

                colorCorrection(element);
            },
            {
                skipIfNotExists: true
            }
        );

        this.memory.contentViewUUID = eventBus.on(
            "contentPreview",
            contentColorFix
        );
    },
    revoke(filter: RefresherFilter, eventBus: RefresherEventBus) {
        document.documentElement.classList.remove("refresherDark");

        if (this.memory.uuid) filter.remove(this.memory.uuid, true);

        if (this.memory.uuid2) filter.remove(this.memory.uuid2, true);

        if (this.memory.contentViewUUID)
            eventBus.remove(
                "contentPreview",
                this.memory.contentViewUUID,
                true
            );
    }
} as RefresherModule<{
    memory: {
        uuid: string | null;
        uuid2: string | null;
        contentViewUUID: string | null;
    };
    require: ["filter", "eventBus"];
}>;
