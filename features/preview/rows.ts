import type {GalleryPreData} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";

/** 목록 행(또는 제목 칸)에서 미리보기 대상을 읽는다. 링크가 없거나 글 주소가 아니면 null */
export const buildPreData = (element: HTMLElement): GalleryPreData | null => {
    const anchor = element.querySelector<HTMLAnchorElement>("a:not(.reply_numbox)");
    if (!anchor) return null;

    const href = anchor.getAttribute("href");
    if (!href) return null;

    const url = new URL(href, location.origin);
    // 운영자 '이슈' 행은 http:// 링크다. 출처가 다르면 pushState가 SecurityError를 던지므로 페이지 프로토콜로 맞춘다
    if (url.host === location.host) url.protocol = location.protocol;
    let gallery = url.searchParams.get("id") ?? undefined;
    let id = url.searchParams.get("no") ?? undefined;

    if (!gallery || !id) {
        const path = /\/board\/view\/(?:id\/)?([^/]+)\/(\d+)/.exec(url.pathname);
        if (!path) return null;
        gallery = path[1];
        id = path[2];
    }

    const row = element.closest<HTMLElement>(".ub-content") ?? element;

    // 목록 아이콘의 마지막 클래스가 글 종류다 (isTextPost가 이미지 없는 글을 가를 때 쓴다). 아이콘이 없으면 텍스트 글로 본다
    const classes = row.querySelector(".icon_img")?.getAttribute("class");

    return {
        gallery: gallery ?? "",
        id: id ?? "",
        title: anchor.textContent?.trim() || undefined,
        link: url.href,
        notice: classes?.includes("icon_notice") ?? false,
        // 이미지·텍스트·동영상 개념글 (icon_recomimg, icon_recomtxt, icon_recomovie)
        recommend: classes?.includes("icon_recom") ?? false,
        type: classes?.split(" ").at(-1) ?? "icon_txt",
        // [댓글 수] 또는 [댓글 수/음성 댓글 수]
        commentCount: Number.parseInt(row.querySelector(".reply_num")?.textContent?.slice(1) ?? "", 10) || 0
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
    // 댓글 검색은 맞은 댓글마다 같은 글 행을 되풀이한다. 글마다 첫 행만 남겨야 넘기기가 같은 글에 멈추거나 되돌아가지 않는다
    // 행마다 한 번만 읽는다. 설문·AD·외부 뉴스처럼 글로 열 수 없는 행은 건너뛴다
    const seen = new Set<string>();
    const rows: { row: HTMLElement; pre: GalleryPreData }[] = [];
    for (const row of document.querySelectorAll<HTMLElement>(".gall_list .ub-content")) {
        if (!row.checkVisibility()) continue;
        const pre = buildPreData(row);
        if (!pre) continue;
        const key = `${pre.gallery}/${pre.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({row, pre});
    }

    const index = rows.findIndex(({pre}) => pre.id === from.id && pre.gallery === from.gallery);
    if (index < 0) return null;

    // 블러 행은 현재 위치를 찾은 뒤에 거른다. 지금 글이 블러 행이어도 제자리를 찾아야 한다.
    const ahead = dir > 0 ? rows.slice(index + 1) : rows.slice(0, index).reverse();
    return ahead.find(({row}) => !isBlurHidden(row))?.pre ?? null;
};

/** 목록에 이미지 아이콘이 없는 글인지 (텍스트 개념글 포함). blockImage 설정이 이런 글의 본문 이미지를 가린다 */
export const isTextPost = (preData: GalleryPreData): boolean => preData.type === "icon_txt" || preData.type === "icon_recomtxt";
