import {defineModule} from "@/core/module/define";
import {writeStyle} from "@/utils/dom";

import meta, {type Ctx, fontFamilyOf} from "./meta";

// "디시인사이드 폰트 교체"가 켜졌을 때 폰트를 바꿀 디시 요소.
// :root 접두사는 명시도를 올려 디시 규칙을 이기려는 것이다.
const DC_FONT_TARGETS = ["body", "button", "input", "textarea", "select", ".gall_list", ".view_content_wrap", ".view_comment div", ".btn_cmt_open", ".btn_cmt_close"]
    .map((selector) => `:root ${selector}`)
    .join(", ");

const buildCss = (ctx: Ctx): string => {
    const fonts = fontFamilyOf(ctx.settings.customFonts);
    const size = ctx.settings.bodyFontSize;

    // 확장 UI(shadow DOM)엔 선택자가 닿지 않으므로 상속되는 커스텀 속성으로 넘긴다 (assets/styles/tailwind.css, features/preview/overlay.css).
    const css = [`:root { --refresher-font: ${fonts}; --refresher-preview-font-size: ${size + 2}px; }`];

    if (ctx.settings.changeDCFont) {
        css.push(`${DC_FONT_TARGETS} { font-family: ${fonts}; }`, `:root .write_div { font-size: ${size}px; }`);
    }

    return css.join("\n");
};

const STYLE_ID = "refresher-fonts";

const apply = (ctx: Ctx): void => writeStyle(STYLE_ID, buildCss(ctx));

export default defineModule({
    ...meta,

    setup(ctx) {
        apply(ctx);
        ctx.onSettingsChanged(() => apply(ctx));
    },

    revoke() {
        document.querySelector(`style#${STYLE_ID}`)?.remove();
    }
});
