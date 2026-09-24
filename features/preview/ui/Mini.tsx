import {useRef} from "react";

import {modules} from "@/core/module/registry";

import {usePreviewStore} from "./previewStore";

/** 미니 미리보기 (툴팁) */
export const Mini = () => {
    const mini = usePreviewStore((s) => s.mini);
    const leaveTimer = useRef(0);

    if (!mini) return null;

    const interaction = modules.use("preview")?.settings.tooltipInteraction === true;

    const openFull = (): void => {
        const store = usePreviewStore.getState();
        store.closeMini();
        store.requestOpen(mini.preData);
    };

    const cancelLeave = (): void => {
        if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
        leaveTimer.current = 0;
    };

    return (
        <div
            className="refresher-mini-preview"
            style={{left: mini.x, top: mini.y, pointerEvents: interaction ? "auto" : "none"}}
            onMouseEnter={cancelLeave}
            onMouseLeave={() => {
                cancelLeave();
                leaveTimer.current = window.setTimeout(() => usePreviewStore.getState().closeMini(), 150);
            }}
        >
            <h3 className="refresher-title-post" onClick={openFull}>
                {mini.title}
            </h3>
            <div className="refresher-mini-preview-contents" dangerouslySetInnerHTML={{__html: mini.contents}} />
            <span className="refresher-read-more" onClick={openFull}>
                {mini.preData.title ?? "게시글 더 보기"}
            </span>
        </div>
    );
};
