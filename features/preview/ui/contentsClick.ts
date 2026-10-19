import type {KeyboardEvent, MouseEvent} from "react";

import {isBlockedHidden} from "@/core/block";
import {dcinsideHref} from "@/core/http/urls";

import {openDcconInfo} from "./DcconInfoPopup";
import {usePreviewStore} from "./previewStore";

/**
 * 받다가 깨진 이미지. lazy로 미뤘거나 받는 중인 이미지는 크게 보기의 <img>가 직접 받으므로 치지 않는다.
 * src가 없는 이미지는 complete이고 naturalWidth가 0이라 깨진 것으로 친다.
 */
const isBroken = (image: HTMLImageElement): boolean => image.complete && image.naturalWidth === 0;

/**
 * 크게 볼 수 있는 본문 이미지. 디시콘·가린 이미지(관리자 가림·blockImage)·깨진 이미지와 링크로 감싼 이미지(링크 미리보기 카드 썸네일 등, 누르면 링크로 연다)는 뺀다.
 * 차단으로 가린 본문 안의 이미지는 '가린 내용 보기' 중이거나 흐림이 풀려 있을 때(blurReveal)만 연다. openDcconInfo와 같은 기준(isBlockedHidden).
 */
const isViewable = (image: HTMLImageElement): boolean =>
    !isBroken(image) && !image.closest("a, .written_dccon, [data-block]") && !isBlockedHidden(image) && image.checkVisibility();

/**
 * 미리보기 본문(HTML 문자열로 그린 디시 본문)을 눌렀을 때. 본문 요소가 컴포넌트가 그린 요소가 아니라서 감싼 상자의 클릭에서 찾는다.
 * 디시콘은 정보 창, 이미지는 크게 보기(imageViewer 설정)나 디시 원본 보기, '차단 이미지 보기' 버튼은 가린 이미지를 드러낸다.
 */
export const clickContents = (ev: MouseEvent<HTMLElement>, imageViewer: boolean): void => {
    if (openDcconInfo(ev)) return;
    const target = ev.target instanceof Element ? ev.target : null;

    const clicked = target?.closest("img");
    if (clicked && imageViewer && isViewable(clicked)) {
        const images = [...ev.currentTarget.querySelectorAll("img")].filter(isViewable);
        usePreviewStore.setState({
            viewer: {images: images.map((image) => ({src: image.currentSrc || image.src, alt: image.alt, pop: dcinsideHref(image.dataset.pop)})), index: images.indexOf(clicked)}
        });
        return;
    }

    // 크게 보기를 끄면 디시처럼 원본 보기를 새 탭으로 연다. 주소는 core/preview/parser.ts가 옮겨 둔 imgPop 주소이고 디시 주소만 연다.
    // 차단으로 가린 이미지는 크게 보기처럼 열지 않는다 (isBlockedHidden).
    const image = target?.closest<HTMLImageElement>("img[data-pop]");
    if (image && !image.closest("a")) {
        if (isBlockedHidden(image)) return;
        const url = dcinsideHref(image.dataset.pop);
        if (url) window.open(url, "_blank", "noopener");
        return;
    }

    const button = target?.closest(".btn_img_block");
    if (!button) return;

    ev.preventDefault();
    usePreviewStore.setState({imageBlocked: false});
    // 관리자가 가린 이미지는 디시처럼 누른 버튼 옆 것만 드러낸다.
    // core/preview/parser.ts는 가린 이미지의 data-original을 src로 옮기지 않으므로 여기서 옮긴다.
    for (const media of button.parentElement?.querySelectorAll<HTMLElement>(":scope > [data-block], :scope > .refresher-imgnum > [data-block]") ?? []) {
        if (media instanceof HTMLImageElement && media.dataset.original) media.src = media.dataset.original;
        media.removeAttribute("data-block");
    }
    button.remove();
    // 가린 동안은 src가 없어 깨진 이미지로 쳤다. 드러낸 이미지를 크게 보기 버튼으로 다시 알린다.
    markPressable(ev.currentTarget, imageViewer);
};

/**
 * 누르면 여는 본문 미디어를 키보드로도 고를 수 있게 버튼으로 알린다. 디시콘은 정보 창, 링크로 감싸지 않은 이미지는 크게 보기(imageViewer)나 원본 보기(data-pop)다.
 * 숨긴 미디어(관리자 가림·이미지 차단·숨김 차단)는 display: none이라 Tab이 건너뛴다.
 * 깨진 이미지는 clickContents처럼 크게 보지 않고, 원본 보기가 있으면 그것만 연다. 나중에 깨지면 Frame이 다시 부른다.
 * 손가락 커서도 이 버튼 표시를 따른다 (overlay.css).
 */
export const markPressable = (root: HTMLElement, imageViewer: boolean): void => {
    for (const media of root.querySelectorAll<HTMLElement>(".written_dccon, img")) {
        const label = media.matches(".written_dccon") ? "디시콘 정보"
            : media.closest("a") ? undefined
            : imageViewer && !(media instanceof HTMLImageElement && isBroken(media)) ? "이미지 크게 보기"
            : media.dataset.pop ? "원본 보기" : undefined;
        if (label) {
            media.tabIndex = 0;
            media.setAttribute("role", "button");
            // aria-label은 alt를 가리므로 디시콘 이름 등 alt를 앞에 남긴다.
            const alt = media.getAttribute("alt")?.trim();
            media.setAttribute("aria-label", alt ? `${alt} (${label})` : label);
        } else {
            // 크게 보기를 끄면 열 것이 없어지는 이미지가 있다.
            for (const name of ["tabindex", "role", "aria-label"]) media.removeAttribute(name);
        }
    }
};

/** markPressable로 버튼이 된 미디어에서 Enter·Space를 누르면 클릭을 보내 clickContents·openDcconInfo가 그대로 받는다. */
export const pressContents = (ev: KeyboardEvent<HTMLElement>): void => {
    if ((ev.key !== "Enter" && ev.key !== " ") || !(ev.target instanceof HTMLElement) || ev.target.getAttribute("role") !== "button") return;
    ev.preventDefault();
    ev.target.click();
};
