import {usePreviewStore} from "./previewStore";

/** 미니 미리보기 (툴팁) — 커서를 따라다니며, 클릭하면 전체 미리보기로 */
export const Mini = () => {
    const mini = usePreviewStore((s) => s.mini);

    if (!mini) return null;

    const openFull = (): void => {
        const store = usePreviewStore.getState();
        store.closeMini();
        store.requestOpen(mini.preData);
    };

    return (
        <div
            className="refresher-mini-preview"
            style={{left: mini.x, top: mini.y}}
            onMouseLeave={() => usePreviewStore.getState().closeMini()}
        >
            <h3 className="refresher-title-post" onClick={openFull}>
                {mini.title}
            </h3>
            <div className="refresher-mini-preview-contents" dangerouslySetInnerHTML={{__html: mini.contents}}/>
            <span className="refresher-read-more" onClick={openFull}>
                {mini.preData.title ?? "게시글 더 보기"}
            </span>
        </div>
    );
};
