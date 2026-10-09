import {defineModule} from "@/core/module/define";
import {rowPostNo, queryString} from "@/core/http/urls";
import {LIST_ROW_SELECTOR, WRITER_ROW_SELECTOR} from "@/core/list";
import {deletePost} from "@/core/preview/request";
import {whenDomReady} from "@/utils/dom";
import {notifyManage} from "@/stores/notify";
import {isGalleryManager} from "@/utils/user";

import meta from "./meta";
import {removeViewTools, renderViewTools} from "./view";

/** 체크박스와 작성자 칸이 같이 든 칸. 목록 행에 더해 댓글은 작성자 칸(.cmt_nickbox)이다. */
const CHECKBOX_ROW = `${WRITER_ROW_SELECTOR}, .cmt_nickbox`;

const GIF_VIDEO = ".gallview_contents video";

/** GIF 조작을 건 영상의 원래 onmousedown(없으면 null). 설정·모듈을 끌 때 되돌린다. */
const gifOriginals = new WeakMap<HTMLVideoElement, string | null>();

const enableGifControl = (element: Element): void => {
    if (!(element instanceof HTMLVideoElement) || gifOriginals.has(element)) return;
    if (element.dataset.src?.includes("dcinside.com/dccon.php")) return;

    gifOriginals.set(element, element.getAttribute("onmousedown"));
    element.removeAttribute("onmousedown");
    element.setAttribute("controls", "");
};

const disableGifControl = (): void => {
    for (const video of document.querySelectorAll<HTMLVideoElement>(GIF_VIDEO)) {
        const original = gifOriginals.get(video);
        if (original === undefined) continue;

        gifOriginals.delete(video);
        video.removeAttribute("controls");
        if (original !== null) video.setAttribute("onmousedown", original);
    }
};

export default defineModule({
    ...meta,

    setup(ctx) {
        // 핸들러를 붙인 요소. DOM 속성으로 표시하면 refresh가 체크박스 칸을 복제할 때 표시도 복제돼 새 행에 핸들러가 붙지 않는다.
        const handled = new WeakSet<Element>();

        // ===== GIF 조작 =====
        ctx.addFilter(GIF_VIDEO, (element) => {
            if (ctx.settings.enableGifControl) enableGifControl(element);
        });

        // ===== 글 보기: 이미지 출처·같은 제목 찾기 =====
        // 본문·첨부 목록까지 읽은 뒤에 한 번 그린다. 필터로 걸면 머리를 읽는 순간 불려 본문이 아직 없다.
        whenDomReady(() => renderViewTools(ctx.settings), ctx.signal);
        // 필터는 등록할 때와 요소가 새로 붙을 때만 돌므로, 이미 열린 글의 영상은 설정이 바뀔 때 여기서 바꾸고 되돌린다.
        ctx.onSettingsChanged((keys) => {
            if (keys.has("imageOrigin") || keys.has("titleSearch")) renderViewTools(ctx.settings);
            if (!keys.has("enableGifControl")) return;
            if (ctx.settings.enableGifControl) {
                for (const video of document.querySelectorAll(GIF_VIDEO)) enableGifControl(video);
            } else {
                disableGifControl();
            }
        });

        // ===== 체크박스 편의 =====
        ctx.addFilter(
            ".article_chkbox",
            (element) => {
                if (!(element instanceof HTMLInputElement) || handled.has(element)) return;
                handled.add(element);

                const parent = element.closest<HTMLElement>(CHECKBOX_ROW);
                const {uid, ip, nick} = parent?.querySelector<HTMLElement>(":scope > .ub-writer")?.dataset ?? {};

                element.addEventListener("click", (ev) => {
                    if (ctx.settings.checkAllTargetUser && ev.shiftKey && (uid || ip || nick)) {
                        // 유동은 data-uid=""다. key와 값을 같은 기준으로 골라야 한다.
                        // 값만 ??로 고르면 [data-ip=""]가 되어 회원 글이 전부 잡힌다.
                        const [key, value] = uid ? ["uid", uid] : ip ? ["ip", ip] : ["nick", nick!];

                        for (const other of document.querySelectorAll<HTMLElement>(`.ub-writer[data-${key}="${CSS.escape(value)}"]`)) {
                            const otherParent = other.closest<HTMLElement>(CHECKBOX_ROW);
                            for (const box of otherParent?.querySelectorAll<HTMLInputElement>(".article_chkbox") ?? []) box.checked = element.checked;
                        }
                    }

                    if (ctx.settings.checkCommentViaCtrl && ev.ctrlKey) {
                        // 댓글은 li#comment_li_{no}, 대댓글은 그 다음 형제 li 안의 ul#reply_list_{no} > li#reply_li_{no} (comment.js).
                        const commentNo = element.closest<HTMLElement>("li")?.id.match(/^comment_li_(\d+)$/)?.[1];
                        if (!commentNo) return;

                        for (const box of document.getElementById(`reply_list_${commentNo}`)?.querySelectorAll<HTMLInputElement>(".article_chkbox") ?? []) {
                            box.checked = element.checked;
                        }
                    }
                }, {signal: ctx.signal});

                // 왼쪽 버튼을 누른 채 지나간 칸만 체크한다. 그냥 지나가도 체크하면 Shift+클릭이 방금 체크된 칸을 도로 푼다.
                // 드래그를 시작한 칸은 누르기 전에 들어왔으므로 떠날 때(mouseout) 체크한다.
                const checkOnDrag = (ev: MouseEvent): void => {
                    if (ctx.settings.checkViaShift && ev.shiftKey && ev.buttons === 1) element.checked = true;
                };
                element.addEventListener("mouseover", checkOnDrag, {signal: ctx.signal});
                element.addEventListener("mouseout", checkOnDrag, {signal: ctx.signal});
            }
        );

        // ===== Ctrl 클릭 삭제 =====
        // 삭제 요청을 보낸 글. 응답 전에 다시 눌러도 요청을 또 보내지 않는다.
        const deleting = new Set<string>();

        ctx.addFilter(
            LIST_ROW_SELECTOR,
            (element) => {
                if (handled.has(element)) return;
                handled.add(element);

                element.addEventListener("click", (ev) => {
                    // 관리하지 않는 갤러리에선 Ctrl+클릭(새 탭 열기)을 그대로 둔다. 권한 없는 삭제 요청을 보내지 않는다.
                    if (!ctx.settings.deleteViaCtrl || !ev.ctrlKey || !isGalleryManager()) return;
                    // 체크박스 칸과 댓글 수(미리보기가 댓글만 연다)는 가로채지 않는다. 제목 Ctrl+클릭은 v5처럼 삭제한다.
                    if (ev.target instanceof Element && ev.target.closest("td:has(.article_chkbox), .reply_numbox")) return;

                    const postId = rowPostNo(element);
                    if (!postId) return;

                    // 요청 중에 다시 누른 것도 새 탭으로 열리지 않게 막은 뒤 거른다.
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (deleting.has(postId)) return;
                    deleting.add(postId);

                    // #gallery_id 입력칸은 없는 페이지가 있어 주소의 id를 갤러리로 쓴다.
                    const gallery = queryString("id") ?? "";
                    void notifyManage(
                        deletePost({gallery, id: postId, link: location.href}),
                        "게시글을 삭제했습니다.",
                        "게시글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요."
                    ).then((deleted) => {
                        // 행을 남겨 두면 목록이 새로고침될 때까지(refresh가 꺼져 있으면 계속) 지운 글에 요청을 또 보낼 수 있다.
                        if (deleted) element.remove();
                    }).finally(() => deleting.delete(postId));
                }, {signal: ctx.signal});
            }
        );
    },

    revoke() {
        disableGifControl();
        removeViewTools();
    }
});
