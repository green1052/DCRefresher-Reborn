import {sendMessage} from "@/core/messaging/protocol";
import {defineModule} from "@/core/module/define";
import type {ModuleSettings} from "@/core/module/types";
import {WRITE_PAGE} from "@/core/pages";

import {type ImageOptions, UPLOAD_OPTIONS_KEY} from "./images";
import {AUTO, EDITOR, LEAVE, POSTED, SUBJECT, SUBMIT} from "./markup";
import meta from "./meta";

/**
 * 나가기 방지 리스너. ctx.signal에 묶지 않고 모듈을 끌 때만 revoke가 푼다: 확장 업데이트로 컨텍스트가 무효화되면(stopAll) ctx.signal이 풀려,
 * 새로고침 안내를 따를 때 작성 중인 글이 확인 없이 날아간다.
 * 업로드 설정도 같은 이유로 revoke만 지운다. 페이지의 hookUploads는 무효화 뒤에도 살아 있어, 지우면 이미지가 원래 이름으로 올라간다.
 */
let listeners: AbortController | undefined;

/** hookUploads를 넣어 달라고 이미 했다. 넣은 스크립트는 페이지에 남으므로 다시 보내 배경을 깨울 필요가 없다. */
let hookRequested = false;

/**
 * 수정 페이지에서 고쳤다는 표시. 파이어폭스는 업데이트하면 이 스크립트를 정리 없이 없애고 다시 주입하므로 새 인스턴스가 이어받게 <html>에 둔다.
 * 모듈을 껐다 켤 때도 이어받아야 하므로 revoke에서도 지우지 않는다. 지우면 고친 글을 두고 나갈 때 확인 없이 날아간다.
 */
const EDITED_KEY = "refresherEdited";

/**
 * hookUploads가 읽을 설정을 둔다. 켜진 설정이 있으면 배경에 hookUploads를 넣어 달라고 한다 (페이지마다 한 번만 걸린다).
 */
const publishImageOptions = ({webpConvert: webp, webpQuality, webpConcurrency: concurrency, obfuscateName: rename}: ModuleSettings["write"]): void => {
    if (!webp && !rename) {
        delete document.documentElement.dataset[UPLOAD_OPTIONS_KEY];
        return;
    }
    const options: ImageOptions = {webp, quality: webpQuality / 100, rename, concurrency};
    document.documentElement.dataset[UPLOAD_OPTIONS_KEY] = JSON.stringify(options);
    if (hookRequested) return;
    hookRequested = true;
    sendMessage("refresher:hookUploads").catch((e: unknown) => {
        hookRequested = false;
        console.error(e);
    });
};

export default defineModule({
    ...meta,

    setup(ctx) {
        publishImageOptions(ctx.settings);
        ctx.onSettingsChanged(() => publishImageOptions(ctx.settings));
        if (!WRITE_PAGE.test(location.pathname)) return;

        // 등록을 누른 뒤의 페이지 이동은 막지 않는다. POSTED가 있는 페이지는 그것을 본다.
        let submitting = false;
        // 디시 취소 레이어에서 이미 나가겠다고 확인했다.
        let leaving = false;
        // 수정 페이지는 원래 글이 채워져 있으므로 고친 뒤에만 막는다.
        let edited = !location.pathname.includes("/board/modify") || EDITED_KEY in document.documentElement.dataset;
        const markEdited = (): void => {
            edited = true;
            document.documentElement.dataset[EDITED_KEY] = "";
        };

        const onClick = (ev: MouseEvent): void => {
            if (!(ev.target instanceof Element)) return;
            if (ev.target.closest(SUBMIT)) submitting = true;
            if (ev.target.closest(LEAVE)) leaving = true;
        };

        const onInput = (): void => {
            submitting = false;
            if (!edited) markEdited();
        };

        const onBeforeUnload = (ev: BeforeUnloadEvent): void => {
            // 등록에 실패(alert)하면 POSTED가 N 그대로라 계속 막는다.
            const flag = document.querySelector<HTMLInputElement>(POSTED);
            const posted = flag ? flag.value === "Y" : submitting;
            if (!ctx.settings.preventExit || posted || leaving || !edited) return;

            // 글자 없이 이미지·동영상만 올린 본문도 작성 중인 글이다. 디시가 넣은 자동 짤방·작성 가이드는 빼고 본다.
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

        // 수정 페이지에서 에디터 스크립트로 넣거나 뺀 이미지는 input 이벤트가 나지 않아 에디터의 DOM 변화로 알아챈다.
        // 디시가 원래 글을 채우는 변화는 빼려고 사용자가 페이지를 건드린 뒤부터 보고, 속성(hover·class) 변화는 보지 않는다.
        // 등록 뒤에 디시가 에디터를 고칠 수 있어 submitting은 풀지 않는다. 같은 요소를 다시 observe하면 옵션만 바뀐다.
        if (edited) return;
        const observer = new MutationObserver(() => {
            markEdited();
            observer.disconnect();
        });
        const watch = (): void => {
            if (edited) return;
            const editor = document.querySelector(EDITOR);
            if (editor) observer.observe(editor, {childList: true, subtree: true, characterData: true});
        };
        for (const type of ["pointerdown", "keydown", "dragenter"]) document.addEventListener(type, watch, {capture: true, signal});
        signal.addEventListener("abort", () => observer.disconnect());
    },

    revoke() {
        listeners?.abort();
        delete document.documentElement.dataset[UPLOAD_OPTIONS_KEY];
    }
});
