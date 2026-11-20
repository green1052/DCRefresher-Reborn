import {sendMessage} from "@/core/messaging/protocol";
import {defineModule} from "@/core/module/define";
import type {ModuleSettings} from "@/core/module/types";
import {WRITE_PAGE} from "@/core/pages";

import {type ImageOptions, UPLOAD_OPTIONS_KEY} from "./images";
import {AUTO, EDITOR, LEAVE, POSTED, SUBJECT, SUBMIT} from "./markup";
import meta from "./meta";

/** hookUploads 넣기를 이미 요청했다. 넣은 스크립트는 모듈을 껐다 켜도 페이지에 남는다. */
let hookRequested = false;

/** 수정 페이지에서 고쳤다는 표시. 파이어폭스 재주입 인스턴스가 이어받게 <html>에 두고 끌 때도 지우지 않는다. */
const EDITED_KEY = "refresherEdited";

/** hookUploads가 읽을 설정을 <html>에 둔다. 켜진 설정이 있으면 배경에 넣어 달라고 한다 (한 번만). */
const publishImageOptions = ({webpConvert: webp, webpQuality, obfuscateName: rename}: ModuleSettings["write"]): void => {
    if (!webp && !rename) {
        delete document.documentElement.dataset[UPLOAD_OPTIONS_KEY];
        return;
    }
    const options: ImageOptions = {webp, quality: webpQuality / 100, rename};
    document.documentElement.dataset[UPLOAD_OPTIONS_KEY] = JSON.stringify(options);
    if (hookRequested) return;
    hookRequested = true;
    sendMessage("refresher:hookUploads").catch((e: unknown) => {
        hookRequested = false;
        console.error(e);
    });
};

export default defineModule(meta, {
    setup(ctx) {
        // 끌 때만 지운다. stopAll(업데이트)로 지우면 페이지의 hookUploads가 살아 있어 원래 이름으로 올라간다.
        ctx.onRevoke(() => {
            delete document.documentElement.dataset[UPLOAD_OPTIONS_KEY];
        });
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
            // 나가기 확인 뒤 계속 쓰면 막기를 다시 건다. leaving이 남아 있으면 확인 뒤에 쓴 글이 확인 없이 날아간다.
            submitting = false;
            leaving = false;
            if (!edited) markEdited();
        };

        const onBeforeUnload = (ev: BeforeUnloadEvent): void => {
            // 등록에 실패(alert)하면 POSTED가 N 그대로라 계속 막는다.
            const flag = document.querySelector<HTMLInputElement>(POSTED);
            const posted = flag ? flag.value === "Y" : submitting;
            if (!ctx.settings.preventExit || posted || leaving || !edited) return;

            // 글자 없이 이미지, 동영상만 올린 본문도 작성 중인 글이다. 디시가 넣은 자동 짤방, 작성 가이드는 빼고 본다.
            const editor = document.querySelector<HTMLElement>(EDITOR);
            const text = Array.from(editor?.childNodes ?? [], (node) => (node instanceof Element && node.matches(AUTO) ? "" : node.textContent)).join("").trim();
            const media = Array.from(editor?.querySelectorAll("img, video, iframe, embed") ?? []).some((element) => !element.closest(AUTO));
            const written = document.querySelector<HTMLInputElement>(SUBJECT)?.value.trim() || text || media;
            if (written) ev.preventDefault();
        };

        // 나가기 방지 리스너도 끌 때만 푼다. 업데이트로 풀리면 새로고침 안내를 따를 때 글이 확인 없이 날아간다.
        const listeners = new AbortController();
        ctx.onRevoke(() => listeners.abort());
        const {signal} = listeners;
        document.addEventListener("click", onClick, {capture: true, signal});
        document.addEventListener("input", onInput, {capture: true, signal});
        window.addEventListener("beforeunload", onBeforeUnload, {signal});

        // 에디터 스크립트로 넣거나 뺀 이미지는 input 이벤트가 나지 않아 DOM 변화로 알아챈다. 디시가 원래 글을 채우는 변화는 빼려고 사용자가 건드린 뒤부터 본다.
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
    }
});
