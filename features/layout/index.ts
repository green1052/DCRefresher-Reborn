import {LayoutPanelTop} from "lucide-react";

import {defineModule} from "@/core/module/define";
import type {ModuleContext, SettingSchema} from "@/core/module/types";
import {isViewPage} from "@/core/http/urls";

/**
 * 체크하면 숨기는 영역. 설정 이름·설명과 숨길 선택자를 한 곳에 둔다 —
 * 켜진 항목의 선택자로 <style>을 만들어 넣으므로 새 항목은 여기 한 줄만 추가하면 된다.
 */
const HIDE_OPTIONS: Record<string, { name: string; desc: string; selector: string }> = {
    hideGalleryView: {name: "갤러리 뷰 숨기기", desc: "갤러리 정보, 최근 방문 갤러리 영역을 숨깁니다.", selector: ".issue_wrap, #visit_history"},
    hideUselessView: {
        name: "잡다 링크 숨기기",
        desc: "이슈줌, 타갤 개념글, 뉴스, 힛갤 등의 컨텐츠를 오른쪽 영역에서 숨깁니다.",
        selector: "section.right_content article"
    },
    hideNft: {name: "NFT 숨기기", desc: "NFT 관련 내용을 숨깁니다.", selector: ".btn_nftbox, .nft_informationwrap"},
    hideGalleryImage: {name: "갤러리 대문 숨기기", desc: "갤러리 대문을 숨깁니다.", selector: "#zzbang_div"},
    removeNotice: {name: "갤러리 공지 숨기기", desc: "글 목록에서 공지사항을 숨깁니다.", selector: "tr:has(em[class*=icon_notice])"},
    removeDCNotice: {
        name: "디시 공지 숨기기",
        desc: "글 목록에서 운영자의 게시글을 숨깁니다.",
        // 설문·광고 행은 user_name 칸, 운영자 글은 식별 코드·IP가 빈 운영자 작성자 칸
        selector: "tr[class*=ub-content]:has(> td[user_name=운영자]), tr.ub-content:has(> .ub-writer[data-nick=운영자][data-uid=\"\"][data-ip=\"\"])"
    },
    removeGamemeca: {name: "게임메카 숨기기", desc: "글 목록에서 게임메카 게시글을 숨깁니다.", selector: "tr[data-type=icon_fnews]"}
};

const COMPACT_KEYS = new Set(["activePixel", "forceCompact", "useCompactModeOnView"]);
const PUSH_CLASS = "refresherPushToRight";
const HIDE_STYLE_ID = "refresher-layout-hide";

let hideStyle: HTMLStyleElement | null = null;

const applyCompact = (ctx: ModuleContext): void => {
    const compact = window.innerWidth <= Number(ctx.settings.activePixel) || ctx.settings.forceCompact === true;
    // /board/view에서는 '게시글 보기 컴팩트 모드'가 켜졌을 때만 적용
    const useCompact = compact && (!isViewPage || ctx.settings.useCompactModeOnView === true);

    document.documentElement.classList.toggle("refresherCompact", useCompact);
};

const applyHide = (ctx: ModuleContext): void => {
    // 공지 모아보기(?exception_mode=notice)에서는 공지를 숨기지 않는다 (디시 공지도)
    const noticePage = location.search.includes("exception_mode=notice");

    // 선택자마다 규칙을 따로 둔다 — 하나로 합치면 :has 등을 모르는 브라우저에서 규칙 전체가 무시된다.
    // 죽은 인스턴스(파이어폭스 재주입)가 남긴 것은 id로 찾아 이어 쓴다 — 새로 붙이면 옛 규칙이 끌 수 없게 남는다
    hideStyle ??= document.querySelector<HTMLStyleElement>(`style#${HIDE_STYLE_ID}`)
        ?? document.documentElement.appendChild(Object.assign(document.createElement("style"), {id: HIDE_STYLE_ID}));
    hideStyle.textContent = Object.entries(HIDE_OPTIONS)
        .filter(([key]) => ctx.settings[key] === true && !(noticePage && (key === "removeNotice" || key === "removeDCNotice")))
        .map(([, {selector}]) => `${selector} { display: none !important; }`)
        .join("\n");

    // 본문 확장은 잡다 링크가 숨겨졌을 때만 (layout.scss의 폭 조정)
    document.documentElement.classList.toggle(PUSH_CLASS, ctx.settings.pushToRight === true && ctx.settings.hideUselessView === true);
};

export default defineModule({
    id: "layout",
    name: "레이아웃 수정",
    description: "디시 레이아웃을 변경합니다.",
    icon: LayoutPanelTop,

    settings: {
        activePixel: {
            type: "range",
            name: "컴팩트 모드 활성화 조건",
            desc: "브라우저 가로가 이 값보다 작을 경우 컴팩트 모드를 활성화합니다.",
            default: 900,
            min: 100,
            // 모니터마다 다른 screen.width로 두면 큰 모니터에서 저장한 값이 작은 모니터에서 잘린다
            max: 3840,
            step: 1,
            unit: "px"
        },
        forceCompact: {
            type: "check",
            name: "컴팩트 모드 강제 사용",
            desc: "항상 컴팩트 모드를 사용합니다.",
            default: false
        },
        useCompactModeOnView: {
            type: "check",
            name: "게시글 보기 컴팩트 모드",
            desc: "게시글 보기에서도 컴팩트 모드를 사용합니다.",
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

        window.addEventListener("resize", () => applyCompact(ctx), {signal: ctx.signal});
    },

    onChanged(ctx, key) {
        if (COMPACT_KEYS.has(key)) applyCompact(ctx);
        else applyHide(ctx);
    },

    revoke() {
        hideStyle?.remove();
        hideStyle = null;

        document.documentElement.classList.remove("refresherCompact", PUSH_CLASS);
    }
});
