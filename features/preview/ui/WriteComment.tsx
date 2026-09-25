import {Box, Flex, IconButton, Link, Text, TextArea, TextField, Tooltip} from "@radix-ui/themes";
import {Send, Smile, Type, X} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {storage} from "wxt/utils/storage";

import {overlay} from "@/components/overlay/shadow";
import {
    captchaImage,
    normalizeTxtcon,
    submitComment,
    type SubmitResult,
    submitTxtcon,
    TXTCON_BACKGROUNDS,
    TXTCON_COLORS
} from "@/core/preview/request";
import type {DcinsideDccon} from "@/core/preview/types";
import {sendMessage} from "@/core/messaging/protocol";
import {useUiStore} from "@/stores/ui";
import {loggedInUserId} from "@/utils/user";

import {DcconPopup} from "./DcconPopup";
import {usePreviewStore} from "./previewStore";

const randomPassword = (): string => Math.random().toString(36).slice(2, 10);

// 'false||메시지' 외 실패 응답 (dccon.js·txtcon.js)
const FAIL_MESSAGES: Record<string, string> = {
    code_fail: "자동입력 방지코드가 일치하지 않습니다.",
    fail1: "이름과 비밀번호를 정확하게 입력해주세요.",
    form_error: "이름과 비밀번호를 정확하게 입력해주세요."
};

const failMessage = (response: SubmitResult): string | undefined => {
    if (response.result !== "false") return FAIL_MESSAGES[response.result];

    return response.message === "nomember" ? response.detail : response.message;
};

/** 글자콘 색 스와치 */
const Swatch = ({color, selected, label, onClick}: {
    color: string;
    selected: boolean;
    label: string;
    onClick: () => void
}) => (
    <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={onClick}
        style={{
            width: 18,
            height: 18,
            padding: 0,
            borderRadius: "50%",
            cursor: "pointer",
            background: `#${color}`,
            border: "1px solid var(--gray-a7)",
            outline: selected ? "2px solid var(--accent-9)" : "none",
            outlineOffset: 1
        }}
    />
);

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
    const [txtcon, setTxtcon] = useState(false);
    const [txtconColors, setTxtconColors] = useState({bg: "3b4890", txt: "ffffff"});
    const [showInputs, setShowInputs] = useState(false);
    const [sending, setSending] = useState(false);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const beforeTxtcon = useRef<string | null>(null);

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
        const raw = textarea.current?.value ?? "";
        const text = (txtcon ? normalizeTxtcon(raw) : raw).trim();
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

            const {preData, post} = st;
            const user = {name: login ? "" : nick, pw: login ? undefined : password};
            const send = (token?: string): Promise<SubmitResult> =>
                txtcon
                    ? submitTxtcon(preData, post, user, text, txtconColors, st.reply.commentNo, st.reply.replyNo, code, token)
                    : submitComment(
                        preData,
                        post,
                        user,
                        useDccon ? dccons : text,
                        st.reply.commentNo,
                        st.reply.replyNo,
                        useDccon && bigDccon,
                        code,
                        token
                    );

            // 첫 전송은 토큰 없이, 'false||captcha||v3'일 때만 v3 토큰을 붙여 한 번 더 (디시 comment.js·dccon.js·txtcon.js와 같음)
            let response = await send();
            if (response.message === "captcha" && response.detail === "v3") {
                const token = await sendMessage("refresher:grecaptchaToken", txtcon || useDccon ? "insert_icon" : "comment_submit").catch(() => undefined);
                if (token) response = await send(token);
            }

            // 댓글은 새 댓글 번호, 디시콘·글자콘은 'ok'
            if (txtcon || useDccon ? response.result === "ok" : response.result !== "false") {
                if (textarea.current) textarea.current.value = "";
                setDccons([]);
                setBigDccon(false);
                setTxtcon(false);
                st.setReply({commentNo: null, replyNo: null});
                st.requestRefresh();
            } else if (response.message === "captcha") {
                // v2 체크박스나 v3 재전송도 막히면 원문에서만 풀 수 있다
                useUiStore.getState().showToast(
                    "자동등록방지 확인이 필요합니다. 원문에서 작성해 주세요. (클릭하면 원문 열기)",
                    "warning",
                    8000,
                    () => window.open(preData.link ?? location.href, "_blank")
                );
            } else {
                useUiStore.getState().showToast(failMessage(response) || "댓글 작성에 실패했습니다.", "error");
            }
        } catch {
            useUiStore.getState().showToast("댓글 작성 중 오류가 발생했습니다.", "error");
        } finally {
            setSending(false);
        }
    };

    /** 글자콘 입력 제한 적용. 값이 바뀔 때만 다시 쓰고, 한글 조합 중엔 조합이 끝난 뒤 부른다 (txtcon.js와 같음) */
    const applyTxtcon = (): void => {
        const element = textarea.current;
        if (!element) return;

        const next = normalizeTxtcon(element.value);
        if (next !== element.value) element.value = next;
    };

    /** 글자콘을 끈다. 켤 때 잘린 글을 손대지 않았으면 원문으로 되돌린다 — 토글과 디시콘 선택 둘 다 여기로 */
    const exitTxtcon = (): void => {
        const element = textarea.current;
        if (element && beforeTxtcon.current !== null && element.value === normalizeTxtcon(beforeTxtcon.current)) {
            element.value = beforeTxtcon.current;
        }
        beforeTxtcon.current = null;
        setTxtcon(false);
    };

    const mode = reply.replyNo ? "답글" : txtcon ? "글자콘" : dccons.length > 0 ? "디시콘" : "댓글";

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
                    placeholder={
                        dccons.length > 0 ? "디시콘이 선택됐습니다."
                            : txtcon ? "글자콘 입력... (최대 20자, 4줄, 줄당 5자로 나뉨)"
                                : "댓글 입력... (Shift+Enter 줄바꿈)"
                    }
                    style={{flex: 1}}
                    onChange={(event) => {
                        if (txtcon && !(event.nativeEvent as InputEvent).isComposing) applyTxtcon();
                    }}
                    onCompositionEnd={() => {
                        if (txtcon) applyTxtcon();
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void submit();
                        }
                    }}
                />
                <Flex direction="column" gap="2">
                    <Flex gap="2">
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
                        <Tooltip content={txtcon ? "글자콘 취소" : "글자콘"} container={overlay.portal}>
                            <IconButton
                                variant="soft"
                                color={txtcon ? undefined : "gray"}
                                aria-label="글자콘"
                                aria-pressed={txtcon}
                                onClick={() => {
                                    // 디시콘과 같이 쓰지 않는다
                                    setDccons([]);
                                    setBigDccon(false);

                                    if (txtcon) {
                                        exitTxtcon();
                                        return;
                                    }

                                    // 켤 때 잘리는 글을 기억했다가, 그대로 끄면 되돌린다
                                    beforeTxtcon.current = textarea.current?.value ?? null;
                                    applyTxtcon();
                                    setTxtcon(true);
                                }}
                            >
                                <Type size={16}/>
                            </IconButton>
                        </Tooltip>
                    </Flex>
                    <IconButton aria-label="작성" loading={sending} style={{width: "100%"}} onClick={() => void submit()}>
                        <Send size={16}/>
                    </IconButton>
                </Flex>
            </Flex>

            {txtcon && (
                <Flex gap="2" align="center" wrap="wrap" mt="2">
                    <Text size="1" color="gray">배경</Text>
                    {TXTCON_BACKGROUNDS.map((bg) => (
                        <Swatch key={bg} color={bg} label={`배경색 #${bg}`} selected={txtconColors.bg === bg}
                                onClick={() => setTxtconColors((prev) => ({...prev, bg}))}/>
                    ))}
                    <Text size="1" color="gray" ml="2">글자</Text>
                    {TXTCON_COLORS.map((txt) => (
                        <Swatch key={txt} color={txt} label={`글자색 #${txt}`} selected={txtconColors.txt === txt}
                                onClick={() => setTxtconColors((prev) => ({...prev, txt}))}/>
                    ))}
                </Flex>
            )}

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
                        if (txtcon) exitTxtcon();
                        setDcconOpen(false);
                    }}
                    onClose={() => setDcconOpen(false)}
                />
            )}
        </Box>
    );
};
