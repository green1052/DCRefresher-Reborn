import {useRef, useState} from "react";

import {captchaImage, submitComment} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";

import {usePreviewStore} from "./previewStore";

const randomPassword = (): string => Math.random().toString(36).slice(2, 10);

/** 댓글 작성 폼 */
export const WriteComment = () => {
    const reply = usePreviewStore((s) => s.reply);
    const [login] = useState(() => Boolean(document.querySelector("#login_box .user_info .nickname > em")));
    const [nick, setNick] = useState(() => localStorage.getItem("refresher:nonmember:nick") ?? "ㅇㅇ");
    const [password, setPassword] = useState(() => localStorage.getItem("refresher:nonmember:pw") ?? randomPassword());
    const textarea = useRef<HTMLTextAreaElement>(null);

    const submit = async (): Promise<void> => {
        const st = usePreviewStore.getState();
        const memo = textarea.current?.value.trim() ?? "";
        if (!st.preData || !st.post || !memo) return;

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

            const response = await submitComment(
                st.preData,
                {name: login ? "" : nick, pw: login ? undefined : password},
                st.post.dom ?? document,
                memo,
                st.reply.commentNo,
                st.reply.replyNo,
                code
            );

            if (response.result === "SUCCESS") {
                if (textarea.current) textarea.current.value = "";
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
            {!login && (
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
                placeholder="댓글 입력..."
                onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void submit();
                    }
                }}
            />
            <div className="refresher-write-comment-controls">
                <span className="refresher-write-comment-whoami">
                    {login ? "회원 계정" : nick}(으)로 {reply.replyNo ? "답글" : "댓글"} 작성 중
                </span>
                <div className="refresher-write-comment-buttons">
                    <button type="button" disabled title="디시콘 입력기는 추후 지원됩니다.">
                        디시콘
                    </button>
                    <button type="button" className="primary" onClick={() => void submit()}>
                        작성
                    </button>
                </div>
            </div>
        </div>
    );
};
