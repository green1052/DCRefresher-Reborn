import {Box, Flex, IconButton, Link, Text, TextArea, TextField, Tooltip} from "@radix-ui/themes";
import {isTimeoutError} from "ky";
import {Send, Smile, Type, X} from "lucide-react";
import {useLayoutEffect, useRef, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {
    captchaImage,
    normalizeTxtcon,
    resultMessage,
    submitComment,
    type SubmitResult,
    submitTxtcon,
    TXTCON_BACKGROUNDS,
    TXTCON_COLORS
} from "@/core/preview/request";
import {postKey} from "@/core/preview/cache";
import type {DcinsideDccon} from "@/core/preview/types";
import {sendMessage} from "@/core/messaging/protocol";
import {useUiStore} from "@/stores/ui";
import {loggedInUserId} from "@/utils/user";

import {saveNonmember, savedNonmember} from "../nonmember";
import {DcconPopup} from "./DcconPopup";
import {NO_REPLY, usePreviewStore} from "./previewStore";

/** 비회원 댓글 비밀번호 (영문 소문자·숫자 8자). */
const randomPassword = (): string => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => (byte % 36).toString(36)).join("");

// 'false||메시지' 형식이 아닌 실패 응답 코드 (디시 dccon.js·txtcon.js에서 옮김).
const FAIL_MESSAGES: Record<string, string> = {
    code_fail: "자동입력 방지 코드가 일치하지 않습니다.",
    fail1: "닉네임과 비밀번호를 정확하게 입력해 주세요.",
    form_error: "닉네임과 비밀번호를 정확하게 입력해 주세요.",
    // 디시콘 댓글 (디시 dccon.js와 같은 문구).
    not_buy: "구매내역이 존재하지 않는 디시콘입니다.",
    expired: "사용기간이 만료된 디시콘입니다.",
    unuseable: "해당 디시콘은 현재 사용 불가능합니다.",
    not_exists: "잘못된 파일 경로 입니다.",
    fail: "디시콘 입력에 실패하였습니다."
};

/**
 * 댓글이 올라갔는지. 디시 comment.js처럼 'false'가 아니면 성공(새 댓글 번호)으로 보되, 확실한 실패는 거른다:
 * 실패 코드, 빈 응답, HTML 페이지(로그인이 풀렸거나 오류 페이지). 성공으로 잘못 보면 입력한 글을 지워 버린다.
 */
const isCommentPosted = ({result}: SubmitResult): boolean =>
    result !== "false" && result !== "" && !result.trimStart().startsWith("<") && !Object.hasOwn(FAIL_MESSAGES, result);

/** 글자콘 색 스와치. */
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
            // 고른 색은 한 칸 띄운 링으로 보인다. outline은 비워 두어야 키보드 포커스 링이 보인다.
            boxShadow: selected ? "0 0 0 1px var(--color-panel-solid), 0 0 0 3px var(--accent-9)" : undefined
        }}
    />
);

const NO_DCCON: { list: DcinsideDccon[]; big: boolean } = {list: [], big: false};

/** 쓰던 댓글 하나를 모듈 전역에 둔다. 창을 닫았다 같은 글을 다시 열면 되살리고, 다른 글을 열면 버린다. */
let draft = {key: "", text: ""};
/** 댓글을 보내는 중인 글. 보내는 사이 폼이 다시 마운트돼도(다른 글에 갔다 돌아옴) 같은 댓글을 또 보내지 않게 모듈 전역에 둔다. */
const sendingKeys = new Set<string>();

export const WriteComment = () => {
    const reply = usePreviewStore((s) => s.reply);
    // 폼은 글마다 새로 마운트된다 (Frame의 key). 마운트할 때 이 글에서 쓰던 댓글이 있으면 되살린다.
    // 보내는 중인 댓글은 되살리지 않는다. 올라간 댓글이 입력칸에 남아 한 번 더 보내게 된다.
    const [initialText] = useState(() => {
        const preData = usePreviewStore.getState().preData;
        const key = preData ? postKey(preData) : "";
        if (draft.key !== key) draft = {key, text: ""};
        return sendingKeys.has(key) ? "" : draft.text;
    });
    const [login] = useState(() => Boolean(document.querySelector("#login_box .user_info .nickname > em")));
    const [accountId] = useState(loggedInUserId);
    const [saved] = useState(savedNonmember);
    const [nick, setNick] = useState(saved.nick || "ㅇㅇ");
    // 기억한 비밀번호가 없으면 하나 만든다. 쓸 때 저장되므로 이후 같은 비밀번호로 자기 댓글을 지울 수 있다.
    const [password, setPassword] = useState(() => saved.pw || randomPassword());
    const pwSaved = Boolean(saved.pw);
    // 저장된 비밀번호는 입력칸에 넣지 않는다. 오버레이 섀도 루트가 open이라 페이지 스크립트가 값을 읽을 수 있다.
    // 사용자가 직접 고친 뒤에만 입력칸에 값이 보인다.
    const [passwordEdited, setPasswordEdited] = useState(false);
    // 고른 디시콘(더블콘이면 둘)과 대왕콘 여부. 같이 고르고 같이 비운다.
    const [{list: dccons, big: bigDccon}, setDccon] = useState(NO_DCCON);
    const [dcconOpen, setDcconOpen] = useState(false);
    const [txtcon, setTxtcon] = useState(false);
    const [txtconColors, setTxtconColors] = useState({bg: "3b4890", txt: "ffffff"});
    const [showInputs, setShowInputs] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    // 닉네임·비밀번호 칸을 열고 닫기 전 이 영역의 아래 끝 (화면 좌표).
    const bottomBefore = useRef<number | null>(null);

    const toggleInputs = (): void => {
        bottomBefore.current = box.current?.getBoundingClientRect().bottom ?? null;
        setShowInputs((v) => !v);
    };

    // 입력칸 위에 닉네임·비밀번호 칸이 생기면 입력칸과 아래 줄이 밀려 창 밖으로 나간다.
    // 늘어난 만큼 스크롤해 아래 끝을 제자리에 두고, 새 칸은 위로 펼친다.
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

        const key = postKey(st.preData);
        if (sendingKeys.has(key)) {
            useUiStore.getState().showToast("앞서 보낸 댓글을 처리하는 중입니다. 잠시 후 다시 시도해 주세요.", "warning");
            return;
        }

        if (!login && (!nick || !password)) {
            useUiStore.getState().showToast("닉네임과 비밀번호를 입력해 주세요.", "error");
            return;
        }

        // 댓글 목록은 이 글이 열려 있으면 새로 받는다. 보내는 사이 다른 글에 갔다 돌아왔으면 새 창의 목록은 댓글이 올라가기 전에 받은 것이다.
        const refreshIfOpen = (): void => {
            const current = usePreviewStore.getState();
            if (current.preData && postKey(current.preData) === key) void current.requestRefresh();
        };

        setSending(true);
        sendingKeys.add(key);
        const signal = st.signalId;
        // 안쪽 함수에서도 null이 아닌 값으로 쓰도록 미리 꺼내 둔다.
        const {preData, post} = st;
        // 보내기는 안쪽 함수에 두고 끝나면(성공·실패·캡차 취소 모두) 정리한다. try…finally는 React Compiler가 아직 다루지 못해 컴포넌트 전체가 컴파일되지 않는다.
        const submit = async (): Promise<void> => {
            try {
                let code: string | undefined;
                if (post.requireCommentCaptcha) {
                    code = await st.openCaptcha(captchaImage(preData, "comment"));
                    if (!code) return;
                }

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
                    // 보내는 사이 더 쓴 글은 남긴다. 디시콘만 보냈으면 입력칸의 글은 보내지 않았으니 둔다.
                    if (!useDccon) {
                        if (textarea.current?.value === raw) textarea.current.value = "";
                        if (draft.text === raw) draft.text = "";
                    }
                    setDccon(NO_DCCON);
                    setTxtcon(false);
                    // 디시처럼 쓴 닉네임·비밀번호를 기억한다. 만든 비밀번호도 저장해야 나중에 자기 댓글을 지울 수 있다.
                    if (!login) saveNonmember(nick, password);
                    // 그새 다른 글로 넘어갔으면 답글 대상은 그 글 것이라 건드리지 않는다.
                    if (usePreviewStore.getState().signalId === signal) usePreviewStore.setState({reply: NO_REPLY});
                    refreshIfOpen();
                } else if (response.message === "captcha") {
                    // v2 체크박스를 요구하거나 v3 재전송도 막히면 원문 페이지에서만 풀 수 있다.
                    useUiStore.getState().showToast(
                        "자동입력 방지 확인이 필요합니다. 원문에서 작성해 주세요.",
                        "warning",
                        8000,
                        {label: "원문 열기", run: () => window.open(preData.link, "_blank", "noopener")}
                    );
                } else {
                    useUiStore.getState().showToast((response.result === "false" ? resultMessage(response) : FAIL_MESSAGES[response.result]) || "댓글을 작성하지 못했습니다.", "error");
                }
            } catch (e) {
                // 시간 초과 등으로 끊겨도 서버는 댓글을 올렸을 수 있다. 목록을 새로 받아 올라간 댓글이 보이게 해 다시 보내지 않게 한다. 입력한 글은 둔다.
                refreshIfOpen();
                const timeout = isTimeoutError(e);
                useUiStore.getState().showToast(
                    timeout ? "응답이 없어 작성 여부를 확인하지 못했습니다. 댓글 목록을 확인해 주세요." : "댓글을 작성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
                    "error"
                );
            }
        };

        await submit();
        sendingKeys.delete(key);
        setSending(false);
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

    /** 글자콘을 끈다. 켤 때 잘린 글을 그대로 두었으면 원문으로 되돌린다. 토글 버튼과 디시콘 선택이 같이 쓴다. */
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
                        aria-label="닉네임"
                        placeholder="닉네임"
                        maxLength={20}
                        style={{flex: 1}}
                        onChange={(ev) => setNick(ev.target.value)}
                    />
                    <TextField.Root
                        size="2"
                        type="password"
                        value={passwordEdited ? password : ""}
                        aria-label="비밀번호"
                        placeholder={passwordEdited ? "비밀번호" : pwSaved ? "비밀번호 (저장됨)" : "비밀번호 (자동 생성)"}
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
                    aria-label={`${mode} 입력`}
                    placeholder={
                        dccons.length > 0 ? "디시콘이 선택되었습니다."
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
                        <Tooltip content={dccons.length > 0 ? "디시콘 취소" : "디시콘"} container={overlay.portal}>
                            <IconButton
                                variant="soft"
                                color="gray"
                                aria-label={dccons.length > 0 ? "디시콘 취소" : "디시콘"}
                                onClick={() => (dccons.length > 0 ? setDccon(NO_DCCON) : setDcconOpen(true))}
                            >
                                {dccons.length > 0 ? <X size={16}/> : <Smile size={16}/>}
                            </IconButton>
                        </Tooltip>
                        <Tooltip content={txtcon ? "글자콘 취소" : "글자콘"} container={overlay.portal}>
                            <IconButton
                                variant="soft"
                                color={txtcon ? undefined : "gray"}
                                aria-label="글자콘"
                                aria-pressed={txtcon}
                                onClick={() => {
                                    // 글자콘과 디시콘은 같이 쓸 수 없다.
                                    setDccon(NO_DCCON);

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
                    <Link size="1" href="#" aria-expanded={showInputs} onClick={(ev) => {
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
                    onSelect={(list, big) => {
                        setDccon({list, big});
                        if (txtcon) exitTxtcon();
                        setDcconOpen(false);
                    }}
                    onClose={() => setDcconOpen(false)}
                />
            )}
        </Box>
    );
};
