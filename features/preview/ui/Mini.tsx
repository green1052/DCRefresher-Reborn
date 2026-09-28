import {Box, Card, Heading} from "@radix-ui/themes";
import {useEffect, useRef} from "react";
import {MINI_HEIGHT, MINI_WIDTH, usePreviewStore} from "./previewStore";

/**
 * 미니 미리보기 (툴팁). 커서를 따라다니며 보기만 한다.
 * 카드는 포인터를 통과시킨다. 포인터를 받으면 카드에 올라서는 순간 제목 칸의 mouseleave로 닫히고,
 * 통과시키면 아래 제목 클릭이 그대로 미리보기를 연다.
 */
export const Mini = () => {
    const mini = usePreviewStore((s) => s.mini);
    const wheel = mini?.wheel ?? false;
    const contents = useRef<HTMLDivElement>(null);

    // 포인터를 통과시키니 휠도 카드에 닿지 않는다. 설정(tooltipWheel)을 켰으면 떠 있는 동안(커서가 제목 위일 때) 굴리면 v5처럼 내용을 스크롤하고,
    // 더 굴러갈 데가 없으면(끝이거나 짧은 글) 막지 않아 페이지가 스크롤된다.
    useEffect(() => {
        if (!wheel) return;

        const onWheel = (ev: WheelEvent): void => {
            const box = contents.current;
            if (!box || ev.ctrlKey || ev.shiftKey) return;

            const before = box.scrollTop;
            // deltaMode 1은 줄 단위(파이어폭스 마우스 휠), 2는 쪽 단위다
            box.scrollTop += ev.deltaY * (ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? box.clientHeight : 1);
            if (box.scrollTop !== before) ev.preventDefault();
        };

        window.addEventListener("wheel", onWheel, {passive: false});
        return () => window.removeEventListener("wheel", onWheel);
    }, [wheel]);

    if (!mini) return null;

    return (
        <Card size="2" className="refresher-mini-preview" style={{left: mini.x, top: mini.y, width: MINI_WIDTH, maxHeight: MINI_HEIGHT}}>
            <Heading as="h3" size="3" mb="2" truncate style={{flexShrink: 0}}>
                {mini.title}
            </Heading>
            <Box ref={contents} className={"refresher-html refresher-mini-contents" + (mini.blockMedia ? " refresher-preview-block-media" : "")}
                 dangerouslySetInnerHTML={{__html: mini.contents}}/>
        </Card>
    );
};
