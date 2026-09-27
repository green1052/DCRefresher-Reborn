import {ShieldCheck} from "lucide-react";

import {defineModule} from "@/core/module/define";
import {rowPostNo} from "@/core/http/urls";
import {ROW_SELECTOR} from "@/core/list";
import {BOARD_PAGE} from "@/core/pages";
import {deletePost} from "@/core/preview/request";
import {notifyManage} from "@/utils/notify";
import {isGalleryManager} from "@/utils/user";

/** 체크박스와 작성자 칸이 같이 든 칸. 목록 행에 더해 댓글은 작성자 칸(.cmt_nickbox)이다 */
const CHECKBOX_ROW = `${ROW_SELECTOR}, .cmt_nickbox`;

export default defineModule({
    id: "manage",
    name: "관리",
    description: "무급 노예들을 위한 여러 편의 기능을 제공합니다.",
    icon: ShieldCheck,
    urls: [BOARD_PAGE],
    defaultEnable: false,

    settings: {
        checkAllTargetUser: {
            type: "check",
            name: "선택한 유저 전부 체크",
            desc: "Shift 키를 누른 상태로 체크박스를 눌러 대상 유저 전부를 체크합니다. (아이디, IP, 닉네임 순서)",
            default: false
        },
        checkViaShift: {
            type: "check",
            name: "Shift 다중 체크",
            desc: "Shift 키를 누른 상태로 드래그해 여러 항목을 체크합니다.",
            default: false
        },
        checkCommentViaCtrl: {
            type: "check",
            name: "Ctrl 대댓글 체크",
            desc: "Ctrl 키를 누른 상태로 댓글을 클릭하면 대댓글도 체크합니다.",
            default: false
        },
        deleteViaCtrl: {
            type: "check",
            name: "Ctrl로 삭제",
            desc: "Ctrl 키를 누른 상태로 게시글을 클릭해 삭제합니다.",
            default: false
        },
        enableGifControl: {
            type: "check",
            name: "GIF 조작 기능 활성화",
            desc: "GIF를 제어할 수 있는 기능을 활성화합니다.",
            default: false
        }
    },

    setup(ctx) {
        // 핸들러를 붙인 요소. DOM 속성으로 표시하면 refresh가 체크박스 칸을 복제할 때 표시도 복제돼 새 행에 핸들러가 붙지 않는다
        const handled = new WeakSet<Element>();

        // ===== GIF 조작 =====
        ctx.addFilter(
            ".gallview_contents video",
            (element) => {
                if (!ctx.settings.enableGifControl) return;
                if (!(element instanceof HTMLVideoElement)) return;
                if (element.dataset.src?.includes("dcinside.com/dccon.php")) return;

                element.removeAttribute("onmousedown");
                element.setAttribute("controls", "");
            }
        );

        // ===== 체크박스 편의 =====
        ctx.addFilter(
            ".article_chkbox",
            (element) => {
                if (handled.has(element)) return;
                handled.add(element);

                const parent = element.closest<HTMLElement>(CHECKBOX_ROW);
                const writer = parent?.querySelector<HTMLElement>(":scope > .ub-writer");
                const uid = writer?.dataset.uid;
                const ip = writer?.dataset.ip;
                const nick = writer?.dataset.nick;

                element.addEventListener("click", (ev) => {
                    const source = ev.target as HTMLInputElement;

                    if (ctx.settings.checkAllTargetUser && ev.shiftKey && (uid || ip || nick)) {
                        // 유동은 data-uid=""다. key와 값을 같은 기준으로 골라야 한다.
                        // 값만 ??로 고르면 [data-ip=""]가 되어 회원 글이 전부 잡힌다
                        const [key, value] = uid ? ["uid", uid] : ip ? ["ip", ip] : ["nick", nick!];

                        for (const other of document.querySelectorAll<HTMLElement>(`.ub-writer[data-${key}="${CSS.escape(value)}"]`)) {
                            const otherParent = other.closest<HTMLElement>(CHECKBOX_ROW);
                            for (const box of otherParent?.querySelectorAll<HTMLInputElement>(".article_chkbox") ?? []) box.checked = source.checked;
                        }
                    }

                    if (ctx.settings.checkCommentViaCtrl && ev.ctrlKey) {
                        // 댓글은 li#comment_li_{no}, 대댓글은 그 다음 형제 li 안의 ul#reply_list_{no} > li#reply_li_{no} (comment.js)
                        const commentNo = element.closest<HTMLElement>("li")?.id.match(/^comment_li_(\d+)$/)?.[1];
                        if (!commentNo) return;

                        for (const box of document.getElementById(`reply_list_${commentNo}`)?.querySelectorAll<HTMLInputElement>(".article_chkbox") ?? []) {
                            box.checked = source.checked;
                        }
                    }
                }, {signal: ctx.signal});

                // 왼쪽 버튼을 누른 채 지나간 칸만 체크한다. 그냥 지나가도 체크하면 Shift+클릭이 방금 체크된 칸을 도로 푼다.
                // 드래그를 시작한 칸은 누르기 전에 들어왔으므로 떠날 때(mouseout) 체크한다
                const checkOnDrag = (ev: MouseEvent): void => {
                    if (ctx.settings.checkViaShift && ev.shiftKey && ev.buttons === 1 && element instanceof HTMLInputElement) element.checked = true;
                };
                element.addEventListener("mouseover", checkOnDrag, {signal: ctx.signal});
                element.addEventListener("mouseout", checkOnDrag, {signal: ctx.signal});
            }
        );

        // ===== Ctrl 클릭 삭제 =====
        const deleteByCtrl = (postId: string): Promise<boolean> => {
            const gallery = document.querySelector<HTMLInputElement>("#gallery_id")?.value ?? "";
            return notifyManage(deletePost({gallery, id: postId, link: location.href}), "게시글을 삭제했습니다.", "게시글 삭제 중 오류가 발생했습니다.");
        };

        // 삭제 요청을 보낸 글. 응답 전에 다시 눌러도 요청을 또 보내지 않는다
        const deleting = new Set<string>();

        ctx.addFilter(
            ".gall_list .ub-content",
            (element) => {
                if (handled.has(element)) return;
                handled.add(element);

                element.addEventListener("click", (ev) => {
                    // 관리하지 않는 갤러리에선 Ctrl+클릭(새 탭 열기)을 그대로 둔다. 권한 없는 삭제 요청을 보내지 않는다
                    if (!ctx.settings.deleteViaCtrl || !ev.ctrlKey || !isGalleryManager()) return;
                    // 체크박스 칸과 댓글 수(미리보기가 댓글만 연다)는 가로채지 않는다. 제목 Ctrl+클릭은 v5처럼 삭제한다
                    if (ev.target instanceof Element && ev.target.closest("td:has(.article_chkbox), .reply_numbox")) return;

                    const postId = rowPostNo(element);
                    if (!postId) return;

                    // 요청 중에 다시 누른 것도 새 탭으로 열리지 않게 막은 뒤 거른다
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (deleting.has(postId)) return;
                    deleting.add(postId);

                    void deleteByCtrl(postId).then((deleted) => {
                        // 행을 남겨 두면 목록이 새로고침될 때까지(refresh가 꺼져 있으면 계속) 지운 글에 요청을 또 보낼 수 있다
                        if (deleted) element.remove();
                    }).finally(() => deleting.delete(postId));
                }, {signal: ctx.signal});
            }
        );
    }
});
