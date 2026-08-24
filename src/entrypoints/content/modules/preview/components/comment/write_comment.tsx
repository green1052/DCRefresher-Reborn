import {useContext, useState} from "react";

import toast from "@/utils/toast";
import PreviewButton from "@/components/previewButton";
import UserComponent from "@/components/user";

import {useCommentUser} from "../../composables/useCommentUser";
import {InputFocusContext} from "../frame/frameComponent";

import "./write_comment.scss";

interface Props {
    func?: (
        type: "text" | "dccon",
        memo: string | DcinsideDccon[],
        commentNo: string | null,
        replyNo: string | null,
        user: { name: string; pw?: string },
        bigDccon: boolean
    ) => Promise<boolean>;
    reply?: { commentNo: string | null; replyNo: string | null };
    renderDcconPopup?: () => boolean;
    getDccon?: () => DcinsideDccon[];
    getBigDccon?: () => boolean;
    onSetDccon: (dccons: DcinsideDccon[]) => void;
    onSetBigDccon: (value: boolean) => void;
    onUpdateReply: (reply: { commentNo: string | null; replyNo: string | null }) => void;
}

export default function WriteComment({
    func,
    reply = {commentNo: null, replyNo: null},
    renderDcconPopup,
    getDccon,
    getBigDccon,
    onSetDccon,
    onSetBigDccon,
    onUpdateReply
}: Props) {
    const {
        user,
        unsignedUserID,
        unsignedUserPW,
        changeUnsignedUserID,
        changeUnsignedUserPW,
        fixedUser,
        editUser,
        toggleEditUser,
        validCheck
    } = useCommentUser();

    const [focused, setFocused] = useState(false);
    const [disabled, setDisabled] = useState(false);
    const [text, setText] = useState("");
    const [hoverUserInfo, setHoverUserInfo] = useState(false);

    const inputFocus = useContext(InputFocusContext);

    const dcconCount = getDccon?.().length ?? 0;

    const write = async (): Promise<boolean> => {
        setDisabled(true);

        if (!fixedUser && (!unsignedUserID || !unsignedUserPW)) {
            toast.show("아이디 혹은 비밀번호를 입력하지 않았습니다.", "error");
            setDisabled(false);
            return false;
        }

        if (!func) {
            setDisabled(false);
            return true;
        }

        const dccons = getDccon?.() ?? [];
        const bigDccon = getBigDccon?.() ?? false;

        try {
            const result = await func(
                dccons.length > 0 ? "dccon" : "text",
                dccons.length > 0 ? dccons : text,
                reply?.commentNo ?? null,
                reply?.replyNo ?? null,
                fixedUser && user
                    ? {name: user.nick}
                    : {
                        name: unsignedUserID,
                        pw: unsignedUserPW
                    },
                bigDccon
            );

            if (!result) {
                return false;
            }

            setText("");

            onSetDccon([]);
            onSetBigDccon(false);
            onUpdateReply({commentNo: null, replyNo: null});

            return result;
        } finally {
            setDisabled(false);
        }
    };

    const focus = (): void => {
        setFocused(true);
        inputFocus.current = true;
    };

    const blur = (): void => {
        setFocused(false);
        inputFocus.current = false;
    };

    const onKeyDown = (ev: React.KeyboardEvent): void => {
        if (ev.key === "Enter" && !ev.shiftKey) void write();
    };

    return (
        <div className="refresher-write-comment">
            <form
                className="user"
                onSubmit={(ev) => ev.preventDefault()}
                style={{display: editUser ? undefined : "none"}}
            >
                <input
                    onChange={(ev) => {
                        changeUnsignedUserID(ev.target.value);
                        validCheck("id", ev.target.value);
                    }}
                    placeholder="닉네임"
                    type="text"
                    value={unsignedUserID}
                />
                <input
                    onChange={(ev) => {
                        changeUnsignedUserPW(ev.target.value);
                        validCheck("pw", ev.target.value);
                    }}
                    placeholder="비밀번호"
                    type="password"
                    value={unsignedUserPW}
                />
            </form>
            <div className="refresher-comment-body">
                <div className={focused ? "refresher-input-wrap focus" : disabled ? "refresher-input-wrap disable" : "refresher-input-wrap"}>
                    <textarea
                        autoComplete="new-password"
                        disabled={disabled || dcconCount > 0}
                        id="comment_main"
                        onBlur={blur}
                        onChange={(ev) => setText(ev.target.value)}
                        onFocus={focus}
                        onKeyDown={onKeyDown}
                        placeholder={dcconCount > 0 ? "디시콘이 선택됐습니다." : "댓글 입력..."}
                        value={text}
                    />
                </div>
                <PreviewButton
                    className="refresher-writecomment"
                    click={() => renderDcconPopup?.() ?? false}
                    id="dccon"
                />
                <PreviewButton
                    className="refresher-writecomment"
                    click={write}
                    id="write"
                />
            </div>
            <div
                onMouseLeave={() => setHoverUserInfo(false)}
                onMouseOver={() => setHoverUserInfo(true)}
            >
                <div className={!(hoverUserInfo && !user?.id) ? "whoami refresher-comment-util refresher-comment-util-show" : "whoami refresher-comment-util"}>
                    {user && (
                        <UserComponent
                            me={true}
                            user={user}
                        />
                    )}
                    <span>로 {reply?.commentNo ? "답글" : ""} {dcconCount > 0 ? "디시콘" : ""} 작성 중</span>
                </div>
                <div className={hoverUserInfo && user?.isLogout() ? "whoami refresher-comment-util refresher-comment-util-edit refresher-comment-util-show" : "whoami refresher-comment-util refresher-comment-util-edit"}>
                    <span onClick={toggleEditUser}>
                        클릭하면 작성자 정보 수정 모드를 {editUser ? "비활성화" : "활성화"}시킵니다.
                    </span>
                </div>
            </div>
        </div>
    );
}
