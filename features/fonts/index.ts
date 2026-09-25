import {defineModule} from "@/core/module/define";
import type {ModuleContext} from "@/core/module/types";

const FONT_STYLE_ID = "refresherFontStyle";
const FONT_SIZE_STYLE_ID = "refresherFontStyleSize";

const DEFAULT_FONTS = "Noto Sans CJK KR, NanumGothic";

// DC 본체 셀렉터 + 확장 UI. changeDCFont가 켜져야 DC측 규칙이 적용된다.
const DC_FONT_TARGETS =
    ".refresherChangeDCFont .btn_cmt_close, .refresherChangeDCFont .btn_cmt_open, .refresherChangeDCFont .gall_list, .refresherChangeDCFont .view_comment div, .refresherChangeDCFont .view_content_wrap, .refresherChangeDCFont body, .refresherChangeDCFont button, .refresherChangeDCFont input";

const placeStyle = (id: string, css: string): void => {
    let style = document.head.querySelector<HTMLStyleElement>(`#${id}`);

    if (!style) {
        style = document.createElement("style");
        style.id = id;
        document.head.append(style);
    }

    style.textContent = css;
};

const removeStyle = (id: string): void => {
    document.head.querySelector(`#${id}`)?.remove();
};

const quoteFonts = (value: string): string =>
    value
        .split(",")
        .map((font) => `"${font.trim().replace(/"/g, "\\\"")}"`)
        .filter(Boolean)
        .join(", ");

// 모든 규칙이 상호 의존(커스텀폰트는 changeDCFont 켜짐 여부)하므로 변경시 전부 재적용
const applyAll = (ctx: ModuleContext): void => {
    const raw = String(ctx.settings.customFonts ?? "").trim() || DEFAULT_FONTS;
    const enabled = ctx.settings.changeDCFont === true;
    const fonts = `${quoteFonts(raw)}, sans-serif`;
    const size = Number(ctx.settings.bodyFontSize);

    document.documentElement.classList.toggle("refresherChangeDCFont", enabled);
    // 확장 UI는 shadow DOM이라 셀렉터가 안 닿는다 — 상속되는 커스텀 속성으로 넘긴다 (overlay.scss에서 사용)
    placeStyle(
        FONT_STYLE_ID,
        `.refresherFont { --refresher-font: ${fonts}; }` + (enabled ? `\n${DC_FONT_TARGETS} { font-family: ${fonts}; }` : "")
    );
    placeStyle(
        FONT_SIZE_STYLE_ID,
        `.refresherChangeDCFont .write_div { font-size: ${size}px; }
        .refresherFont { --refresher-preview-font-size: ${size + 2}px; }`
    );
};

export default defineModule({
    id: "fonts",
    name: "폰트 교체",
    description: "페이지에 전반적으로 표시되는 폰트를 교체합니다.",
    defaultEnable: true,

    settings: {
        customFonts: {
            type: "text",
            name: "font-family 이름",
            desc: "페이지 폰트를 입력된 폰트로 교체합니다. (빈칸으로 둘 시 확장 프로그램 기본 폰트로 설정)",
            default: DEFAULT_FONTS
        },
        changeDCFont: {
            type: "check",
            name: "디시인사이드 폰트 교체",
            desc: "미리보기 창 같은 DCRefresher Reborn의 폰트 뿐만 아니라 디시인사이드의 폰트까지 교체합니다.",
            default: true
        },
        bodyFontSize: {
            type: "range",
            name: "본문 폰트 크기 지정",
            desc: "본문의 기본 폰트 크기를 조정합니다. (미리보기 창은 + 2pt)",
            default: 13,
            min: 5,
            max: 30,
            step: 1,
            unit: "pt"
        }
    },

    setup(ctx) {
        document.documentElement.classList.add("refresherFont");

        applyAll(ctx);
    },

    onChanged(ctx) {
        applyAll(ctx);
    },

    revoke() {
        document.documentElement.classList.remove("refresherFont", "refresherChangeDCFont");
        removeStyle(FONT_STYLE_ID);
        removeStyle(FONT_SIZE_STYLE_ID);
    }
});
