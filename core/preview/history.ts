import type {GalleryPreData} from "@/core/preview/types";
import {isRecord} from "@/utils/record";

/** 미리보기를 열기 전 위치. 닫을 때 여기로 돌아간다. */
export interface SavedHistory {
    title: string;
    url: string;
    state: unknown;
}

/** 미리보기가 글을 열며 쌓은 기록 항목 (history.state). */
export interface PreviewEntry {
    refresher: 1;
    /** 쌓은 문서의 performance.timeOrigin. 새로고침한 페이지에 남은 예전 항목과 가린다. */
    doc: number;
    preData?: GalleryPreData;
    back?: SavedHistory;
    /** 미리보기를 열기 전 기록에서 몇 칸 위인지. */
    depth?: number;
    /** 목록 문서를 다시 불러온 뒤 이 글 미리보기를 다시 열지. */
    reopen?: boolean;
}

/** 이 문서를 가리는 값. 미리보기가 쌓는 항목의 doc에 넣는다. */
export const historyDoc = performance.timeOrigin;

/** 미리보기가 쌓은 기록 항목이면 그 항목. 어느 문서가 쌓았는지는 보지 않는다. */
export const previewEntry = (state: unknown): PreviewEntry | null =>
    isRecord(state) && state.refresher === 1 && typeof state.doc === "number" ? (state as unknown as PreviewEntry) : null;

/** 이 문서의 미리보기가 쌓은 기록 항목이면 그 항목. 새로고침 전 문서가 쌓은 항목은 실제 이동이라 null이다. */
export const ownPreviewEntry = (state: unknown): PreviewEntry | null => {
    const entry = previewEntry(state);
    return entry?.doc === historyDoc ? entry : null;
};

/** 지금 기록이 이 문서의 미리보기가 쌓은 것이면, 미리보기를 열기 전 기록에서 몇 칸 위인지 (아니면 0). */
export const ownPreviewDepth = (): number => {
    const depth = ownPreviewEntry(history.state)?.depth;
    return typeof depth === "number" ? depth : 0;
};
