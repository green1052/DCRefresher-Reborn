import {dcconCode, isBlocked} from "@/core/block";

/**
 * 본문에 든 차단 디시콘에 data-blocked를 단다. 페이지 글 보기처럼 그 디시콘만 가린다 (overlay.css).
 * mode가 없으면(차단 모듈이 꺼짐) 표시를 뗀다. 차단 목록이 바뀌면 다시 불러 붙이고 뗀다.
 */
export const markBlockedDccons = (root: HTMLElement, gallery: string | undefined, mode: "blur" | "hide" | undefined): void => {
    for (const dccon of root.querySelectorAll<HTMLElement>(".written_dccon")) {
        const code = dcconCode(dccon);
        if (mode && code && isBlocked("DCCON", code, gallery)) dccon.dataset.blocked = mode;
        else delete dccon.dataset.blocked;
    }
};
