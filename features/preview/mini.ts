import {BLOCKED_TEXT} from "@/core/block";
import type {GalleryPreData, PostInfo} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";

import type {Ctx} from "./meta";
import {buildPreData, isBlurHidden, isTextPost} from "./rows";
import {closeMiniSoon, hoverMini, keepMini, MINI_WIDTH, miniPosition, postTitle, usePreviewStore} from "./ui/previewStore";

/**
 * 미니 미리보기 (제목에 마우스를 올리면 뜨는 카드). 본문은 전체 미리보기와 같은 요청·캐시(getPost)로 받는다.
 * 제목 칸에 들어가고 나갈 때 부를 핸들러(rows-input.ts가 문서에서 받는다)와, 전체 미리보기를 열 때·모듈이 멈출 때 부를 leave를 돌려준다.
 */
export const createMini = (
    ctx: Ctx,
    getPost: (preData: GalleryPreData) => Promise<{ post: PostInfo }>,
    processContents: (preData: GalleryPreData, post: PostInfo, stripMedia?: boolean) => Promise<PostInfo>
) => {
    let miniTimer = 0;
    // 미니를 띄울 제목 칸. 본문을 받는 사이 커서가 떠났으면 띄우지 않는다.
    let miniTarget: HTMLElement | null = null;
    // 떠 있는 미니가 보여 주는 제목 칸.
    let miniFor: HTMLElement | null = null;

    const showMini = async (element: HTMLElement, x: number, y: number) => {
        const preData = buildPreData(element);
        if (!preData) return;

        const post = await getPost(preData).then(({post}) => processContents(preData, post, ctx.settings.tooltipMediaHide)).catch(() => undefined);

        // 받지 못했거나, 받는 사이 행을 떠났거나 전체 미리보기가 열렸으면 띄우지 않는다.
        if (!post || miniTarget !== element || usePreviewStore.getState().visible) return;

        // 조작할 수 있는 미니는 v5처럼 커서 바로 오른쪽에 붙인다(x+10, y-50). 오른쪽으로만 옮기면 다른 행을 지나지 않고 카드에 닿는다.
        // 오른쪽에 자리가 없어 커서 위로 밀려 오면 제목을 덮어 누를 수 없으니 커서 왼쪽에 붙인다.
        const position = ctx.settings.tooltipInteraction ? miniPosition(x - 6, y - 66) : miniPosition(x, y);
        if (ctx.settings.tooltipInteraction && position.x <= x) position.x = Math.max(0, x - MINI_WIDTH - 10);

        hoverMini();
        miniFor = element;
        usePreviewStore.setState({
            mini: {
                ...position,
                title: postTitle(post),
                // 미니에는 마우스를 올려 블러를 걷을 수 없으니 블러 차단도 안내 문구로 가린다.
                contents: post.textBlocked && !useUiStore.getState().blockView?.revealed ? BLOCKED_TEXT : post.contents ?? "",
                // 전체 미리보기와 같은 조건으로 이미지를 가린다. 다르면 거기서 숨긴 이미지가 호버로 보인다.
                blockMedia: ctx.settings.blockImage && isTextPost(preData),
                interactive: ctx.settings.tooltipInteraction,
                gallery: preData.gallery
            }
        });
    };

    /** element: 커서가 들어간 제목 칸. */
    const onMiniEnter = (element: HTMLElement, ev: MouseEvent) => {
        if (!ctx.settings.tooltipMode) return;
        if (usePreviewStore.getState().visible) return;

        if (isBlurHidden(element)) return;
        // 조작할 수 있는 미니에서 제목으로 돌아왔으면 닫지 않는다. 떠난 제목의 닫기 타이머는 다른 제목에 들어와도 끊어야
        // 새로 뜰 카드를 닫지 않으므로 keepMini는 늘 부른다. 다른 제목이면 앞 글의 카드는 바로 내린다 (새 글을 받지 못하면 앞 글 카드가 그대로 남는다).
        keepMini();
        if (element !== miniFor && usePreviewStore.getState().mini) usePreviewStore.setState({mini: null});
        const x = ev.clientX;
        const y = ev.clientY;

        miniTarget = element;
        window.clearTimeout(miniTimer);
        // 지연 시간 동안 머문 제목만 받는다. 목록을 훑으며 지나간 행은 요청을 보내지 않는다 (지연 시간 최소값은 meta.ts).
        miniTimer = window.setTimeout(() => void showMini(element, x, y), ctx.settings.tooltipDelay);
    };

    const onMiniMove = (ev: MouseEvent) => {
        // 조작할 수 있는 미니는 커서를 따라가면 카드로 옮겨 갈 수 없다.
        if (!usePreviewStore.getState().mini?.interactive) usePreviewStore.getState().moveMini(ev.clientX, ev.clientY);
    };

    /** soon: 조작할 수 있는 미니면 커서가 카드로 옮겨 갈 틈을 두고 닫는다 (제목에서 나갈 때). */
    const onMiniLeave = (soon = false) => {
        window.clearTimeout(miniTimer);
        // 받는 중인 본문은 끊지 않는다. 클릭해 열면 같은 요청을 이어 쓰고, 다른 글을 받을 때 끊긴다.
        miniTarget = null;
        const {mini} = usePreviewStore.getState();
        if (soon && mini?.interactive) {
            closeMiniSoon();
            return;
        }
        keepMini();
        hoverMini();
        // 떠 있을 때만 비운다. 제목 칸을 지날 때마다 setState하면 스토어를 구독하는 창·댓글이 모두 다시 확인한다.
        if (mini) usePreviewStore.setState({mini: null});
    };

    return {onMiniEnter, onMiniMove, onMiniLeave, onMiniLeaveSoon: () => onMiniLeave(true)};
};
