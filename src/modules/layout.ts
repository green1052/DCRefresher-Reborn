import $ from "cash-dom";

const hideSticky = (hide: boolean) => {
    $(".stickyunit").css("display", hide ? "none" : "initial");
};

const updateWindowSize = (forceActive: boolean, active: number | string, width: number) => {
    if (typeof active === "string") active = Number(active);

    const $document = $(document.documentElement);

    const isView = location.href.includes("board/view");

    if (forceActive || active >= width) {
        hideSticky(true);

        if (!$document.hasClass("refresherCompact")) {
            if (isView) $document.addClass("refresherCompactView");

            $document.addClass("refresherCompact");
        }
    } else {
        hideSticky(false);
        $document.removeClass("refresherCompact");
    }
};

export default {
    name: "레이아웃 수정",
    description: "디시 레이아웃을 변경할 수 있도록 도와줍니다.",
    status: {},
    memory: {
        resize: null
    },
    enable: true,
    default_enable: true,
    settings: {
        activePixel: {
            name: "컴팩트 모드 활성화 조건",
            desc: "브라우저 가로가 이 값 보다 작을 경우 컴팩트 모드를 활성화합니다.",
            type: "range",
            default: 900,
            min: 100,
            max: screen.width,
            step: 1,
            unit: "px",
            value: 1
        },
        forceCompact: {
            name: "컴팩트 모드 강제 사용",
            desc: "항상 컴팩트 모드를 사용하도록 설정합니다.",
            type: "check",
            default: false
        },
        useCompactModeOnView: {
            name: "컴팩트 모드 강제 사용",
            desc: "게시글 보기에서도 컴팩트 모드를 사용하도록 설정합니다.",
            type: "check",
            default: true
        },
        hideGalleryView: {
            name: "갤러리 뷰 숨기기",
            desc: "갤러리 정보, 최근 방문 갤러리 영역을 숨깁니다.",
            type: "check",
            default: false
        },
        hideUselessView: {
            name: "잡다 링크 숨기기",
            desc: "이슈줌, 타갤 개념글, 뉴스, 힛갤등의 컨텐츠를 오른쪽 영역에서 숨깁니다.",
            type: "check",
            default: false
        },
        hideNft: {
            name: "NFT 숨기기",
            desc: "NFT 관련 내용을 숨깁니다.",
            type: "check",
            default: false
        },
        hideGalleryImage: {
            name: "갤러리 대문 숨기기",
            desc: "갤러리 대문을 숨깁니다.",
            type: "check",
            default: false
        },
        pushToRight: {
            name: "본문 영역 전체로 확장",
            desc: `"잡다 링크 숨기기" 옵션이 켜진 경우 본문 영역을 확장합니다.`,
            type: "check",
            default: false
        },
        removeNotice: {
            name: "갤러리 공지 숨기기",
            desc: "글 목록에서 공지사항을 숨깁니다.",
            type: "check",
            default: false
        },
        removeDCNotice: {
            name: "디시 공지 숨기기",
            desc: "글 목록에서 운영자의 게시글을 숨깁니다.",
            type: "check",
            default: false
        },
        removeGamemeca: {
            name: "게임메카 숨기기",
            desc: "글 목록에서 게임메카 게시글을 숨깁니다.",
            type: "check",
            default: false
        }
    },
    update: {
        activePixel(value: number) {
            updateWindowSize(this.status.forceCompact, value, innerWidth);
        },
        forceCompact(value: boolean) {
            updateWindowSize(value, this.status.activePixel, innerWidth);
        },
        hideGalleryView(value: boolean) {
            $(document.documentElement).toggleClass("refresherHideGalleryView", value);
        },
        hideUselessView(value: boolean) {
            $(document.documentElement).toggleClass("refresherHideUselessView", value);
        },
        hideNft(value: boolean) {
            $(document.documentElement).toggleClass("refresherHideNtf", value);
        },
        hideGalleryImage(value: boolean) {
            $(document.documentElement).toggleClass("refresherHideGalleryImage", value);
        },
        pushToRight(value: boolean) {
            hideSticky(value);
            $(document.documentElement).toggleClass("refresherPushToRight", value);
        },
        removeNotice(value: boolean) {
            if (new URL(location.href).searchParams.get("exception_mode") === "notice") return;

            $(document.documentElement).toggleClass("refresherHideNotice", value);
        },
        removeDCNotice(value: boolean) {
            $(document.documentElement).toggleClass("refresherHideDCNotice", value);
        },
        removeGamemeca(value: boolean) {
            $(document.documentElement).toggleClass("refresherHideGamemeca", value);
        }
    },
    require: [],
    func() {
        const isPageView = location.href.includes("board/view");

        if (!isPageView || (isPageView && this.status.useCompactModeOnView)) {
            this.memory.resize = () =>
                updateWindowSize(this.status.forceCompact, this.status.activePixel, innerWidth);

            window.addEventListener("resize", this.memory.resize);
            this.memory.resize();
        }

        this.update.hideGalleryView.bind(this)(this.status.hideGalleryView);
        this.update.hideUselessView.bind(this)(this.status.hideUselessView);
        this.update.hideNft.bind(this)(this.status.hideNft);
        this.update.hideGalleryImage.bind(this)(this.status.hideGalleryImage);
        this.update.pushToRight.bind(this)(this.status.pushToRight);
        this.update.removeNotice.bind(this)(this.status.removeNotice);
        this.update.removeDCNotice.bind(this)(this.status.removeDCNotice);
        this.update.removeGamemeca.bind(this)(this.status.removeGamemeca);
    },
    revoke() {
        window.removeEventListener("resize", this.memory.resize!);

        this.update.hideGalleryView.bind(this)(false);
        this.update.hideUselessView.bind(this)(false);
        this.update.hideNft.bind(this)(false);
        this.update.hideGalleryImage.bind(this)(false);
        this.update.pushToRight.bind(this)(false);
        this.update.removeNotice.bind(this)(false);
        this.update.removeDCNotice.bind(this)(false);
    }
} as RefresherModule<{
    memory: {
        resize: (() => void) | null;
    };
    settings: {
        activePixel: RefresherRangeSettings;
        forceCompact: RefresherCheckSettings;
        useCompactModeOnView: RefresherCheckSettings;
        hideGalleryView: RefresherCheckSettings;
        hideUselessView: RefresherCheckSettings;
        hideNft: RefresherCheckSettings;
        hideGalleryImage: RefresherCheckSettings;
        pushToRight: RefresherCheckSettings;
        removeNotice: RefresherCheckSettings;
        removeDCNotice: RefresherCheckSettings;
        removeGamemeca: RefresherCheckSettings;
    };
    update: {
        activePixel(value: number): void;
        forceCompact(value: boolean): void;
        hideGalleryView(value: boolean): void;
        hideUselessView(value: boolean): void;
        hideNft(value: boolean): void;
        hideGalleryImage(value: boolean): void;
        pushToRight(value: boolean): void;
        removeNotice(value: boolean): void;
        removeDCNotice(value: boolean): void;
        removeGamemeca(value: boolean): void;
    };
    require: [];
}>;
