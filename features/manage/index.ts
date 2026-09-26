import {ShieldCheck} from "lucide-react";

import {defineModule} from "@/core/module/define";
import {BOARD_PAGE, rowPostNo} from "@/core/http/urls";
import {deletePost} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";
import {notifyManage} from "@/utils/notify";
import {isGalleryManager} from "@/utils/user";

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
            desc: "Shift키를 누른 상태로 체크박스를 눌러 대상 유저 전부를 체크합니다. (아이디, IP, 이름 순서)",
            default: false
        },
        checkViaShift: {
            type: "check",
            name: "Shift 다중 체크",
            desc: "Shift키를 누른 상태로 드래그해 여러 항목을 체크합니다.",
            default: false
        },
        checkCommentViaCtrl: {
            type: "check",
            name: "Ctrl 대댓글 체크",
            desc: "Ctrl키를 누른 상태로 댓글을 클릭하면 대댓글도 체크합니다.",
            default: false
        },
        deleteViaCtrl: {
            type: "check",
            name: "Ctrl로 삭제",
            desc: "Ctrl키를 누른 상태로 게시글을 클릭해 삭제합니다.",
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
        // 핸들러를 붙인 요소. DOM 속성으로 표시하면 refresh가 체크박스 칸을 복제할 때 표시까지 따라가 새 행에 핸들러가 안 붙는다
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

                const parent = element.closest<HTMLElement>(".ub-content, .cmt_nickbox, .search_comment");
                const writer = parent?.querySelector<HTMLElement>(":scope > .ub-writer");
                const uid = writer?.dataset.uid;
                const ip = writer?.dataset.ip;
                const nick = writer?.dataset.nick;

                element.addEventListener("click", (ev) => {
                    const source = ev.target as HTMLInputElement;

                    if (ctx.settings.checkAllTargetUser && ev.shiftKey && (uid || ip || nick)) {
                        // 유동은 data-uid=""라 ??로 값을 고르면 key는 ip인데 값이 ""가 돼 회원 글이 전부 잡힌다 — 같은 기준으로 고른다
                        const [key, value] = uid ? ["uid", uid] : ip ? ["ip", ip] : ["nick", nick!];

                        for (const other of document.querySelectorAll<HTMLElement>(`.ub-writer[data-${key}="${CSS.escape(value)}"]`)) {
                            const otherParent = other.closest<HTMLElement>(".ub-content, .cmt_nickbox, .search_comment");
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

                element.addEventListener("mouseover", (ev) => {
                    if (ctx.settings.checkViaShift && ev.shiftKey && element instanceof HTMLInputElement) element.checked = true;
                }, {signal: ctx.signal});
            }
        );

        // ===== Ctrl 클릭 삭제 =====
        const deleteByCtrl = async (postId: string): Promise<boolean> => {
            try {
                const gallery = document.querySelector<HTMLInputElement>("#gallery_id")?.value ?? "";
                return notifyManage(await deletePost({gallery, id: postId, link: location.href}), "게시글을 삭제했습니다.");
            } catch {
                useUiStore.getState().showToast("게시글 삭제 중 오류가 발생했습니다.", "error");
                return false;
            }
        };

        // 삭제 요청을 보낸 글 — 응답 전에 다시 눌러도 요청을 또 보내지 않는다
        const deleting = new Set<string>();

        ctx.addFilter(
            ".gall_list .ub-content",
            (element) => {
                if (handled.has(element)) return;
                handled.add(element);

                element.addEventListener("click", (ev) => {
                    // 관리하지 않는 갤러리에선 Ctrl+클릭(새 탭 열기)을 그대로 둔다 — 권한도 없는 삭제 요청을 보내지 않는다
                    if (!ctx.settings.deleteViaCtrl || !ev.ctrlKey || !isGalleryManager()) return;
                    // 체크박스 칸과 댓글 수(미리보기가 댓글만 열린다)는 삭제로 가로채지 않는다 — 제목 Ctrl+클릭은 v5처럼 삭제
                    if (ev.target instanceof Element && ev.target.closest("td:has(.article_chkbox), .reply_numbox")) return;

                    const postId = rowPostNo(element);
                    if (!postId) return;

                    // 요청 중에 다시 누른 것도 새 탭으로 열리지 않게 막은 뒤 거른다
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (deleting.has(postId)) return;
                    deleting.add(postId);

                    void deleteByCtrl(postId).then((deleted) => {
                        // 목록이 새로고침될 때까지(refresh가 꺼져 있으면 계속) 남겨 두면 다시 Ctrl+클릭해 지운 글에 요청이 또 간다
                        if (deleted) element.remove();
                    }).finally(() => deleting.delete(postId));
                }, {signal: ctx.signal});
            }
        );
    }
});
