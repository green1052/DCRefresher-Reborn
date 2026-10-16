import {dcconCode, isBlocked, isImageBlocked} from "@/core/block";

/**
 * 본문에 든 차단 디시콘에 data-blocked를 단다. 페이지 글 보기처럼 그 디시콘만 가린다 (features/preview/overlay.css).
 * mode가 없으면(차단 모듈이 꺼짐) 표시를 뗀다. 차단 목록이 바뀌면 다시 불러 붙이고 뗀다.
 */
export const markBlockedDccons = (root: HTMLElement, gallery: string | undefined, mode: "blur" | "hide" | undefined): void => {
    for (const dccon of root.querySelectorAll<HTMLElement>(".written_dccon")) {
        const code = dcconCode(dccon);
        if (mode && code && isBlocked("DCCON", code, gallery)) dccon.dataset.blocked = mode;
        else delete dccon.dataset.blocked;
    }
};

/**
 * 본문의 차단 이미지에 data-blocked를 단다 (디시콘과 같은 규칙으로 가린다). 파일 해시로 보므로 다 받은 뒤에 보고,
 * 지연 로딩·가린 이미지 보기로 다시 받으면 다시 본다. similar는 비슷한 이미지 기준이다 (core/block.ts의 similarImageThreshold).
 * 이미지의 load 감시를 끊는 함수를 돌려준다.
 */
export const markBlockedImages = (root: HTMLElement, gallery: string | undefined, mode: "blur" | "hide" | undefined, similar?: number): (() => void) => {
    const controller = new AbortController();
    const mark = (image: HTMLImageElement): void => {
        if (!mode) {
            delete image.dataset.blocked;
            return;
        }
        void isImageBlocked(image, gallery, similar).then((blocked) => {
            if (controller.signal.aborted) return;
            if (blocked) image.dataset.blocked = mode;
            else delete image.dataset.blocked;
        });
    };

    // 디시콘은 markBlockedDccons가 단다.
    for (const image of root.querySelectorAll<HTMLImageElement>("img:not(.written_dccon)")) {
        mark(image);
        if (mode) image.addEventListener("load", () => mark(image), {signal: controller.signal});
    }
    return () => controller.abort();
};
