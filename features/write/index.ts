import {PenLine} from "lucide-react";

import {sendMessage} from "@/core/messaging/protocol";
import {defineModule} from "@/core/module/define";
import {WRITE_PAGE} from "@/core/pages";

import {type ImageOptions, UPLOAD_OPTIONS_KEY} from "./images";

const SUBMIT = "button.write";
const EDITOR = ".note-editable";
const SUBJECT = "input#subject";
// 디시가 에디터에 넣는 자동 짤방·작성 가이드 (contenteditable=false라 사용자 글이 안에 들어가지 않는다)
const AUTO = "#auto_zzal_img_div, .wrt_guide_preview_inn";
// 디시 '글 작성을 취소하시겠습니까?' 레이어의 확인 버튼
const LEAVE = "#leave_confirm_box .btn_blue";
// 글쓰기의 이미지 버튼이 여는 이미지 올리기 팝업
const UPLOAD_POPUP = /\/upload\/image/;

/**
 * 나가기 방지 리스너의 수명. ctx.signal에 묶지 않는다: 확장이 업데이트되어 컨텍스트가 무효화되면(stopAll) ctx.signal이 풀려,
 * 작성 중인 글을 두고 새로고침하라는 안내를 따를 때 확인 없이 글이 날아간다. 모듈을 끌 때만 revoke가 푼다
 */
let listeners: AbortController | undefined;

/**
 * 페이지에 넣는 hookUploads가 읽을 설정을 둔다. 켜진 설정이 있으면 배경에 hookUploads를 넣어 달라고 한다 (페이지마다 한 번만 걸린다).
 * 둘 다 꺼져 있으면 지워 파일을 건드리지 않게 한다
 */
const publishImageOptions = ({webpConvert: webp, webpQuality, obfuscateName: rename}: { webpConvert: boolean; webpQuality: number; obfuscateName: boolean }): void => {
    if (!webp && !rename) {
        delete document.documentElement.dataset[UPLOAD_OPTIONS_KEY];
        return;
    }
    const options: ImageOptions = {webp, quality: webpQuality / 100, rename};
    document.documentElement.dataset[UPLOAD_OPTIONS_KEY] = JSON.stringify(options);
    void sendMessage("refresher:hookUploads").catch(console.error);
};

export default defineModule({
    id: "write",
    name: "글쓰기",
    description: "글쓰기 페이지를 변경합니다.",
    icon: PenLine,
    urls: [WRITE_PAGE, UPLOAD_POPUP],
    defaultEnable: false,

    settings: {
        // 모듈을 켜면 바로 동작하게 기본값을 켠다. 아래 이미지 설정은 올리는 파일이 바뀌므로 직접 켜게 둔다
        preventExit: {
            type: "check",
            name: "나가기 방지",
            desc: "작성 중인 글이 있으면 페이지를 나가기 전에 확인합니다.",
            default: true
        },
        webpConvert: {
            type: "check",
            name: "이미지 WebP 변환",
            desc: "올리는 이미지를 WebP로 바꿔 용량을 줄입니다. 움직이는 이미지(GIF·APNG)와 WebP·AVIF, WebP로 바꾸면 더 커지는 이미지는 그대로 올립니다.",
            default: false
        },
        webpQuality: {
            type: "range",
            name: "WebP 품질",
            desc: "낮을수록 용량이 줄고 화질이 떨어집니다.",
            default: 80,
            min: 10,
            max: 100,
            step: 5,
            unit: "%"
        },
        obfuscateName: {
            type: "check",
            name: "이미지 이름 숨기기",
            desc: "올리는 이미지의 파일 이름을 무작위로 바꿉니다.",
            default: false
        }
    },

    setup(ctx) {
        publishImageOptions(ctx.settings);
        ctx.addCleanup(() => delete document.documentElement.dataset[UPLOAD_OPTIONS_KEY]);
        if (!WRITE_PAGE.test(location.pathname)) return;

        // 등록을 누른 뒤의 페이지 이동은 막지 않는다. 디시가 성공 표시(#clickbutton)를 두는 페이지는 그것을 본다
        let submitting = false;
        // 디시 취소 레이어에서 이미 나가겠다고 확인했다
        let leaving = false;
        // 수정 페이지는 원래 글이 채워져 있으므로 고친 뒤에만 막는다
        let edited = !location.pathname.includes("/board/modify");

        const onClick = (ev: MouseEvent): void => {
            if (!(ev.target instanceof Element)) return;
            if (ev.target.closest(SUBMIT)) submitting = true;
            if (ev.target.closest(LEAVE)) leaving = true;
        };

        const onInput = (): void => {
            submitting = false;
            edited = true;
        };

        const onBeforeUnload = (ev: BeforeUnloadEvent): void => {
            // 디시는 등록에 성공해야 #clickbutton을 Y로 바꾸고 페이지를 옮긴다. 실패(alert)하면 N 그대로라 계속 막는다
            const flag = document.querySelector<HTMLInputElement>("#clickbutton");
            const posted = flag ? flag.value === "Y" : submitting;
            if (!ctx.settings.preventExit || posted || leaving || !edited) return;

            // 글자 없이 이미지·동영상만 올린 본문도 작성 중인 글이다. 디시가 넣은 자동 짤방·작성 가이드는 빼고 본다
            const editor = document.querySelector<HTMLElement>(EDITOR);
            const text = Array.from(editor?.childNodes ?? [], (node) => (node instanceof Element && node.matches(AUTO) ? "" : node.textContent)).join("").trim();
            const media = Array.from(editor?.querySelectorAll("img, video, iframe, embed") ?? []).some((element) => !element.closest(AUTO));
            const written = document.querySelector<HTMLInputElement>(SUBJECT)?.value.trim() || text || media;
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

    onChanged(ctx) {
        publishImageOptions(ctx.settings);
    },

    revoke() {
        listeners?.abort();
    }
});
