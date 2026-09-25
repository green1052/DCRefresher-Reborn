import {defineModule} from "@/core/module/define";
import type {ModuleContext} from "@/core/module/types";

let currentCtx: ModuleContext | null = null;

const TOGGLE_SETTINGS = [
    ["hideGalleryView", "refresherHideGalleryView"],
    ["hideUselessView", "refresherHideUselessView"],
    ["hideNft", "refresherHideNtf"],
    ["hideGalleryImage", "refresherHideGalleryImage"],
    ["pushToRight", "refresherPushToRight"],
    ["removeNotice", "refresherHideNotice"],
    ["removeDCNotice", "refresherHideDCNotice"],
    ["removeGamemeca", "refresherHideGamemeca"]
] as const;

const applyCompact = (ctx: ModuleContext): void => {
    const compact = window.innerWidth <= Number(ctx.settings.activePixel) || ctx.settings.forceCompact === true;
    const isView = location.href.includes("/board/view");
    // /board/view에서 게시글 보기 컴팩트 모드가 꺼져있으면 컴팩트 계산 자체를 생략
    const useCompact = compact && (!isView || ctx.settings.useCompactModeOnView === true);

    document.documentElement.classList.toggle("refresherCompact", useCompact);
    document.documentElement.classList.toggle("refresherCompactView", useCompact && isView);

    for (const sticky of document.querySelectorAll<HTMLElement>(".stickyunit")) {
        sticky.style.display = useCompact ? "none" : "";
    }
};

const applyToggle = (key: string, value: unknown): void => {
    // 게시글 보기 화면에서는 갤러리 공지 토글을 스킵 (?exception_mode=notice)
    if (key === "removeNotice" && location.search.includes("exception_mode=notice")) return;

    const target = TOGGLE_SETTINGS.find(([settingKey]) => settingKey === key);
    if (!target) return;

    document.documentElement.classList.toggle(target[1], value === true);
};

export default defineModule({
    id: "layout",
    name: "레이아웃 수정",
    description: "디시 레이아웃을 변경할 수 있도록 도와줍니다.",
    defaultEnable: true,

    settings: {
        activePixel: {
            type: "range",
            name: "컴팩트 모드 활성화 조건",
            desc: "브라우저 가로가 이 값 보다 작을 경우 컴팩트 모드를 활성화합니다.",
            default: 900,
            min: 100,
            max: screen.width,
            step: 1,
            unit: "px"
        },
        forceCompact: {
            type: "check",
            name: "컴팩트 모드 강제 사용",
            desc: "항상 컴팩트 모드를 사용하도록 설정합니다.",
            default: false
        },
        useCompactModeOnView: {
            type: "check",
            name: "게시글 보기 컴팩트 모드",
            desc: "게시글 보기에서도 컴팩트 모드를 사용하도록 설정합니다.",
            default: true
        },
        hideGalleryView: {
            type: "check",
            name: "갤러리 뷰 숨기기",
            desc: "갤러리 정보, 최근 방문 갤러리 영역을 숨깁니다.",
            default: false
        },
        hideUselessView: {
            type: "check",
            name: "잡다 링크 숨기기",
            desc: "이슈줌, 타갤 개념글, 뉴스, 힛갤등의 컨텐츠를 오른쪽 영역에서 숨깁니다.",
            default: false
        },
        hideNft: {
            type: "check",
            name: "NFT 숨기기",
            desc: "NFT 관련 내용을 숨깁니다.",
            default: false
        },
        hideGalleryImage: {
            type: "check",
            name: "갤러리 대문 숨기기",
            desc: "갤러리 대문을 숨깁니다.",
            default: false
        },
        pushToRight: {
            type: "check",
            name: "본문 영역 전체로 확장",
            desc: "\"잡다 링크 숨기기\" 옵션이 켜진 경우 본문 영역을 확장합니다.",
            default: false
        },
        removeNotice: {
            type: "check",
            name: "갤러리 공지 숨기기",
            desc: "글 목록에서 공지사항을 숨깁니다.",
            default: false
        },
        removeDCNotice: {
            type: "check",
            name: "디시 공지 숨기기",
            desc: "글 목록에서 운영자의 게시글을 숨깁니다.",
            default: false
        },
        removeGamemeca: {
            type: "check",
            name: "게임메카 숨기기",
            desc: "글 목록에서 게임메카 게시글을 숨깁니다.",
            default: false
        }
    },

    setup(ctx) {
        currentCtx = ctx;

        // 8개 토글 + 컴팩트 3종 초기 적용
        for (const [key] of TOGGLE_SETTINGS) {
            applyToggle(key, ctx.settings[key]);
        }
        applyCompact(ctx);

        const onResize = (): void => applyCompact(ctx);
        window.addEventListener("resize", onResize);
        ctx.addCleanup(() => window.removeEventListener("resize", onResize));
    },

    onChanged(key, value) {
        if (!currentCtx) return;

        // 컴팩트 3종은 재계산, 나머지는 클래스 토글
        if (key === "activePixel" || key === "forceCompact" || key === "useCompactModeOnView") {
            applyCompact(currentCtx);
            return;
        }

        applyToggle(key, value);
    },

    revoke() {
        currentCtx = null;

        document.documentElement.classList.remove(
            "refresherCompact",
            "refresherCompactView",
            ...TOGGLE_SETTINGS.map(([, className]) => className)
        );

        for (const sticky of document.querySelectorAll<HTMLElement>(".stickyunit")) {
            sticky.style.display = "";
        }
    }
});
