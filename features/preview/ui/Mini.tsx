import {useEffect, useRef} from "react";

import {similarImageThreshold} from "@/core/block";
import {useRunningModuleSettings} from "@/core/module/useModuleSettings";
import {useBlocksStore} from "@/stores/blocks";

import {markBlockedDccons, markBlockedImages} from "./blockedDccons";
import {fitMovies} from "./fitMovies";
import {watchGifVideos} from "./gifVideos";
import {cn} from "cn";

import {hoverMini, MINI_HEIGHT, MINI_WIDTH, usePreviewStore} from "./previewStore";

/**
 * 미니 미리보기 (툴팁). 기본은 커서를 따라다니며 포인터를 통과시킨다. 포인터를 받으면 카드에 올라서는 순간
 * 제목 칸을 떠난 것(mouseout)으로 닫히고, 통과시키면 아래 제목 클릭이 그대로 미리보기를 연다.
 * 상호작용(tooltipInteraction)을 켜면 포인터를 받고 커서를 따라다니지 않으며, 제목과 카드 사이를 옮겨 가는 동안은 닫지 않는다.
 */
export const Mini = () => {
    const mini = usePreviewStore((s) => s.mini);
    const contents = useRef<HTMLDivElement>(null);

    // 전체 미리보기(Frame.tsx)처럼 깨진 움짤·디시콘 mp4를 gif로 바꾸고 디시 동영상 iframe 크기를 맞춘다.
    useEffect(() => (contents.current ? watchGifVideos(contents.current) : undefined), [mini?.contents]);
    useEffect(() => (contents.current ? fitMovies(contents.current) : undefined), [mini?.contents]);

    // 본문의 차단 디시콘·이미지를 가린다. 마우스를 올려 흐림을 걷을 수 없으니 흐리게 처리여도 숨긴다.
    const block = useRunningModuleSettings("block");
    const blockEntries = useBlocksStore((s) => s.entries);
    const blockDefaults = useBlocksStore((s) => s.defaults);
    useEffect(() => {
        if (!contents.current) return;
        const mode = block ? "hide" : undefined;
        markBlockedDccons(contents.current, mini?.gallery, mode);
        return markBlockedImages(contents.current, mini?.gallery, mode, block ? similarImageThreshold(block) : undefined);
    }, [mini?.contents, mini?.gallery, block, blockEntries, blockDefaults]);

    if (!mini) return null;

    return (
        <div className={cn("refresher-mini-preview fixed flex max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-xl bg-card p-3 text-card-foreground shadow-lg ring-1 ring-foreground/10",
                           mini.interactive && "pointer-events-auto")}
             onPointerEnter={mini.interactive ? () => hoverMini(true) : undefined} onPointerLeave={mini.interactive ? () => hoverMini(false) : undefined}
             style={{left: mini.x, top: mini.y, width: MINI_WIDTH, maxHeight: `min(${MINI_HEIGHT}px, calc(100vh - 20px))`}}>
            <h3 className="mb-2 shrink-0 truncate text-base font-bold">{mini.title}</h3>
            {/* 포인터를 통과시키는 기본값에선 직접 굴릴 수 없어 스크롤바는 내용이 더 있다는 표시다.
                넓은 내용은 옆을 자른다 (overflow-y만 auto면 가로 스크롤바가 생긴다). */}
            <div ref={contents}
                 className={cn("refresher-html refresher-mini-contents min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]",
                               mini.blockMedia && "refresher-preview-block-media")}
                 dangerouslySetInnerHTML={{__html: mini.contents}}/>
        </div>
    );
};
