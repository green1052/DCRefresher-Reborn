import {Box, Flex, IconButton, Link, Text, TextArea, TextField, Tooltip} from "@radix-ui/themes";
import {Send, Smile, X} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {storage} from "wxt/utils/storage";

import {overlay} from "@/components/overlay/shadow";
import {captchaImage, submitComment} from "@/core/preview/request";
import type {DcinsideDccon} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {loggedInUserId} from "@/utils/user";

import {getGrecaptchaToken} from "../grecaptcha";
import {DcconPopup} from "./DcconPopup";
import {usePreviewStore} from "./previewStore";

const randomPassword = (): string => Math.random().toString(36).slice(2, 10);

// 비회원 자격은 확장 isolated storage에만 보관 (페이지 world 접근 차단)
const nonmemberStorage = storage.defineItem<{ nick: string; pw: string }>("local:refresher:nonmember", {
    defaultValue: {nick: "", pw: ""}
});

/** 댓글 작성 폼 */
export const WriteComment = () => {
    const reply = usePreviewStore((s) => s.reply);
    const [login] = useState(() => Boolean(document.querySelector("#login_box .user_info .nickname > em")));
    const [accountId] = useState(loggedInUserId);
    const [nick, setNick] = useState("ㅇㅇ");
    const [password, setPassword] = useState("");
    const [dccons, setDccons] = useState<DcinsideDccon[]>([]);
    const [bigDccon, setBigDccon] = useState(false);
    const [dcconOpen, setDcconOpen] = useState(false);
    const [showInputs, setShowInputs] = useState(false);
    const [sending, setSending] = useState(false);
    const textarea = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        void nonmemberStorage.getValue().then((saved) => {
            setNick(saved.nick || "ㅇㅇ");
            setPassword(saved.pw || randomPassword());
        });
    }, []);

    const saveNonmember = (next: { nick?: string; pw?: string }): void => {
        void nonmemberStorage.getValue().then((prev) => void nonmemberStorage.setValue({
            nick: next.nick ?? prev.nick,
            pw: next.pw ?? prev.pw
        }));
    };

    const submit = async (): Promise<void> => {
        const st = usePreviewStore.getState();
        const text = textarea.current?.value.trim() ?? "";
        const useDccon = dccons.length > 0;

        if (!st.preData || !st.post || sending) return;
        if (!useDccon && !text) return;

        if (!login && (!nick || !password)) {
            useUiStore.getState().showToast("아이디 혹은 비밀번호를 입력하지 않았습니다.", "error");
            return;
        }

        setSending(true);
        try {
            let code: string | undefined;
            if (st.post.requireCommentCaptcha) {
                code = await st.openCaptcha(captchaImage(st.preData, "comment"));
                if (!code) return;
            }

            const token = await getGrecaptchaToken("comment");

            const response = await submitComment(
                st.preData,
                {name: login ? "" : nick, pw: login ? undefined : password},
                st.post.dom ?? document,
                useDccon ? dccons : text,
                st.reply.commentNo,
                st.reply.replyNo,
                useDccon && bigDccon,
                code,
                token
            );

            if (response.result === "SUCCESS") {
                if (textarea.current) textarea.current.value = "";
                setDccons([]);
                setBigDccon(false);
                st.setReply({commentNo: null, replyNo: null});
                st.requestRefresh();
            } else {
                useUiStore.getState().showToast(response.message || "댓글 작성에 실패했습니다.", "error");
            }
        } catch {
            useUiStore.getState().showToast("댓글 작성 중 오류가 발생했습니다.", "error");
        } finally {
            setSending(false);
        }
    };

    const mode = reply.replyNo ? "답글" : dccons.length > 0 ? "디시콘" : "댓글";

    return (
        <Box pl="6" pr="9" pt="3" pb="5">
            {!login && showInputs && (
                <Flex gap="2" mb="2">
                    <TextField.Root
                        size="2"
                        value={nick}
                        placeholder="닉네임"
                        maxLength={20}
                        style={{flex: 1}}
                        onChange={(event) => {
                            setNick(event.target.value);
                            saveNonmember({nick: event.target.value});
                        }}
                    />
                    <TextField.Root
                        size="2"
                        type="password"
                        value={password}
                        placeholder="비밀번호"
                        style={{flex: 1}}
                        onChange={(event) => {
                            setPassword(event.target.value);
                            saveNonmember({pw: event.target.value});
                        }}
                    />
                </Flex>
            )}

            <Flex gap="2" align="end">
                <TextArea
                    ref={textarea}
                    size="2"
                    rows={2}
                    resize="vertical"
                    disabled={dccons.length > 0}
                    placeholder={dccons.length > 0 ? "디시콘이 선택됐습니다." : "댓글 입력... (Shift+Enter 줄바꿈)"}
                    style={{flex: 1}}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void submit();
                        }
                    }}
                />
                <Flex direction="column" gap="2">
                    {dccons.length > 0 ? (
                        <Tooltip content="디시콘 취소" container={overlay.portal}>
                            <IconButton variant="soft" color="gray" aria-label="디시콘 취소" onClick={() => {
                                setDccons([]);
                                setBigDccon(false);
                            }}>
                                <X size={16}/>
                            </IconButton>
                        </Tooltip>
                    ) : (
                        <Tooltip content="디시콘" container={overlay.portal}>
                            <IconButton variant="soft" color="gray" aria-label="디시콘" onClick={() => setDcconOpen(true)}>
                                <Smile size={16}/>
                            </IconButton>
                        </Tooltip>
                    )}
                    <IconButton aria-label="작성" loading={sending} onClick={() => void submit()}>
                        <Send size={16}/>
                    </IconButton>
                </Flex>
            </Flex>

            <Text as="p" size="1" color="gray" mt="2">
                {login ? (accountId ?? "회원 계정") : (
                    <Link size="1" href="#" onClick={(event) => {
                        event.preventDefault();
                        setShowInputs((v) => !v);
                    }}>
                        {nick}
                    </Link>
                )}
                (으)로 {mode} 작성 중
            </Text>

            {dcconOpen && (
                <DcconPopup
                    onSelect={(selected, big) => {
                        setDccons(selected);
                        setBigDccon(big);
                        setDcconOpen(false);
                    }}
                    onClose={() => setDcconOpen(false)}
                />
            )}
        </Box>
    );
};
