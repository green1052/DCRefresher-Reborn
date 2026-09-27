import type {GalleryPreData} from "@/core/preview/types";

/** 목록 행 → 미리보기 대상 (갤러리·글 번호·목록 아이콘) */
export const buildPreData = (element: HTMLElement): GalleryPreData | null => {
    const anchor = element.tagName === "A" ? (element as HTMLAnchorElement) : element.querySelector<HTMLAnchorElement>("a:not(.reply_numbox)");
    if (!anchor) return null;

    const href = anchor.getAttribute("href");
    if (!href) return null;

    const url = new URL(href, location.origin);
    let gallery = url.searchParams.get("id") ?? undefined;
    let id = url.searchParams.get("no") ?? undefined;

    if (!gallery || !id) {
        const path = /\/board\/view\/(?:id\/)?([^/]+)\/(\d+)/.exec(url.pathname);
        if (!path) return null;
        gallery = path[1];
        id = path[2];
    }

    const row = (element.closest(".ub-content") as HTMLElement | null) ?? element;

    // 목록 아이콘 클래스에서 게시글 타입 추출 (이미지 아이콘 없는 글 판별)
    const icon = row.querySelector<HTMLElement>(".icon_img");
    let type = "icon_txt";
    let notice = false;
    let recommend = false;

    if (icon) {
        const classes = icon.getAttribute("class") ?? "";
        type = classes.split(" ").at(-1) ?? "icon_txt";
        notice = classes.includes("icon_notice");
        // 이미지·텍스트·동영상 개념글 (icon_recomimg, icon_recomtxt, icon_recomovie)
        recommend = classes.includes("icon_recom");
    }

    return {
        gallery: gallery ?? "",
        id: id ?? "",
        title: anchor.textContent?.trim() || undefined,
        link: url.href,
        notice,
        recommend,
        type
    };
};

/** 차단 모듈이 블러로 가린 행 — 보이긴 하지만('가린 내용 보기' 중이 아니면) 넘기기·미니로 내용을 열지 않는다 */
export const isBlurHidden = (element: Element): boolean =>
    !document.documentElement.classList.contains("refresherBlockReveal") && element.closest(".refresherBlur") !== null;

/** 목록에서 앞(-1)/뒤(1) 글 — 차단·운영자 숨김·블러 행은 건너뛴다 (미리보기는 TEXT 차단만 검사해서 숨긴 글이 그대로 열린다) */
export const adjacentPreData = (from: GalleryPreData, dir: number): GalleryPreData | null => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".gall_list .ub-content")).filter((row) =>
        row.checkVisibility() && row.querySelector("a:not(.reply_numbox)")
    );

    const index = rows.findIndex((row) => {
        const pre = buildPreData(row);
        return pre?.id === from.id && pre?.gallery === from.gallery;
    });
    if (index < 0) return null;

    // 블러 행은 찾은 뒤에 거른다 — 지금 글이 블러 행이어도 제자리를 찾게
    const ahead = dir > 0 ? rows.slice(index + 1) : rows.slice(0, index).reverse();
    const next = ahead.find((row) => !isBlurHidden(row));
    return next ? buildPreData(next) : null;
};

/** 목록에 이미지 아이콘이 없는 글 (텍스트 개념글 포함) — blockImage가 본문 이미지를 가린다 */
export const isTextPost = (preData: GalleryPreData): boolean => preData.type === "icon_txt" || preData.type === "icon_recomtxt";
