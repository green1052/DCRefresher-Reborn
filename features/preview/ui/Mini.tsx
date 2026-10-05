import {useEffect, useRef} from "react";

import {useBlocksStore} from "@/stores/blocks";
import {useUiStore} from "@/stores/ui";

import {markBlockedDccons} from "./blockedDccons";
import {watchGifVideos} from "./gifVideos";
import {cn} from "cn";

import {hoverMini, MINI_HEIGHT, MINI_WIDTH, usePreviewStore} from "./previewStore";

/**
 * 미니 미리보기 (툴팁). 커서를 따라다니며 보기만 한다.
 * 카드는 포인터를 통과시킨다. 포인터를 받으면 카드에 올라서는 순간 제목 칸을 떠난 것(mouseout)으로 보고 닫히고,
 * 통과시키면 아래 제목 클릭이 그대로 미리보기를 연다.
 * 상호작용(tooltipInteraction)을 켜면 카드가 포인터를 받는다. 커서를 따라다니지 않고, 제목과 카드 사이를 옮겨 가는 동안은 닫지 않는다.
 */
export const Mini = () => {
    const mini = usePreviewStore((s) => s.mini);
    const contents = useRef<HTMLDivElement>(null);

    // 깨진 움짤·디시콘 mp4는 전체 미리보기처럼 gif로 바꾼다 (Frame.tsx). 내용이 바뀔 때마다 새로 그려진다.
    useEffect(() => (contents.current ? watchGifVideos(contents.current) : undefined), [mini?.contents]);

    // 본문의 차단 디시콘을 가린다. 마우스를 올려 흐림을 걷을 수 없으니 흐리게 처리여도 숨긴다.
    const blocking = useUiStore((s) => s.blockView !== null);
    const blockEntries = useBlocksStore((s) => s.entries);
    const blockDefaults = useBlocksStore((s) => s.defaults);
    useEffect(() => {
        if (contents.current) markBlockedDccons(contents.current, mini?.gallery, blocking ? "hide" : undefined);
    }, [mini?.contents, mini?.gallery, blocking, blockEntries, blockDefaults]);

    if (!mini) return null;

    return (
        <div className={cn("refresher-mini-preview fixed flex max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-xl bg-card p-3 text-card-foreground shadow-lg ring-1 ring-foreground/10",
                           mini.interactive && "pointer-events-auto")}
             onPointerEnter={mini.interactive ? () => hoverMini(true) : undefined} onPointerLeave={mini.interactive ? () => hoverMini(false) : undefined}
             style={{left: mini.x, top: mini.y, width: MINI_WIDTH, maxHeight: `min(${MINI_HEIGHT}px, calc(100vh - 20px))`}}>
            <h3 className="mb-2 shrink-0 truncate text-base font-bold">{mini.title}</h3>
            {/* 카드가 포인터를 통과시키면(상호작용 설정이 꺼진 기본값) 직접 굴릴 수 없다. 휠 설정을 켜면 제목 위에서 굴릴 때 mini.ts가 스크롤한다.
                스크롤바는 내용이 더 있다는 표시다. 넓은 내용은 옆을 자른다 (overflow-y만 auto면 가로 스크롤바가 생긴다). */}
            <div ref={contents}
                 className={cn("refresher-html refresher-mini-contents min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]",
                               mini.blockMedia && "refresher-preview-block-media")}
                 dangerouslySetInnerHTML={{__html: mini.contents}}/>
        </div>
    );
};
