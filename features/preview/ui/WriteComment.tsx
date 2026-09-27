import {Box, Flex, IconButton, Link, Text, TextArea, TextField, Tooltip} from "@radix-ui/themes";
import {Send, Smile, Type, X} from "lucide-react";
import {useLayoutEffect, useRef, useState} from "react";

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

import {saveNonmember, savedNonmember} from "../nonmember";
import {DcconPopup} from "./DcconPopup";
import {usePreviewStore} from "./previewStore";

/** 비회원 댓글 비밀번호 (영문 소문자·숫자 8자) */
const randomPassword = (): string => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => (byte % 36).toString(36)).join("");

// 'false||메시지' 형식이 아닌 실패 응답 코드 (디시 dccon.js·txtcon.js에서 옮김)
const FAIL_MESSAGES: Record<string, string> = {
    code_fail: "자동입력 방지코드가 일치하지 않습니다.",
    fail1: "이름과 비밀번호를 정확하게 입력해주세요.",
    form_error: "이름과 비밀번호를 정확하게 입력해주세요."
};

/**
 * 댓글이 올라갔는지. 디시 comment.js처럼 'false'가 아니면 성공(새 댓글 번호)으로 보되, 확실한 실패는 거른다:
 * 실패 코드, 빈 응답, HTML 페이지(로그인이 풀렸거나 오류 페이지). 성공으로 잘못 보면 입력한 글을 지워 버린다
 */
const isCommentPosted = ({result}: SubmitResult): boolean =>
    result !== "false" && result !== "" && !result.trimStart().startsWith("<") && !Object.hasOwn(FAIL_MESSAGES, result);

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

/** 쓰던 댓글 하나를 모듈 전역에 둔다. 창을 닫았다 같은 글을 다시 열면 되살리고, 다른 글을 열면 버린다 */
let draft = {key: "", text: ""};

export const WriteComment = () => {
    const reply = usePreviewStore((s) => s.reply);
    // 폼은 글마다 새로 마운트된다 (Frame의 key). 마운트할 때 이 글에서 쓰던 댓글이 있으면 되살린다.
    const [initialText] = useState(() => {
        const preData = usePreviewStore.getState().preData;
        const key = preData ? `${preData.gallery}/${preData.id}` : "";
        if (draft.key !== key) draft = {key, text: ""};
        return draft.text;
    });
    const [login] = useState(() => Boolean(document.querySelector("#login_box .user_info .nickname > em")));
    const [accountId] = useState(loggedInUserId);
    const [nick, setNick] = useState(() => savedNonmember().nick || "ㅇㅇ");
    // 기억한 비밀번호가 없으면 하나 만든다. 쓸 때 저장되므로 이후 같은 비밀번호로 자기 댓글을 지울 수 있다
    const [password, setPassword] = useState(() => savedNonmember().pw || randomPassword());
    // 저장된 비밀번호는 입력칸에 넣지 않는다. 오버레이 섀도 루트가 open이라 페이지 스크립트가 값을 읽을 수 있다.
    // 사용자가 직접 고친 뒤에만 입력칸에 값이 보인다.
    const [passwordEdited, setPasswordEdited] = useState(false);
    const [dccons, setDccons] = useState<DcinsideDccon[]>([]);
    const [bigDccon, setBigDccon] = useState(false);
    const [dcconOpen, setDcconOpen] = useState(false);
    const [txtcon, setTxtcon] = useState(false);
    const [txtconColors, setTxtconColors] = useState({bg: "3b4890", txt: "ffffff"});
    const [showInputs, setShowInputs] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    // 닉네임·비밀번호 칸을 열고 닫기 전 이 영역의 아래 끝 (화면 좌표)
    const bottomBefore = useRef<number | null>(null);

    const toggleInputs = (): void => {
        bottomBefore.current = box.current?.getBoundingClientRect().bottom ?? null;
        setShowInputs((v) => !v);
    };

    // 입력칸 위에 닉네임·비밀번호 칸이 생기면 입력칸과 아래 줄이 밀려 창 밖으로 나간다.
    // 늘어난 만큼 스크롤해 아래 끝을 제자리에 두고, 새 칸은 위로 펼친다
    useLayoutEffect(() => {
        const before = bottomBefore.current;
        bottomBefore.current = null;
        const element = box.current;
        const scroller = element?.closest(".refresher-frame-scroll");
        if (before === null || !element || !scroller) return;
        scroller.scrollTop += element.getBoundingClientRect().bottom - before;
    }, [showInputs]);
    const [sending, setSending] = useState(false);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const beforeTxtcon = useRef<string | null>(null);


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
        const signal = st.signalId;
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

            // 처음엔 토큰 없이 보내고, 'false||captcha||v3'가 오면 reCAPTCHA v3 토큰을 붙여 한 번 더 보낸다
            // (디시 comment.js·dccon.js·txtcon.js와 같음).
            let response = await send();
            if (response.message === "captcha" && response.detail === "v3") {
                const token = await sendMessage("refresher:grecaptchaToken", txtcon || useDccon ? "insert_icon" : "comment_submit").catch(() => undefined);
                if (token) response = await send(token);
            }

            // 성공 응답: 댓글은 새 댓글 번호, 디시콘·글자콘은 'ok'.
            if (txtcon || useDccon ? response.result === "ok" : isCommentPosted(response)) {
                // 보내는 사이 더 쓴 글은 남긴다. 디시콘만 보냈으면 입력칸의 글은 보내지 않았으니 둔다
                if (!useDccon) {
                    if (textarea.current?.value === raw) textarea.current.value = "";
                    if (draft.text === raw) draft.text = "";
                }
                setDccons([]);
                setBigDccon(false);
                setTxtcon(false);
                // 그새 다른 글로 넘어갔으면 답글 대상과 댓글 목록은 그 글 것이라 건드리지 않는다.
                // 디시처럼 쓴 닉네임·비밀번호를 기억한다. 만든 비밀번호도 저장해야 나중에 자기 댓글을 지울 수 있다.
                if (!login) saveNonmember(nick, password);
                if (usePreviewStore.getState().signalId === signal) {
                    usePreviewStore.setState({reply: {commentNo: null, replyNo: null}});
                    void st.requestRefresh();
                }
            } else if (response.message === "captcha") {
                // v2 체크박스를 요구하거나 v3 재전송도 막히면 원문 페이지에서만 풀 수 있다.
                useUiStore.getState().showToast(
                    "자동등록방지 확인이 필요합니다. 원문에서 작성해 주세요. (클릭하면 원문 열기)",
                    "warning",
                    8000,
                    () => window.open(preData.link, "_blank")
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

    /**
     * 글자콘 입력 제한을 적용한다. 값이 바뀔 때만 다시 써서 커서가 튀지 않게 한다.
     * 한글 조합 중엔 부르지 않고 조합이 끝난 뒤 부른다 (디시 txtcon.js와 같음).
     */
    const applyTxtcon = (): void => {
        const element = textarea.current;
        if (!element) return;

        const next = normalizeTxtcon(element.value);
        if (next !== element.value) element.value = next;
        draft.text = element.value;
    };

    /** 글자콘을 끈다. 켤 때 잘린 글을 그대로 두었으면 원문으로 되돌린다. 토글 버튼과 디시콘 선택이 같이 쓴다 */
    const exitTxtcon = (): void => {
        const element = textarea.current;
        if (element && beforeTxtcon.current !== null && element.value === normalizeTxtcon(beforeTxtcon.current)) {
            element.value = beforeTxtcon.current;
            draft.text = element.value;
        }
        beforeTxtcon.current = null;
        setTxtcon(false);
    };

    const mode = reply.replyNo ? "답글" : txtcon ? "글자콘" : dccons.length > 0 ? "디시콘" : "댓글";

    return (
        <Box ref={box} pl="6" pr="9" pt="3" pb="5">
            {!login && showInputs && (
                <Flex gap="2" mb="2">
                    <TextField.Root
                        size="2"
                        value={nick}
                        placeholder="닉네임"
                        maxLength={20}
                        style={{flex: 1}}
                        onChange={(ev) => setNick(ev.target.value)}
                    />
                    <TextField.Root
                        size="2"
                        type="password"
                        value={passwordEdited ? password : ""}
                        placeholder={!passwordEdited && password ? "비밀번호 (저장됨)" : "비밀번호"}
                        style={{flex: 1}}
                        onChange={(ev) => {
                            setPasswordEdited(true);
                            setPassword(ev.target.value);
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
                    defaultValue={initialText}
                    disabled={dccons.length > 0}
                    placeholder={
                        dccons.length > 0 ? "디시콘이 선택됐습니다."
                            : txtcon ? "글자콘 입력... (최대 20자, 4줄, 줄당 5자로 나뉨)"
                                : "댓글 입력... (Shift+Enter 줄바꿈)"
                    }
                    style={{flex: 1}}
                    onChange={(ev) => {
                        if (txtcon && !(ev.nativeEvent instanceof InputEvent && ev.nativeEvent.isComposing)) applyTxtcon();
                        draft.text = ev.target.value;
                    }}
                    onCompositionEnd={(ev) => {
                        if (txtcon) applyTxtcon();
                        draft.text = ev.currentTarget.value;
                    }}
                    onKeyDown={(ev) => {
                        if (ev.key === "Enter" && !ev.shiftKey && !ev.nativeEvent.isComposing) {
                            ev.preventDefault();
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
                                    // 글자콘과 디시콘은 같이 쓸 수 없다.
                                    setDccons([]);
                                    setBigDccon(false);

                                    if (txtcon) {
                                        exitTxtcon();
                                        return;
                                    }

                                    // 켜면서 잘리는 원문을 기억해 두었다가, 손대지 않고 끄면 되돌린다.
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
                    <Link size="1" href="#" onClick={(ev) => {
                        ev.preventDefault();
                        toggleInputs();
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
