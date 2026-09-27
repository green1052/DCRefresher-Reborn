import {Button, Flex, IconButton, Text, Tooltip} from "@radix-ui/themes";
import {ChevronDown, ChevronUp, ExternalLink, Link2} from "lucide-react";
import {useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {getEntry, setEntry} from "@/core/preview/cache";
import {captchaImage, viewUrl, vote} from "@/core/preview/request";
import type {PostInfo} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";

import {usePreviewStore} from "./previewStore";

/** 본문 아래 추천·비추천과 링크 복사·새 탭 열기 */
export const Votes = ({post}: { post: PostInfo }) => {
    const preData = usePreviewStore((s) => s.preData);
    const {upvotes, fixedUpvotes, downvotes} = post;
    // 보내는 중인 쪽. 연타로 추천 POST가 두 번 가지 않게 막는다.
    const [voting, setVoting] = useState<"U" | "D" | null>(null);

    const onVote = async (mode: "U" | "D"): Promise<void> => {
        if (!preData || voting) return;
        const signal = usePreviewStore.getState().signalId;
        setVoting(mode);
        try {
            let code: string | undefined;
            if (post.requireCaptcha) {
                code = await usePreviewStore.getState().openCaptcha(captchaImage(preData, "recommend"));
                if (!code) return;
            }

            const result = await vote(preData, post, mode, code);
            if (result.success) {
                const counts = mode === "U"
                    ? {upvotes: result.counts ?? upvotes ?? "X", fixedUpvotes: result.fixedCounts || undefined}
                    : {downvotes: result.counts ?? downvotes};
                // 응답 전에 다른 글로 넘어갔으면 숫자는 고치지 않고 알림만 띄운다.
                // 함수형 setState로 지금 post를 읽어야 동시에 끝난 추천·비추천이 서로 덮지 않는다.
                usePreviewStore.setState((s) => (s.signalId !== signal || !s.post ? {} : {post: {...s.post, ...counts}}));
                // 1분 안에 다시 열면 캐시 본문을 쓰므로 거기 숫자도 고친다.
                const cached = getEntry(preData)?.post;
                if (cached) setEntry(preData, {post: {...cached, ...counts}});
                useUiStore
                    .getState()
                    .showToast(`${mode === "U" ? "추천" : "비추천"}되었습니다.`);
            } else {
                useUiStore.getState().showToast(result.message ?? "처리하지 못했습니다.", "error");
            }
        } catch {
            useUiStore.getState().showToast("추천 처리 중 오류가 발생했습니다.", "error");
        } finally {
            setVoting(null);
        }
    };

    // 목록 쿼리(검색어·페이지)를 뺀 글 주소를 복사한다.
    const onShare = (): void => {
        if (!preData) return;
        navigator.clipboard.writeText(viewUrl(preData.link, preData.gallery, preData.id)).then(
            () => useUiStore.getState().showToast("링크를 복사했습니다."),
            () => useUiStore.getState().showToast("링크를 복사하지 못했습니다.", "error")
        );
    };

    return (
        <Flex justify="center" align="center" gap="3" py="5">
            <Button size="3" variant="soft" aria-label="추천" loading={voting === "U"} disabled={voting === "D"} onClick={() => void onVote("U")}>
                <ChevronUp size={18}/>
                {upvotes || "X"}
                {fixedUpvotes && <Text size="2" color="gray">({fixedUpvotes})</Text>}
            </Button>
            {downvotes !== undefined && (
                <Button size="3" variant="soft" color="gray" aria-label="비추천" loading={voting === "D"} disabled={voting === "U"}
                        onClick={() => void onVote("D")}>
                    <ChevronDown size={18}/>
                    {downvotes}
                </Button>
            )}
            <Tooltip content="링크 복사" container={overlay.portal}>
                <IconButton size="3" variant="ghost" color="gray" aria-label="링크 복사" onClick={onShare}>
                    <Link2 size={18}/>
                </IconButton>
            </Tooltip>
            <Tooltip content="새 탭으로 열기" container={overlay.portal}>
                <IconButton size="3" variant="ghost" color="gray" asChild>
                    <a href={preData?.link ?? location.href} target="_blank" rel="noreferrer">
                        <ExternalLink size={18}/>
                    </a>
                </IconButton>
            </Tooltip>
        </Flex>
    );
};
