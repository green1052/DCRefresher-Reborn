import {PenLine} from "lucide-react";

import {defineModule} from "@/core/module/define";
import {WRITE_PAGE} from "@/core/pages";

const SUBMIT = "button.write";
const EDITOR = ".note-editable";
const SUBJECT = "input#subject";

/**
 * 나가기 방지 리스너의 수명. ctx.signal에 묶지 않는다: 확장이 업데이트되어 컨텍스트가 무효화되면(stopAll) ctx.signal이 풀려,
 * 작성 중인 글을 두고 새로고침하라는 안내를 따를 때 확인 없이 글이 날아간다. 모듈을 끌 때만 revoke가 푼다
 */
let listeners: AbortController | undefined;

export default defineModule({
    id: "write",
    name: "글쓰기",
    description: "글쓰기 페이지를 변경합니다.",
    icon: PenLine,
    urls: [WRITE_PAGE],
    defaultEnable: false,

    settings: {
        // 모듈의 유일한 기능이라 모듈을 켜면 바로 동작하게 기본값을 켠다
        preventExit: {
            type: "check",
            name: "나가기 방지",
            desc: "작성 중인 글이 있으면 페이지를 나가기 전에 확인합니다.",
            default: true
        }
    },

    setup(ctx) {
        // 등록을 누른 뒤의 페이지 이동은 막지 않는다. 등록이 실패해 다시 입력하면 다시 막는다
        let submitting = false;
        // 수정 페이지는 원래 글이 채워져 있으므로 고친 뒤에만 막는다
        let edited = !location.pathname.includes("/board/modify");

        const onClick = (ev: MouseEvent): void => {
            if (ev.target instanceof Element && ev.target.closest(SUBMIT)) submitting = true;
        };

        const onInput = (): void => {
            submitting = false;
            edited = true;
        };

        const onBeforeUnload = (ev: BeforeUnloadEvent): void => {
            if (!ctx.settings.preventExit || submitting || !edited) return;

            // 글자 없이 이미지·동영상만 올린 본문도 작성 중인 글이다
            const editor = document.querySelector<HTMLElement>(EDITOR);
            const written =
                document.querySelector<HTMLInputElement>(SUBJECT)?.value.trim() ||
                editor?.textContent?.trim() ||
                editor?.querySelector("img, video, iframe, embed");
            if (written) ev.preventDefault();
        };

        listeners = new AbortController();
        const {signal} = listeners;
        document.addEventListener("click", onClick, {capture: true, signal});
        document.addEventListener("input", onInput, {capture: true, signal});
        window.addEventListener("beforeunload", onBeforeUnload, {signal});

        // 수정 페이지에서 에디터 스크립트로 넣거나 뺀 이미지는 input 이벤트가 나지 않으므로 에디터의 변화로 고친 것을 안다.
        // 디시가 원래 글을 채우는 것은 잡지 않게 사용자가 페이지를 건드린 뒤부터 본다. 등록 뒤 디시가 에디터를 고칠 수 있어 submitting은 두고,
        // 속성(hover·class)의 변화는 보지 않는다. 같은 요소를 다시 observe해도 옵션만 바뀌므로 건드릴 때마다 부른다
        if (edited) return;
        const observer = new MutationObserver(() => {
            edited = true;
        });
        const watch = (): void => {
            const editor = document.querySelector(EDITOR);
            if (editor) observer.observe(editor, {childList: true, subtree: true, characterData: true});
        };
        for (const type of ["pointerdown", "keydown", "dragenter"]) document.addEventListener(type, watch, {capture: true, signal});
        signal.addEventListener("abort", () => observer.disconnect());
    },

    revoke() {
        listeners?.abort();
    }
});
