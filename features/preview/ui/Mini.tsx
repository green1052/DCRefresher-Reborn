import {Box, Card, Heading} from "@radix-ui/themes";
import {useEffect, useRef} from "react";
import {useBlocksStore} from "@/stores/blocks";
import {useUiStore} from "@/stores/ui";

import {markBlockedDccons} from "./blockedDccons";
import {watchGifVideos} from "./gifVideos";
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
        <Card size="2" className={"refresher-mini-preview" + (mini.interactive ? " refresher-interactive" : "")}
              onPointerEnter={mini.interactive ? () => hoverMini(true) : undefined} onPointerLeave={mini.interactive ? () => hoverMini(false) : undefined}
              style={{left: mini.x, top: mini.y, width: MINI_WIDTH, maxWidth: "calc(100vw - 20px)", maxHeight: `min(${MINI_HEIGHT}px, calc(100vh - 20px))`}}>
            <Heading as="h3" size="3" mb="2" truncate style={{flexShrink: 0}}>
                {mini.title}
            </Heading>
            <Box ref={contents} className={"refresher-html refresher-mini-contents" + (mini.blockMedia ? " refresher-preview-block-media" : "")}
                 dangerouslySetInnerHTML={{__html: mini.contents}}/>
        </Card>
    );
};
