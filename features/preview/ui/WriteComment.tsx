import {useRef, useState} from "react";

import {captchaImage, submitComment} from "@/core/preview/request";
import {getGrecaptchaToken} from "../grecaptcha";
import type {DcinsideDccon} from "@/features/types";
import {useUiStore} from "@/stores/ui";

import {DcconPopup} from "./DcconPopup";
import {usePreviewStore} from "./previewStore";

const randomPassword = (): string => Math.random().toString(36).slice(2, 10);

/** 댓글 작성 폼 */
export const WriteComment = () => {
    const reply = usePreviewStore((s) => s.reply);
    const [login] = useState(() => Boolean(document.querySelector("#login_box .user_info .nickname > em")));
    const [nick, setNick] = useState(() => localStorage.getItem("refresher:nonmember:nick") ?? "ㅇㅇ");
    const [password, setPassword] = useState(() => localStorage.getItem("refresher:nonmember:pw") ?? randomPassword());
    const [dccons, setDccons] = useState<DcinsideDccon[]>([]);
    const [bigDccon, setBigDccon] = useState(false);
    const [dcconOpen, setDcconOpen] = useState(false);
    const [showInputs, setShowInputs] = useState(false);
    const textarea = useRef<HTMLTextAreaElement>(null);

    const submit = async (): Promise<void> => {
        const st = usePreviewStore.getState();
        const text = textarea.current?.value.trim() ?? "";
        const useDccon = dccons.length > 0;

        if (!st.preData || !st.post) return;
        if (!useDccon && !text) return;

        if (!login && (!nick || !password)) {
            useUiStore.getState().showToast("아이디 혹은 비밀번호를 입력하지 않았습니다.", "error");
            return;
        }

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
        }
    };

    return (
        <div className="refresher-write-comment">
            {!login && showInputs && (
                <div className="refresher-write-comment-inputs">
                    <input
                        value={nick}
                        placeholder="닉네임"
                        maxLength={20}
                        onChange={(event) => {
                            setNick(event.target.value);
                            localStorage.setItem("refresher:nonmember:nick", event.target.value);
                        }}
                    />
                    <input
                        type="password"
                        value={password}
                        placeholder="비밀번호"
                        onChange={(event) => {
                            setPassword(event.target.value);
                            localStorage.setItem("refresher:nonmember:pw", event.target.value);
                        }}
                    />
                </div>
            )}
            <textarea
                id="comment_main"
                ref={textarea}
                disabled={dccons.length > 0}
                placeholder={dccons.length > 0 ? "디시콘이 선택됐습니다." : "댓글 입력..."}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void submit();
                    }
                }}
            />
            <div className="refresher-write-comment-controls">
                <span
                    className="refresher-write-comment-whoami"
                    style={login ? undefined : {cursor: "pointer"}}
                    title={login ? undefined : "클릭하면 작성자 정보를 수정합니다."}
                    onClick={() => {
                        if (!login) setShowInputs((v) => !v);
                    }}
                >
                    {login ? "회원 계정" : nick}(으)로 {reply.replyNo ? "답글" : dccons.length > 0 ? "디시콘" : "댓글"} 작성 중
                </span>
                <div className="refresher-write-comment-buttons">
                    {dccons.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setDccons([]);
                                setBigDccon(false);
                            }}
                        >
                            콘 취소
                        </button>
                    )}
                    <button type="button" onClick={() => setDcconOpen(true)}>
                        디시콘
                    </button>
                    <button type="button" className="primary" onClick={() => void submit()}>
                        작성
                    </button>
                </div>
            </div>
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
        </div>
    );
};
