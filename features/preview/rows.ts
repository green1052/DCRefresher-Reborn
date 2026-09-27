import type {GalleryPreData} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";

/** 목록 행(또는 제목 링크)에서 미리보기 대상을 읽는다. 링크가 없거나 글 주소가 아니면 null */
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

    // 목록 아이콘의 마지막 클래스가 글 종류다 (isTextPost가 이미지 없는 글을 가를 때 쓴다).
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

/** 차단 모듈이 블러로 가린 행인지. 화면에는 남아 있지만 '가린 내용 보기' 중이 아니면 넘기기·미니로 열지 않는다 */
export const isBlurHidden = (element: Element): boolean =>
    !useUiStore.getState().blockView?.revealed && element.closest(".refresherBlur") !== null;

/**
 * 목록에서 앞(-1)/뒤(1) 글. 차단·운영자 숨김으로 안 보이는 행과 블러 행은 건너뛴다.
 * 미리보기는 본문(TEXT) 차단만 검사하므로 여기서 거르지 않으면 목록에서 숨긴 글이 그대로 열린다.
 */
export const adjacentPreData = (from: GalleryPreData, dir: number): GalleryPreData | null => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".gall_list .ub-content")).filter((row) =>
        row.checkVisibility() && row.querySelector("a:not(.reply_numbox)")
    );

    const index = rows.findIndex((row) => {
        const pre = buildPreData(row);
        return pre?.id === from.id && pre?.gallery === from.gallery;
    });
    if (index < 0) return null;

    // 블러 행은 현재 위치를 찾은 뒤에 거른다. 지금 글이 블러 행이어도 제자리를 찾아야 한다.
    const ahead = dir > 0 ? rows.slice(index + 1) : rows.slice(0, index).reverse();
    // 설문·AD·외부 뉴스처럼 글로 열 수 없는 행은 건너뛴다
    for (const row of ahead) {
        const pre = isBlurHidden(row) ? null : buildPreData(row);
        if (pre) return pre;
    }
    return null;
};

/** 목록에 이미지 아이콘이 없는 글인지 (텍스트 개념글 포함). blockImage 설정이 이런 글의 본문 이미지를 가린다 */
export const isTextPost = (preData: GalleryPreData): boolean => preData.type === "icon_txt" || preData.type === "icon_recomtxt";
