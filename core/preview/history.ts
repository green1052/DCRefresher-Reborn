import {dcinsideHref} from "@/core/http/urls";
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

// history.state는 페이지 스크립트도 쓸 수 있고 예전 버전이 쌓은 모양일 수도 있다.
// 링크로 이동하므로 buildPreData와 같은 기준으로 디시 주소만 믿는다.
const isGalleryPreData = (value: unknown): value is GalleryPreData =>
    isRecord(value) && typeof value.gallery === "string" && typeof value.id === "string" && (value.title === undefined || typeof value.title === "string")
    && typeof value.link === "string" && dcinsideHref(value.link) !== undefined && typeof value.notice === "boolean" && typeof value.recommend === "boolean"
    && typeof value.type === "string" && Number.isInteger(value.commentCount);

const isSavedHistory = (value: unknown): value is SavedHistory => isRecord(value) && typeof value.title === "string" && typeof value.url === "string";

/** 미리보기가 쌓은 기록 항목이면 그 항목. 어느 문서가 쌓았는지는 보지 않는다. 모양이 어긋난 preData·back은 버린다. */
export const previewEntry = (state: unknown): PreviewEntry | null => {
    if (!isRecord(state) || state.refresher !== 1 || typeof state.doc !== "number") return null;
    return {
        refresher: 1,
        doc: state.doc,
        preData: isGalleryPreData(state.preData) ? state.preData : undefined,
        back: isSavedHistory(state.back) ? state.back : undefined,
        depth: typeof state.depth === "number" ? state.depth : undefined,
        reopen: state.reopen === true
    };
};

/** 이 문서의 미리보기가 쌓은 기록 항목이면 그 항목. 새로고침 전 문서가 쌓은 항목은 실제 이동이라 null이다. */
export const ownPreviewEntry = (state: unknown): PreviewEntry | null => {
    const entry = previewEntry(state);
    return entry?.doc === historyDoc ? entry : null;
};

/** 지금 기록이 이 문서의 미리보기가 쌓은 것이면, 미리보기를 열기 전 기록에서 몇 칸 위인지 (아니면 0). */
export const ownPreviewDepth = (): number => ownPreviewEntry(history.state)?.depth ?? 0;
