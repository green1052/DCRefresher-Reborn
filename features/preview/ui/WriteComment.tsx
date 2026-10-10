import {isTimeoutError} from "ky";
import {Send, Smile, Type, X} from "lucide-react";
import {useLayoutEffect, useRef, useState} from "react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Spinner} from "@/components/ui/spinner";
import {Textarea} from "@/components/ui/textarea";
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group";
import {WithTooltip} from "@/components/WithTooltip";
import {captchaImage, normalizeTxtcon, TXTCON_BACKGROUNDS, TXTCON_COLORS} from "@/core/preview/request";
import {postKey, setEntry} from "@/core/preview/cache";
import type {DcinsideDccon} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {loggedInUserId} from "@/utils/user";

import {postComment} from "../comment-submit";
import {saveNonmember, savedNonmember} from "../nonmember";
import {DcconPopup} from "./DcconPopup";
import {NO_REPLY, usePreviewStore} from "./previewStore";

/** 비회원 댓글 비밀번호 (영문 소문자·숫자 8자). */
const randomPassword = (): string => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => (byte % 36).toString(36)).join("");

/** 글자콘 색 스와치. ToggleGroup 안에 둔다. */
const Swatch = ({color, label}: { color: string; label: string }) => (
    // 고른 색은 한 칸 띄운 테두리(outline)로 보인다. 키보드 포커스 링(box-shadow)은 그 틈을 채워 고른 색에 포커스가 있어도 구분된다.
    <ToggleGroupItem
        value={color}
        aria-label={label}
        className="size-[18px] min-w-0 cursor-pointer rounded-full border border-foreground/25 p-0 aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-solid aria-pressed:outline-primary"
        style={{background: `#${color}`}}
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
        // 다른 글에 가 있으면 캐시의 목록을 낡은 것으로 표시해 둔다. 두면 10초 안에 돌아올 때 방금 받은 목록으로 쳐서(COMMENTS_REUSE) 다시 받지 않아,
        // 올라간 댓글이 안 보여 한 번 더 보내게 된다.
        const refreshIfOpen = (): void => {
            setEntry(preData, {commentsAt: 0});
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
                const outcome = await postComment(preData, post, user, {text, dccons, bigDccon, txtcon: txtcon ? txtconColors : undefined}, st.reply, code);

                if (outcome.ok) {
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
                } else if (outcome.captcha) {
                    useUiStore.getState().showToast(
                        "자동입력 방지 확인이 필요합니다. 원문에서 작성해 주세요.",
                        "warning",
                        8000,
                        {label: "원문 열기", run: () => window.open(preData.link, "_blank", "noopener")}
                    );
                } else {
                    useUiStore.getState().showToast(outcome.message, "error");
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
     * 한글 조합 중엔 부르지 않고 조합이 끝난 뒤 부른다 (디시 txtcon.js와 같다).
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
        <div ref={box} className="pt-3 pr-14 pb-6 pl-8">
            {!login && showInputs && (
                <div className="mb-2 flex gap-2">
                    <Input
                        value={nick}
                        aria-label="닉네임"
                        placeholder="닉네임"
                        maxLength={20}
                        className="flex-1"
                        onChange={(ev) => setNick(ev.target.value)}
                    />
                    <Input
                        type="password"
                        value={passwordEdited ? password : ""}
                        aria-label="비밀번호"
                        placeholder={passwordEdited ? "비밀번호" : pwSaved ? "비밀번호 (저장됨)" : "비밀번호 (자동 생성)"}
                        className="flex-1"
                        onChange={(ev) => {
                            setPasswordEdited(true);
                            setPassword(ev.target.value);
                        }}
                    />
                </div>
            )}

            <div className="flex items-end gap-2">
                <Textarea
                    ref={textarea}
                    rows={2}
                    defaultValue={initialText}
                    disabled={dccons.length > 0}
                    aria-label={`${mode} 입력`}
                    placeholder={
                        dccons.length > 0 ? "디시콘이 선택되었습니다."
                            : txtcon ? "글자콘 입력... (최대 20자, 4줄, 줄당 5자로 나뉨)"
                                : "댓글 입력... (Shift+Enter 줄바꿈)"
                    }
                    className="min-h-16 flex-1 resize-y"
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
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <WithTooltip tip={dccons.length > 0 ? "디시콘 취소" : "디시콘"}
                                     trigger={<Button variant="secondary" size="icon" aria-label={dccons.length > 0 ? "디시콘 취소" : "디시콘"}
                                                      onClick={() => (dccons.length > 0 ? setDccon(NO_DCCON) : setDcconOpen(true))}/>}>
                            {dccons.length > 0 ? <X/> : <Smile/>}
                        </WithTooltip>
                        <WithTooltip tip={txtcon ? "글자콘 취소" : "글자콘"}
                                     trigger={<Button variant={txtcon ? "default" : "secondary"} size="icon" aria-label="글자콘" aria-pressed={txtcon}
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
                                                      }}/>}>
                            <Type/>
                        </WithTooltip>
                    </div>
                    <Button aria-label="작성" className="w-full" disabled={sending} onClick={() => void submit()}>
                        {sending ? <Spinner/> : <Send/>}
                    </Button>
                </div>
            </div>

            {txtcon && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground" aria-hidden>배경</span>
                    {/* 다시 눌러 빈 값이 오면 고른 색을 그대로 둔다. */}
                    <ToggleGroup aria-label="배경색" value={[txtconColors.bg]} onValueChange={([bg]) => bg && setTxtconColors((prev) => ({...prev, bg}))}>
                        {TXTCON_BACKGROUNDS.map((bg) => <Swatch key={bg} color={bg} label={`배경색 #${bg}`}/>)}
                    </ToggleGroup>
                    <span className="ml-2 text-xs text-muted-foreground" aria-hidden>글자</span>
                    <ToggleGroup aria-label="글자색" value={[txtconColors.txt]} onValueChange={([txt]) => txt && setTxtconColors((prev) => ({...prev, txt}))}>
                        {TXTCON_COLORS.map((txt) => <Swatch key={txt} color={txt} label={`글자색 #${txt}`}/>)}
                    </ToggleGroup>
                </div>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
                {login ? (accountId ?? "회원 계정") : (
                    <a href="#" className="text-link underline-offset-4 hover:underline" aria-expanded={showInputs} onClick={(ev) => {
                        ev.preventDefault();
                        toggleInputs();
                    }}>
                        {nick}
                    </a>
                )}
                (으)로 {mode} 작성 중
            </p>

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
        </div>
    );
};
