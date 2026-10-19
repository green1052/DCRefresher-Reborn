import {blockMode, dcconCode, isBlocked, isImageBlocked, similarImageThreshold, VIDEO_CHECK_EVENTS} from "@/core/block";
import type {ModuleSettings} from "@/core/module/types";

/**
 * 본문에 든 차단 디시콘·이미지·움짤에 data-blocked를 단다. 페이지 글 보기처럼 그것만 가린다 (features/preview/overlay.css).
 * block이 없으면(차단 모듈이 꺼짐) 표시를 떼고, hideOnly면 흐리게 처리여도 숨긴다. 차단 목록이 바뀌면 다시 불러 붙이고 뗀다.
 * 이미지는 파일 해시로 보므로 다 받은 뒤에 보고, 지연 로딩·가린 이미지 보기로 다시 받으면 다시 본다 (비슷한 이미지 기준은 core/block.ts의 similarImageThreshold).
 * 이미지의 load 감시를 끊는 함수를 돌려준다.
 */
export const markBlockedMedia = (root: HTMLElement, gallery: string | undefined, block: ModuleSettings["block"] | undefined, hideOnly: boolean): (() => void) => {
    const mode = block && (hideOnly ? "hide" : blockMode(block));
    const similar = block && similarImageThreshold(block);

    for (const dccon of root.querySelectorAll<HTMLElement>(".written_dccon")) {
        const code = dcconCode(dccon);
        if (mode && code && isBlocked("DCCON", code, gallery)) dccon.dataset.blocked = mode;
        else delete dccon.dataset.blocked;
    }

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

    // 디시콘은 위에서 단다. 움짤(<video>)은 다 받아야 보므로 VIDEO_CHECK_EVENTS 때 다시 본다.
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
