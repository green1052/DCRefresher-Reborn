import {dcconCode, isBlocked, isImageBlocked, VIDEO_CHECK_EVENTS} from "@/core/block";

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
 * 본문의 차단 이미지·움짤에 data-blocked를 단다 (디시콘과 같은 규칙으로 가린다). 파일 해시로 보므로 다 받은 뒤에 보고,
 * 지연 로딩·가린 이미지 보기로 다시 받으면 다시 본다. similar는 비슷한 이미지 기준이다 (core/block.ts의 similarImageThreshold).
 * 이미지의 load 감시를 끊는 함수를 돌려준다.
 */
export const markBlockedImages = (root: HTMLElement, gallery: string | undefined, mode: "blur" | "hide" | undefined, similar?: number): (() => void) => {
    const controller = new AbortController();
    const mark = (media: HTMLImageElement | HTMLVideoElement): void => {
        if (!mode) {
            delete media.dataset.blocked;
            return;
        }
        void isImageBlocked(media, gallery, similar).then((blocked) => {
            if (controller.signal.aborted) return;
            if (blocked) media.dataset.blocked = mode;
            else delete media.dataset.blocked;
        });
    };

    // 디시콘은 markBlockedDccons가 단다. 움짤(<video>)은 다 받아야 보므로 VIDEO_CHECK_EVENTS 때 다시 본다.
    const isMedia = (target: EventTarget | null): target is HTMLImageElement | HTMLVideoElement =>
        (target instanceof HTMLImageElement || target instanceof HTMLVideoElement) && !target.classList.contains("written_dccon");
    for (const media of root.querySelectorAll(":is(img, video)")) {
        if (isMedia(media)) mark(media);
    }
    // 루트에서 캡처로 받아, 나중에 들어온 요소(그리지 못한 움짤을 바꾼 gif <img>, gifVideos.ts)도 본다.
    if (mode) {
        for (const type of ["load", ...VIDEO_CHECK_EVENTS]) {
            root.addEventListener(type, (ev) => {
                if (isMedia(ev.target)) mark(ev.target);
            }, {capture: true, signal: controller.signal});
        }
    }
    return () => controller.abort();
};
