import type {ModuleDefinition} from "@/core/module/types";

let boundButton: HTMLButtonElement | null = null;
let boundClick: ((event: MouseEvent) => void) | null = null;

const writeModule: ModuleDefinition = {
    id: "write",
    name: "글쓰기",
    description: "글쓰기 페이지를 변경합니다.",
    urls: [/\/board\/(write|modify)/],
    defaultEnable: false,

    settings: {
        bypassTitleLimit: {
            type: "check",
            name: "제목 글자수 제한 우회",
            desc: "제목 글자수 제한을 우회합니다.",
            default: false
        },
        header: {
            type: "text",
            name: "머리말",
            desc: "머리말을 설정합니다. (HTML)",
            default: ""
        },
        footer: {
            type: "text",
            name: "꼬리말",
            desc: "꼬리말을 설정합니다. (HTML)",
            default: ""
        },
        preventExit: {
            type: "check",
            name: "나가기 방지",
            desc: "글 작성 중 나가기를 방지합니다.",
            default: false
        }
    },

    setup(ctx) {
        const onSubmitClick = (event: MouseEvent): void => {
            void event;
            const noteEditable = document.querySelector<HTMLElement>(".note-editable");

            if (noteEditable) {
                const header = String(ctx.settings.header ?? "");
                const footer = String(ctx.settings.footer ?? "");

                // v5: 중복 삽입 방지 없음 (연타시 중복)
                if (header) noteEditable.insertAdjacentHTML("afterbegin", header);
                if (footer) noteEditable.insertAdjacentHTML("beforeend", footer);
            }

            if (ctx.settings.bypassTitleLimit === true) {
                const subject = document.querySelector<HTMLInputElement>("input#subject");
                if (subject && subject.value.length === 1) subject.value += "\u200B";
            }
        };

        // 제출 버튼에 1회 바인딩 (v5: 발견즉시 필터 해제 → 마커로 동일하게)
        ctx.addFilter(
            "button.write",
            (element) => {
                if (!(element instanceof HTMLButtonElement) || element.dataset.refresherWriteBound === "1") return;

                element.dataset.refresherWriteBound = "1";
                boundClick = onSubmitClick;
                element.addEventListener("click", boundClick);
                boundButton = element;
            },
            {skipIfNotExists: true}
        );

        const onBeforeUnload = (event: BeforeUnloadEvent): void => {
            // 제출 버튼을 누른 직후(호버)는 가드 스킵
            if (document.querySelector("button.write:hover")) return;

            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", onBeforeUnload);
        ctx.addCleanup(() => window.removeEventListener("beforeunload", onBeforeUnload));
    },

    revoke(ctx) {
        if (boundButton && boundClick) {
            boundButton.removeEventListener("click", boundClick);
        }

        boundButton = null;
        boundClick = null;
        void ctx;
    }
};

export default writeModule;
