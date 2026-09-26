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
        // 모듈의 유일한 기능 — 모듈을 켜면 바로 동작하게 기본으로 켠다
        preventExit: {
            type: "check",
            name: "나가기 방지",
            desc: "작성 중인 글이 있으면 페이지를 나가기 전에 확인합니다.",
            default: true
        }
    },

    setup(ctx) {
        // 등록을 눌렀으면 이어지는 페이지 이동은 막지 않는다 — 등록이 실패해 다시 고치기 시작하면 다시 막는다
        let submitting = false;

        const onClick = (ev: MouseEvent): void => {
            if (ev.target instanceof Element && ev.target.closest(SUBMIT)) submitting = true;
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
