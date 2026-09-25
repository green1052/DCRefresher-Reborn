import {defineModule} from "@/core/module/define";
import {galleryTypeName, isMiniGallery, urls} from "@/core/http/urls";
import {postManage} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";
import {csrfToken} from "@/utils/cookie";
import {notifyManage} from "@/utils/notify";

export default defineModule({
    id: "manage",
    name: "관리",
    description: "무급 노예들을 위한 여러 편의 기능을 제공합니다.",
    urls: [/\/board\/(view|lists)/],
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
        // 행/체크박스 핸들러 일괄 해제용 (revoke에서 abort)
        const handlers = new AbortController();

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
                if (element.dataset.refresherManageHandler === "true") return;
                element.dataset.refresherManageHandler = "true";

                const parent = element.closest<HTMLElement>(".ub-content, .cmt_nickbox, .search_comment");
                const writer = parent?.querySelector<HTMLElement>(":scope > .ub-writer");
                const uid = writer?.dataset.uid;
                const ip = writer?.dataset.ip;
                const nick = writer?.dataset.nick;

                element.addEventListener("click", (event) => {
                    const source = event.target as HTMLInputElement;

                    if (ctx.settings.checkAllTargetUser && event.shiftKey && (uid || ip || nick)) {
                        const key = uid ? "uid" : ip ? "ip" : "nick";
                        const value: string = (uid ?? ip ?? nick) as string;

                        for (const other of document.querySelectorAll<HTMLElement>(`.ub-writer[data-${key}="${CSS.escape(value)}"]`)) {
                            const otherParent = other.closest<HTMLElement>(".ub-content, .cmt_nickbox, .search_comment");
                            otherParent?.querySelectorAll<HTMLInputElement>(".article_chkbox").forEach((box) => {
                                box.checked = (source as HTMLInputElement).checked;
                            });
                        }
                    }

                    if (ctx.settings.checkCommentViaCtrl && event.ctrlKey) {
                        // 댓글은 li#comment_li_{no}, 대댓글은 그 다음 형제 li 안의 ul#reply_list_{no} > li#reply_li_{no} (comment.js)
                        const commentNo = element.closest<HTMLElement>("li")?.id.match(/^comment_li_(\d+)$/)?.[1];
                        if (!commentNo) return;

                        document.getElementById(`reply_list_${commentNo}`)?.querySelectorAll<HTMLInputElement>(".article_chkbox").forEach((box) => {
                            box.checked = source.checked;
                        });
                    }
                }, {signal: handlers.signal});

                element.addEventListener("mouseover", (event) => {
                    if (ctx.settings.checkViaShift && event.shiftKey && !(element instanceof HTMLInputElement && element.checked)) {
                        if (element instanceof HTMLInputElement) element.checked = true;
                    }
                }, {signal: handlers.signal});
            }
        );

        // ===== Ctrl 클릭 삭제 =====
        const deletePost = async (postId: string): Promise<void> => {
            const isMini = isMiniGallery(location.href);

            try {
                const body = new URLSearchParams({
                    ci_t: await csrfToken(),
                    id: document.querySelector<HTMLInputElement>("#gallery_id")?.value ?? "",
                    "nos[]": postId,
                    _GALLTYPE_: galleryTypeName(location.href)
                });
                notifyManage(await postManage(isMini ? urls.manage.deleteMini : urls.manage.delete, body), "게시글을 삭제했습니다.");
            } catch {
                useUiStore.getState().showToast("게시글 삭제 중 오류가 발생했습니다.", "error");
            }
        };

        ctx.addFilter(
            ".gall_list .ub-content",
            (element) => {
                if (element.dataset.refresherManageClick === "true") return;
                element.dataset.refresherManageClick = "true";

                element.addEventListener("click", (event) => {
                    if (!ctx.settings.deleteViaCtrl || !event.ctrlKey) return;

                    const postId = element.dataset.no;
                    if (!postId) return;

                    event.preventDefault();
                    event.stopPropagation();
                    void deletePost(postId);
                }, {signal: handlers.signal});
            }
        );

        ctx.addCleanup(() => {
            handlers.abort();

            for (const element of document.querySelectorAll<HTMLElement>("[data-refresher-manage-handler], [data-refresher-manage-click]")) {
                delete element.dataset.refresherManageHandler;
                delete element.dataset.refresherManageClick;
            }
        });
    }
});
