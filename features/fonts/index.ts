import {defineModule} from "@/core/module/define";
import type {ModuleContext} from "@/core/module/types";

const DEFAULT_FONTS = "Noto Sans CJK KR, NanumGothic";

// "디시인사이드 폰트 교체"가 켜졌을 때 폰트를 바꿀 디시 요소.
// :root 접두사는 디시 규칙보다 우선하도록 명시도를 한 단계 올리는 용도
const DC_FONT_TARGETS = ["body", "button", "input", ".gall_list", ".view_content_wrap", ".view_comment div", ".btn_cmt_open", ".btn_cmt_close"]
    .map((selector) => `:root ${selector}`)
    .join(", ");

/** "A, B" → `"A", "B", sans-serif` — 이름마다 따옴표로 감싸 CSS로 새어나가지 않게 한다 */
const toFontFamily = (value: string): string =>
    [
        ...value
            .split(",")
            .map((font) => font.trim())
            .filter(Boolean)
            .map((font) => `"${font.replace(/["\\]/g, "\\$&")}"`),
        "sans-serif"
    ].join(", ");

/** customFonts 설정값 → font-family (빈칸이면 기본 폰트). 옵션 페이지도 같은 값을 쓴다 */
export const fontFamilyOf = (customFonts: string): string => toFontFamily(customFonts.trim() || DEFAULT_FONTS);

const buildCss = (ctx: ModuleContext): string => {
    const fonts = fontFamilyOf(String(ctx.settings.customFonts));
    const size = Number(ctx.settings.bodyFontSize);

    // 확장 UI(shadow DOM)엔 선택자가 닿지 않으므로 상속되는 커스텀 속성으로 넘긴다 (overlay.scss에서 사용)
    const css = [`:root { --refresher-font: ${fonts}; --refresher-preview-font-size: ${size + 2}px; }`];

    if (ctx.settings.changeDCFont === true) {
        css.push(`${DC_FONT_TARGETS} { font-family: ${fonts}; }`, `:root .write_div { font-size: ${size}px; }`);
    }

    return css.join("\n");
};

let style: HTMLStyleElement | null = null;

// 콘텐츠 스크립트는 document_start에 돌아 head가 없을 수 있으므로 <html>에 붙인다
const apply = (ctx: ModuleContext): void => {
    style ??= document.documentElement.appendChild(document.createElement("style"));
    style.textContent = buildCss(ctx);
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
            desc: "쉼표로 구분한 폰트 이름입니다. 앞의 폰트가 없으면 다음 폰트를 씁니다. (빈칸이면 기본 폰트)",
            default: DEFAULT_FONTS
        },
        changeDCFont: {
            type: "check",
            name: "디시인사이드 폰트 교체",
            desc: "미리보기 창 같은 DCRefresher Reborn의 폰트뿐만 아니라 디시인사이드의 폰트와 본문 크기까지 바꿉니다.",
            default: true
        },
        bodyFontSize: {
            type: "range",
            name: "본문 폰트 크기",
            desc: "게시글 본문의 폰트 크기입니다. 미리보기 창은 +2px로 표시됩니다.",
            default: 13,
            min: 5,
            max: 30,
            step: 1,
            unit: "px"
        }
    },

    setup: apply,
    onChanged: apply,

    revoke() {
        style?.remove();
        style = null;
    }
});
