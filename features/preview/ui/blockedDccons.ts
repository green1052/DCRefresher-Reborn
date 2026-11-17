import {blockMode, dcconCode, isBlocked} from "@/core/block";
import type {ModuleSettings} from "@/core/module/types";

/** 차단 디시콘에 data-blocked를 단다. */
export const markBlockedDccons = (root: HTMLElement, gallery: string | undefined, block: ModuleSettings["block"] | undefined, hideOnly: boolean): void => {
    const mode = block && (hideOnly ? "hide" : blockMode(block));

    for (const dccon of root.querySelectorAll<HTMLElement>(".written_dccon")) {
        const code = dcconCode(dccon);
        if (mode && code && isBlocked("DCCON", code, gallery)) dccon.dataset.blocked = mode;
        else delete dccon.dataset.blocked;
    }
};
