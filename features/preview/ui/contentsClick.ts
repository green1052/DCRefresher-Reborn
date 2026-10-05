import type {MouseEvent} from "react";

import {isBlockedHidden} from "@/core/block";
import {dcinsideHref} from "@/core/http/urls";

import {openDcconInfo} from "./DcconInfoPopup";
import {usePreviewStore} from "./previewStore";

/**
 * 크게 볼 수 있는 본문 이미지. 디시콘·가린 이미지(관리자 가림·blockImage)·깨진 이미지는 뺀다.
 * 차단으로 가린 본문 안의 이미지는 '가린 내용 보기' 중이거나 흐림이 풀려 있을 때(blurReveal)만 연다. openDcconInfo와 같은 기준(isBlockedHidden).
 */
const isViewable = (image: HTMLImageElement): boolean =>
    image.complete && image.naturalWidth > 0 && !image.closest(".written_dccon, [data-block]") && !isBlockedHidden(image) && image.checkVisibility();

/**
 * 미리보기 본문(HTML 문자열로 그린 디시 본문)을 눌렀을 때. 본문 요소가 React 요소가 아니라서 감싼 상자의 클릭에서 찾는다.
 * 디시콘은 정보 창, 이미지는 크게 보기(imageViewer 설정)나 디시 원본 보기, '차단 이미지 보기' 버튼은 가린 이미지를 드러낸다.
 */
export const clickContents = (ev: MouseEvent<HTMLElement>, imageViewer: boolean): void => {
    // 디시콘을 눌렀으면 정보 팝업을 열고 더 이상의 처리를 막는다.
    if (openDcconInfo(ev)) return;
    const target = ev.target instanceof Element ? ev.target : null;

    // 이미지를 누르면 크게 본다 (링크로 감싼 이미지는 링크로 연다).
    const clicked = target?.closest("img");
    if (clicked && imageViewer && !clicked.closest("a") && isViewable(clicked)) {
        const images = [...ev.currentTarget.querySelectorAll("img")].filter(isViewable);
        usePreviewStore.setState({
            viewer: {images: images.map((image) => ({src: image.currentSrc || image.src, alt: image.alt, pop: image.dataset.pop})), index: images.indexOf(clicked)}
        });
        return;
    }

    // 크게 보기를 끄면 디시처럼 원본 보기를 새 탭으로 연다. 주소는 parser.ts가 옮겨 둔 imgPop 주소이고 디시 주소만 연다.
    const image = target?.closest<HTMLImageElement>("img[data-pop]");
    if (image && !image.closest("a")) {
        const url = dcinsideHref(image.dataset.pop);
        if (url) window.open(url, "_blank", "noopener");
        return;
    }

    const button = target?.closest(".btn_img_block");
    if (!button) return;

    ev.preventDefault();
    usePreviewStore.setState({imageBlocked: false});
    // 관리자가 가린 이미지는 디시처럼 누른 버튼 옆 것만 드러낸다.
    // parser.ts는 가린 이미지의 data-original을 src로 옮기지 않으므로 여기서 옮긴다.
    for (const media of button.parentElement?.querySelectorAll<HTMLElement>(":scope > [data-block], :scope > .refresher-imgnum > [data-block]") ?? []) {
        if (media instanceof HTMLImageElement && media.dataset.original) media.src = media.dataset.original;
        media.removeAttribute("data-block");
    }
    button.remove();
};
