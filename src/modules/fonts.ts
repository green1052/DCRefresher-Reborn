import $ from "cash-dom";

export default {
    name: "폰트 교체",
    description: "페이지에 전반적으로 표시되는 폰트를 교체합니다.",
    status: {},
    memory: {
        uuid: null
    },
    enable: true,
    default_enable: true,
    settings: {
        customFonts: {
            name: "font-family 이름",
            desc: "페이지 폰트를 입력된 폰트로 교체합니다. (빈칸으로 둘 시 확장 프로그램 기본 폰트로 설정)",
            type: "text",
            default: "Noto Sans CJK KR, NanumGothic"
        },
        changeDCFont: {
            name: "디시인사이드 폰트 교체",
            desc: "미리보기 창 같은 DCRefresher Reborn의 폰트 뿐만 아니라 디시인사이드의 폰트까지 교체합니다.",
            type: "check",
            default: true
        },
        bodyFontSize: {
            name: "본문 폰트 크기 지정",
            desc: "본문의 기본 폰트 크기를 조정합니다. (미리보기 창은 + 2pt)",
            type: "range",
            default: 13,
            min: 5,
            max: 30,
            step: 1,
            unit: "pt"
        }
    },
    update: {
        customFonts(fontName) {
            fontName ??= this.settings.customFonts.default;

            let $fontElement = $("#refresherFontStyle");

            if (!$fontElement.length) {
                $fontElement = $("<style id=refresherFontStyle>");
                $(document.head).append($fontElement);
            }

            $fontElement.html(
                `.refresherChangeDCFont,.refresherChangeDCFont .btn_cmt_close,.refresherChangeDCFont .btn_cmt_close span,.refresherChangeDCFont .btn_cmt_open,.refresherChangeDCFont .btn_cmt_refresh,.refresherChangeDCFont .gall_list,.refresherChangeDCFont .view_comment div,.refresherChangeDCFont .view_content_wrap,.refresherChangeDCFont .view_content_wrap a,.refresherChangeDCFont body,.refresherChangeDCFont button,.refresherChangeDCFont input,.refresherFont .refresher-block-popup,.refresherFont .refresher-captcha-popup,.refresherFont .refresher-frame,.refresherFont .refresher-popup{font-family:${fontName},sans-serif}`
            );
        },
        changeDCFont(value) {
            $(document.documentElement).toggleClass("refresherChangeDCFont", value);
        },
        bodyFontSize(fontSize) {
            let $fontElement = $("#refresherFontStyleSize");

            if (!$fontElement.length) {
                $fontElement = $("<style id=refresherFontStyleSize>");
                document.head.appendChild($fontElement.get(0)!);
            }

            $fontElement.html(
                `.refresherChangeDCFont .write_div{font-size:${fontSize}px}.refresherFont .refresher-preview-contents-actual,.refresherFont .refresher-preview-contents-actual .write_div{font-size:${fontSize + 2}px}`
            );
        }
    },
    func() {
        $(document.documentElement).addClass("refresherFont");

        // @ts-ignore
        this.update.changeDCFont.bind(this)(this.status.changeDCFont);
        // @ts-ignore
        this.update.customFonts.bind(this)(this.status.customFonts);
        // @ts-ignore
        this.update.bodyFontSize.bind(this)(this.status.bodyFontSize);
    },
    revoke() {
        $(document.documentElement).removeClass("refresherFont");

        // @ts-ignore
        this.update.changeDCFont.bind(this)(false);
        // @ts-ignore
        this.update.customFonts.bind(this)(false);
        // @ts-ignore
        this.update.bodyFontSize.bind(this)(false);
    }
} as RefresherModule<{
    memory: {
        uuid: string | null;
    };
    settings: {
        customFonts: RefresherTextSettings;
        changeDCFont: RefresherCheckSettings;
        bodyFontSize: RefresherRangeSettings;
    };
}>;
