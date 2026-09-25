import {defineModule} from "@/core/module/define";
import type {ModuleContext, SettingSchema} from "@/core/module/types";

/**
 * 체크하면 숨기는 영역. 설정 이름·설명과 숨길 선택자를 한 곳에 둔다 —
 * 켜진 항목의 선택자로 <style>을 만들어 넣으므로 새 항목은 여기 한 줄만 추가하면 된다.
 */
const HIDE_OPTIONS: Record<string, { name: string; desc: string; selector: string }> = {
    hideGalleryView: {name: "갤러리 뷰 숨기기", desc: "갤러리 정보, 최근 방문 갤러리 영역을 숨깁니다.", selector: ".issue_wrap, #visit_history"},
    hideUselessView: {
        name: "잡다 링크 숨기기",
        desc: "이슈줌, 타갤 개념글, 뉴스, 힛갤등의 컨텐츠를 오른쪽 영역에서 숨깁니다.",
        selector: "section.right_content article"
    },
    hideNft: {name: "NFT 숨기기", desc: "NFT 관련 내용을 숨깁니다.", selector: ".btn_nftbox, .nft_informationwrap"},
    hideGalleryImage: {name: "갤러리 대문 숨기기", desc: "갤러리 대문을 숨깁니다.", selector: "#zzbang_div"},
    removeNotice: {name: "갤러리 공지 숨기기", desc: "글 목록에서 공지사항을 숨깁니다.", selector: "tr:has(em[class*=icon_notice])"},
    removeDCNotice: {
        name: "디시 공지 숨기기",
        desc: "글 목록에서 운영자의 게시글을 숨깁니다.",
        selector: "tr[class*=ub-content]:has(> td[user_name=운영자])"
    },
    removeGamemeca: {name: "게임메카 숨기기", desc: "글 목록에서 게임메카 게시글을 숨깁니다.", selector: "tr[data-type=icon_fnews]"}
};

const COMPACT_KEYS = new Set(["activePixel", "forceCompact", "useCompactModeOnView"]);
const PUSH_CLASS = "refresherPushToRight";

let hideStyle: HTMLStyleElement | null = null;

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

const applyHide = (ctx: ModuleContext): void => {
    // 공지 모아보기(?exception_mode=notice)에서는 공지를 숨기지 않는다
    const noticePage = location.search.includes("exception_mode=notice");

    // 선택자마다 규칙을 따로 둔다 — 하나로 합치면 :has 등을 모르는 브라우저에서 규칙 전체가 무시된다
    hideStyle ??= document.documentElement.appendChild(document.createElement("style"));
    hideStyle.textContent = Object.entries(HIDE_OPTIONS)
        .filter(([key]) => ctx.settings[key] === true && !(key === "removeNotice" && noticePage))
        .map(([, {selector}]) => `${selector} { display: none !important; }`)
        .join("\n");

    // 본문 확장은 잡다 링크가 숨겨졌을 때만 (layout.scss의 폭 조정)
    document.documentElement.classList.toggle(PUSH_CLASS, ctx.settings.pushToRight === true && ctx.settings.hideUselessView === true);
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
        ...Object.fromEntries(
            Object.entries(HIDE_OPTIONS).map(([key, {name, desc}]): [string, SettingSchema] => [key, {type: "check", name, desc, default: false}])
        ),
        pushToRight: {
            type: "check",
            name: "본문 영역 전체로 확장",
            desc: "\"잡다 링크 숨기기\" 옵션이 켜진 경우 본문 영역을 확장합니다.",
            default: false
        }
    },

    setup(ctx) {
        applyCompact(ctx);
        applyHide(ctx);

        const onResize = (): void => applyCompact(ctx);
        window.addEventListener("resize", onResize);
        ctx.addCleanup(() => window.removeEventListener("resize", onResize));
    },

    onChanged(ctx, key) {
        if (COMPACT_KEYS.has(key)) applyCompact(ctx);
        else applyHide(ctx);
    },

    revoke() {
        hideStyle?.remove();
        hideStyle = null;

        document.documentElement.classList.remove("refresherCompact", "refresherCompactView", PUSH_CLASS);
        for (const sticky of document.querySelectorAll<HTMLElement>(".stickyunit")) {
            sticky.style.display = "";
        }
    }
});
