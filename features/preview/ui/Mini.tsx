import {Box, Card, Heading, Link} from "@radix-ui/themes";

import {MINI_HEIGHT, MINI_WIDTH, usePreviewStore} from "./previewStore";

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
        <Card
            size="2"
            className="refresher-mini-preview refresher-interactive"
            style={{left: mini.x, top: mini.y, width: MINI_WIDTH, maxHeight: MINI_HEIGHT}}
            onMouseLeave={() => usePreviewStore.getState().closeMini()}
        >
            <Heading as="h3" size="3" mb="2" truncate style={{cursor: "pointer", flexShrink: 0}} onClick={openFull}>
                {mini.title}
            </Heading>
            <Box className="refresher-html refresher-mini-contents" dangerouslySetInnerHTML={{__html: mini.contents}}/>
            <Box mt="2" flexShrink="0">
                <Link size="1" href={mini.preData.link} onClick={(event) => {
                    event.preventDefault();
                    openFull();
                }}>
                    {mini.preData.title ?? "게시글 더 보기"}
                </Link>
            </Box>
        </Card>
    );
};
