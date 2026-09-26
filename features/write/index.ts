import DOMPurify from "dompurify";

import {defineModule} from "@/core/module/define";

const SUBMIT = "button.write";
const EDITOR = ".note-editable";
const SUBJECT = "input#subject";

export default defineModule({
    id: "write",
    name: "글쓰기",
    description: "글쓰기 페이지를 변경합니다.",
    urls: [/\/board\/(write|modify)/],
    defaultEnable: false,

    settings: {
        header: {
            type: "text",
            name: "머리말",
            desc: "새 글을 등록할 때 본문 맨 앞에 넣습니다. (HTML)",
            default: ""
        },
        footer: {
            type: "text",
            name: "꼬리말",
            desc: "새 글을 등록할 때 본문 맨 뒤에 넣습니다. (HTML)",
            default: ""
        },
        preventExit: {
            type: "check",
            name: "나가기 방지",
            desc: "작성 중인 글이 있으면 페이지를 나가기 전에 확인합니다.",
            default: false
        }
    },

    setup(ctx) {
        // 등록을 눌렀으면 이어지는 페이지 이동은 막지 않는다 — 등록이 실패해 다시 고치기 시작하면 다시 막는다
        let submitting = false;

        // 캡처 단계에서 받아야 디시의 등록 처리가 본문을 읽기 전에 넣을 수 있다
        const onClick = (ev: MouseEvent): void => {
            if (!(ev.target instanceof Element) || !ev.target.closest(SUBMIT)) return;

            submitting = true;

            // 수정 페이지의 본문에는 이미 들어가 있다
            const editor = document.querySelector<HTMLElement>(EDITOR);
            if (!editor || !location.pathname.includes("/write") || editor.dataset.refresherWrite) return;

            // 등록이 실패해 다시 눌러도 두 번 넣지 않는다
            editor.dataset.refresherWrite = "1";
            // 가져온 설정 파일의 HTML일 수 있어 스크립트·이벤트 속성은 걸러 넣는다 (style 속성은 기본 설정이 남긴다)
            const {header, footer} = ctx.settings;
            if (header) editor.insertAdjacentHTML("afterbegin", DOMPurify.sanitize(String(header)));
            if (footer) editor.insertAdjacentHTML("beforeend", DOMPurify.sanitize(String(footer)));
        };

        const onInput = (): void => {
            submitting = false;
        };

        const onBeforeUnload = (ev: BeforeUnloadEvent): void => {
            if (!ctx.settings.preventExit || submitting) return;

            const written =
                document.querySelector<HTMLInputElement>(SUBJECT)?.value.trim() ||
                document.querySelector<HTMLElement>(EDITOR)?.textContent?.trim();
            if (written) ev.preventDefault();
        };

        const {signal} = ctx;
        document.addEventListener("click", onClick, {capture: true, signal});
        document.addEventListener("input", onInput, {capture: true, signal});
        window.addEventListener("beforeunload", onBeforeUnload, {signal});
    }
});
