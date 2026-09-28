import {Button, Callout, Flex} from "@radix-ui/themes";
import {CircleAlert, ExternalLink} from "lucide-react";

import {type ErrorState, usePreviewStore} from "./previewStore";

/** 글을 받지 못했을 때 본문 자리에 두는 안내 */
export const ErrorBlock = ({error}: { error: ErrorState }) => {
    const preData = usePreviewStore((s) => s.preData);
    const {detail, status, adult} = error;
    // 삭제된 글은 다시 받아도 같다. 원문 오류(요청 주소 등)는 콘솔에만 남기고 안내만 둔다
    const deleted = status === 404;
    const limited = status === 403 || status === 429;

    let text: string;
    if (adult) text = "성인 인증이 필요한 글입니다. 원문에서 확인해 주세요.";
    else if (deleted) text = "게시글이 삭제되었거나 존재하지 않습니다.";
    else if (limited) text = "요청이 많아 디시인사이드가 잠시 접속을 막았습니다. 잠시 기다린 뒤 다시 시도해 주세요.";
    else if (status && status >= 500) text = "디시인사이드 서버가 불안정합니다. 잠시 후 다시 시도해 주세요.";
    else if (/fetch|network|timed out/i.test(detail)) text = "디시인사이드에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
    else text = "게시글을 읽지 못했습니다. 다시 시도하거나 원문에서 확인해 주세요.";

    return (
        <Callout.Root color={adult ? "orange" : "red"} my="4">
            <Callout.Icon><CircleAlert size={16}/></Callout.Icon>
            <Callout.Text>{text}</Callout.Text>
            <Flex gap="2">
                {/* 성인 인증은 원문 페이지에서만 된다. 인증한 뒤 다시 시도하면 미리보기로 볼 수 있다 */}
                {adult && (
                    <Button size="1" variant="soft" color="orange" asChild>
                        <a href={preData?.link ?? location.href} target="_blank" rel="noreferrer">
                            <ExternalLink size={14}/>
                            원문 열기
                        </a>
                    </Button>
                )}
                {!deleted && (
                    <Button
                        size="1"
                        variant="soft"
                        color={adult ? "gray" : "red"}
                        // 같은 글을 다시 열면 컨트롤러가 제자리에서 다시 받는다
                        onClick={() => preData && usePreviewStore.getState().requestOpen(preData, usePreviewStore.getState().commentsOnly)}
                    >
                        다시 시도
                    </Button>
                )}
            </Flex>
        </Callout.Root>
    );
};
