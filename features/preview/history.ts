import {historyDoc, previewEntry, type SavedHistory} from "@/core/preview/history";
import type {GalleryPreData} from "@/core/preview/types";
import {whenDomReady} from "@/utils/dom";

import type {Ctx} from "./meta";

/** 미리보기가 쌓은 방문 기록을 되돌리고, 새로 불러온 글 페이지에서 목록으로 되살린다. */
export const createPreviewHistory = (ctx: Ctx) => {
    let savedHistory: SavedHistory | null = null;

    const restore = (fromHistory: boolean) => {
        if (savedHistory) {
            const {title} = savedHistory;
            try {
                // 목록 주소를 새 항목으로 쌓아 닫는다 - 미리보기 항목을 뒤 갈래에 남겨 뒤로 가기로 다시 열리게 한다. popstate로 닫은 때는 이미 목록에 있으니 쌓지 않는다.
                if (!fromHistory && location.href !== savedHistory.url) history.pushState(savedHistory.state, title, savedHistory.url);
                document.title = title;
            } catch (e) {
                console.error("미리보기 기록 되돌리기 실패:", e);
            }
        }

        savedHistory = null;
    };

    // 목록 문서가 bfcache에 없으면(파이어폭스에서 잦다) 미리보기 항목을 글 주소로 새로 불러온다 - 목록 주소로 바꿔 다시 띄운다.
    const replaceEntry = (state: unknown, url?: string): boolean => {
        try {
            history.replaceState(state, "", url);
            return true;
        } catch (e) {
            console.error("미리보기 기록 고치기 실패:", e);
            return false;
        }
    };

    return {
        restore,
        /** 창을 처음 열 때 저장하는 원위치. */
        remember: (back: SavedHistory): void => {
            savedHistory = back;
        },
        /** popstate로 다시 열 때 앞 갈래가 저장한 원위치로 바꾼다. */
        setBack: (back: SavedHistory | null): void => {
            savedHistory = back;
        },
        replaceEntry,
        /** 처음 열 때 저장한 원위치 - 기록 항목의 back에 심는다. */
        back: (): SavedHistory | null => savedHistory,
        /** 글 페이지에서 시작했다면 창을 다시 띄운다(preData를 넘겨 준다). */
        reopenFromEntry: (open: (preData: GalleryPreData) => void): void => {
            const entry = previewEntry(history.state);
            const navigation = performance.getEntriesByType("navigation")[0];
            if (!entry || entry.doc === historyDoc || !entry.preData || !entry.back) return;
            const {preData, back} = entry;
            if (entry.reopen) {
                replaceEntry({...entry, doc: historyDoc, reopen: false}, preData.link);
                savedHistory = back;
                whenDomReady(() => open(preData), ctx.signal);
            } else if (navigation instanceof PerformanceNavigationTiming && navigation.type === "back_forward" && document.readyState !== "complete") {
                // 문서를 불러오는 중일 때만 옮긴다 - 다 불러온 뒤 켜면 back_forward가 그대로라 읽던 글이 목록으로 바뀐다.
                if (replaceEntry({...entry, reopen: true}, back.url)) location.reload();
            } else if (navigation instanceof PerformanceNavigationTiming && (navigation.type === "reload" || navigation.type === "back_forward")) {
                // 새로고침했거나 다 불러온 글 페이지는 진짜 글 항목이므로 미리보기 표시를 지운다.
                replaceEntry(null);
            }
        }
    };
};
