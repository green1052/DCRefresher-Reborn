import {Button, Flex, IconButton, Text, Tooltip} from "@radix-ui/themes";
import {ChevronDown, ChevronUp, ExternalLink, Link2} from "lucide-react";
import {useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {getEntry, setEntry} from "@/core/preview/cache";
import {captchaImage, viewUrl, vote} from "@/core/preview/request";
import type {GalleryPreData, PostInfo} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {notifyManage} from "@/utils/notify";

import {usePreviewStore} from "./previewStore";

/** 본문 아래 추천·비추천과 링크 복사·새 탭 열기 */
export const Votes = ({post}: { post: PostInfo }) => {
    const preData = usePreviewStore((s) => s.preData);
    const {upvotes, fixedUpvotes, downvotes} = post;
    // 보내는 중인 쪽. 연타로 추천 POST가 두 번 가지 않게 막는다.
    const [voting, setVoting] = useState<"U" | "D" | null>(null);

    const castVote = async (target: GalleryPreData, mode: "U" | "D"): Promise<void> => {
        const signal = usePreviewStore.getState().signalId;
        const label = mode === "U" ? "추천" : "비추천";
        let code: string | undefined;
        if (post.requireCaptcha) {
            code = await usePreviewStore.getState().openCaptcha(captchaImage(target, "recommend"));
            if (!code) return;
        }

        const request = vote(target, post, mode, code);
        if (!(await notifyManage(request, `${label}했습니다.`, `${label}하지 못했습니다. 잠시 후 다시 시도해 주세요.`))) return;

        // notifyManage가 기다린 요청이라 결과만 꺼낸다
        const result = await request;
        const counts = mode === "U"
            ? {upvotes: result.counts ?? upvotes ?? "X", fixedUpvotes: result.fixedCounts || undefined}
            : {downvotes: result.counts ?? downvotes};
        // 응답 전에 다른 글로 넘어갔으면 숫자는 고치지 않고 알림만 띄운다.
        // 함수형 setState로 지금 post를 읽어야 동시에 끝난 추천·비추천이 서로 덮지 않는다.
        usePreviewStore.setState((s) => (s.signalId !== signal || !s.post ? {} : {post: {...s.post, ...counts}}));
        // 1분 안에 다시 열면 캐시 본문을 쓰므로 거기 숫자도 고친다.
        const cached = getEntry(target)?.post;
        if (cached) setEntry(target, {post: {...cached, ...counts}});
    };

    // try/finally는 React Compiler가 컴파일하지 못해 .finally로 푼다
    const onVote = (mode: "U" | "D"): void => {
        if (!preData || voting) return;
        setVoting(mode);
        void castVote(preData, mode).finally(() => setVoting(null));
    };

    // 목록 쿼리(검색어·페이지)를 뺀 글 주소를 복사한다.
    const onShare = (): void => {
        if (!preData) return;
        navigator.clipboard.writeText(viewUrl(preData.link, preData.gallery, preData.id)).then(
            () => useUiStore.getState().showToast("링크를 복사했습니다."),
            () => useUiStore.getState().showToast("링크를 복사하지 못했습니다.", "error")
        );
    };

    // 숫자까지 읽히게 라벨에 넣는다. aria-label은 버튼 안의 글을 대신한다
    return (
        <Flex justify="center" align="center" gap="3" py="5">
            <Button size="3" variant="soft" aria-label={`추천 ${upvotes || "X"}${fixedUpvotes ? ` (고정닉 ${fixedUpvotes})` : ""}`}
                    loading={voting === "U"} disabled={voting === "D"} onClick={() => onVote("U")}>
                <ChevronUp size={18}/>
                {upvotes || "X"}
                {fixedUpvotes && <Text size="2" color="gray">({fixedUpvotes})</Text>}
            </Button>
            {downvotes !== undefined && (
                <Button size="3" variant="soft" color="gray" aria-label={`비추천 ${downvotes}`} loading={voting === "D"} disabled={voting === "U"}
                        onClick={() => onVote("D")}>
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
                    <a href={preData?.link ?? location.href} target="_blank" rel="noreferrer" aria-label="새 탭으로 열기">
                        <ExternalLink size={18}/>
                    </a>
                </IconButton>
            </Tooltip>
        </Flex>
    );
};
