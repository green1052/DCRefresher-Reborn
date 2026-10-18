import {type RefObject, useEffect} from "react";

import {useRunningModuleSettings} from "@/core/module/useModuleSettings";
import {useBlocksStore} from "@/stores/blocks";

import {markBlockedMedia} from "./blockedDccons";
import {fitMovies} from "./fitMovies";
import {watchGifVideos} from "./gifVideos";

/**
 * 미리보기 본문(Frame.tsx의 PostContents, Mini.tsx)에 넣은 HTML을 손본다. html이 바뀌면 다시 본다.
 * 디시 동영상 iframe 크기를 맞추고, 깨진 움짤·디시콘 mp4는 디시처럼 gif로 바꾸고, 차단 디시콘·이미지는 페이지 글 보기처럼 그것만 가린다.
 * 차단은 차단 목록이나 설정이 바뀌어도 다시 본다. hideOnly면 흐리게 처리여도 숨긴다.
 */
export const usePreviewMedia = (ref: RefObject<HTMLElement | null>, html: string | undefined, gallery: string | undefined, hideOnly = false): void => {
    const block = useRunningModuleSettings("block");
    const blockEntries = useBlocksStore((s) => s.entries);
    const blockDefaults = useBlocksStore((s) => s.defaults);

    useEffect(() => (ref.current ? fitMovies(ref.current) : undefined), [html]);
    useEffect(() => (ref.current ? watchGifVideos(ref.current) : undefined), [html]);
    useEffect(() => (ref.current ? markBlockedMedia(ref.current, gallery, block, hideOnly) : undefined), [html, gallery, block, blockEntries, blockDefaults, hideOnly]);
};
