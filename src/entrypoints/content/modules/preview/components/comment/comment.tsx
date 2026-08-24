import {Check, ChevronDown, Reply, X} from "lucide-react";
import {useMemo} from "react";

import Timestamp from "@/components/timestamp";
import UserComponent from "@/components/user";
import {useMeDetection} from "@/entrypoints/content/composables/useMeDetection";
import {handleDcconContextMenu, parseCommentDate, parseVoiceData} from "../../comments";

import "./comment.scss";

interface Props {
    comment: DcinsideCommentObject;
    index?: number;
    useWriteComment?: boolean;
    postUser?: string;
    delete?: (no: string, password: string, isAdmin: boolean) => void;
    reply?: { commentNo: string | null; replyNo: string | null };
    replyCount?: number;
    lastReply?: boolean;
    collapsed?: boolean;
    onUpdateReply: (reply: { commentNo: string | null; replyNo: string | null }) => void;
    onToggleCollapse: (no: string) => void;
}

export default function Comment({
    comment,
    useWriteComment = false,
    postUser = "",
    delete: deleteFn,
    reply = {commentNo: null, replyNo: null},
    replyCount = 0,
    lastReply = false,
    collapsed = false,
    onUpdateReply,
    onToggleCollapse
}: Props) {
    const isAdmin = useMemo(() => !!document.querySelector(".useradmin_btnbox button"), []);

    const {me} = useMeDetection({
        userId: comment.user.id ?? "",
        postUser: postUser || undefined
    });

    const parsedDate = parseCommentDate(comment.reg_date);

    const voiceData = useMemo(() => {
        if (!comment.vr_player) return null;
        return parseVoiceData(comment.memo);
    }, [comment.vr_player, comment.memo]);

    const safeDelete = (): void => {
        if (!deleteFn) return;

        let password: string = "";

        if (!isAdmin && comment.my_cmt === "N") {
            password = prompt("비밀번호를 입력하세요.") ?? "";

            if (!password) return;
        }

        deleteFn(comment.no, password, comment.my_cmt === "N" && isAdmin);
    };

    const setReply = () => {
        if (reply.replyNo === comment.no) {
            onUpdateReply({
                commentNo: null,
                replyNo: null
            });

            return;
        }

        onUpdateReply({
            commentNo: reply.commentNo === comment.c_no ? null : comment.c_no || comment.no,
            replyNo: reply.replyNo === comment.no ? null : comment.no
        });
    };

    return (
        <div
            className="refresher-comment"
            data-collapsed={collapsed}
            data-deleted={comment.is_delete !== "0"}
            data-depth={comment.depth}
            data-has-replies={comment.depth === 0 && replyCount > 0}
            data-last-reply={lastReply}
        >
            <div className="meta">
                <UserComponent
                    me={me}
                    user={comment.user}
                />
                {comment.depth === 0 && replyCount > 1 && (
                    <div
                        className="refresher-reply-toggle"
                        onClick={() => onToggleCollapse(comment.no)}
                    >
                        <ChevronDown
                            className="toggle-icon"
                            size={14}
                        />
                    </div>
                )}
                <div className="float-right">
                    {useWriteComment && (
                        <div
                            className={reply.replyNo === comment.no ? "refresher-reply active" : "refresher-reply"}
                            onClick={setReply}
                        >
                            {reply.replyNo === comment.no ? (
                                <Check
                                    className="reply-icon"
                                    size={14}
                                />
                            ) : (
                                <Reply
                                    className="reply-icon"
                                    size={14}
                                />
                            )}
                        </div>
                    )}

                    <Timestamp date={new Date(parsedDate)}/>
                    {comment.is_delete === "0" &&
                        (comment.del_btn === "Y" || comment.my_cmt === "Y" || isAdmin || comment.user.isLogout()) && (
                            <div
                                className="delete"
                                onClick={safeDelete}
                            >
                                <X
                                    className="delete-icon"
                                    size={14}
                                />
                            </div>
                        )}
                </div>
            </div>
            {comment.vr_player && voiceData ? (
                <div>
                    {voiceData.iframe ? (
                        <iframe
                            height="54px"
                            src={voiceData.src}
                            width="280px"
                        />
                    ) : (
                        <audio
                            controls
                            src={voiceData.src}
                        />
                    )}
                    {voiceData.memo && (
                        <p>
                            {voiceData.memo}
                        </p>
                    )}
                </div>
            ) : /<(img|video) class=/.test(comment.memo) ? (
                <p
                    className="refresher-comment-content dccon"
                    data-bigdccon={/\bbigdccon\b/.test(comment.memo) || undefined}
                    dangerouslySetInnerHTML={{__html: comment.memo.replace(/(?<!(dc|<))img/gi, "/><img")}}
                    onContextMenu={(ev) => handleDcconContextMenu(ev.nativeEvent)}
                />
            ) : (
                <p
                    className="refresher-comment-content"
                    dangerouslySetInnerHTML={{__html: comment.memo.replaceAll("\n", "<br>")}}
                />
            )}
        </div>
    );
}
