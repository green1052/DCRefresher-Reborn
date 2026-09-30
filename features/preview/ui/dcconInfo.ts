import type { MouseEvent } from "react";

import { dcconCode } from "@/core/block";

import { usePreviewStore } from "./previewStore";


/** 댓글/본문의 디시콘을 누르면 디시콘 정보 팝업을 연다. 디시콘을 눌렀으면 true */
export const openDcconInfo = (ev: MouseEvent<HTMLElement>): boolean => {
    const dccon = ev.target instanceof Element ? ev.target.closest<HTMLElement>(".written_dccon") : null;
    const code = dccon && dcconCode(dccon);
    if (code) usePreviewStore.setState({dcconInfo: code});
    return Boolean(code);
};

