import {Box, Card, Heading} from "@radix-ui/themes";
import {MINI_HEIGHT, MINI_WIDTH, usePreviewStore} from "./previewStore";

/**
 * 미니 미리보기 (툴팁) — 커서를 따라다니며 보기만 한다.
 * 카드가 포인터를 받으면 카드에 올라서는 순간 제목 칸의 mouseleave로 닫히므로 통과시킨다 (아래 제목 클릭은 그대로 미리보기를 연다)
 */
export const Mini = () => {
    const mini = usePreviewStore((s) => s.mini);

    if (!mini) return null;

    return (
        <Card size="2" className="refresher-mini-preview" style={{left: mini.x, top: mini.y, width: MINI_WIDTH, maxHeight: MINI_HEIGHT}}>
            <Heading as="h3" size="3" mb="2" truncate style={{flexShrink: 0}}>
                {mini.title}
            </Heading>
            <Box className="refresher-html refresher-mini-contents" dangerouslySetInnerHTML={{__html: mini.contents}}/>
        </Card>
    );
};
