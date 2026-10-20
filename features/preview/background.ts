import {storage} from "wxt/utils/storage";

import {onMessage, TURNSTILE_CANCEL_EVENT, TURNSTILE_HOST, type TurnstileResult} from "@/core/messaging/protocol";
import {defineBackgroundModule, hasTab, runInPage} from "@/core/module/background";
import {COMMENT_SITE_KEYS, ICON_SITE_KEY} from "@/core/preview/dcinside-js";
import type {TurnstileConfig} from "@/core/preview/types";
import {moduleDataKey} from "@/core/storage/items";

import meta from "./meta";

/** api.js가 막히면(광고 차단 등) 끝나지 않으므로 이 시간까지만 기다린다. */
const GRECAPTCHA_TIMEOUT = 15_000;
/** 보이지 않게 받는 Turnstile 토큰. 디시 wait(20초)보다 조금 길게 잡는다. */
const TURNSTILE_TIMEOUT = 30_000;

/**
 * 탭의 페이지 컨텍스트에서 실행된다(직렬화되므로 바깥 변수를 쓰지 않는다).
 * api.js는 이때 처음 불러온다. 미리 넣으면 원래 comment.js의 typeof grecaptcha 검사 결과가 바뀌어 v2 체크박스가 뜬다.
 */
const executeGrecaptcha = async (siteKey: string, action: string): Promise<string> => {
    type Grecaptcha = {
        ready: (callback: () => void) => void;
        render: (container: HTMLElement, parameters: { sitekey: string; size: "invisible" }) => number;
        execute: (key: string | number, options: { action: string }) => Promise<string>;
    };
    const scope = window as Window & { grecaptcha?: Grecaptcha; refresherRecaptchaWidgets?: Record<string, number> };

    if (!scope.grecaptcha) {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("api.js"));
            document.head.append(script);
        });
    }

    const grecaptcha = scope.grecaptcha!;
    await new Promise<void>((resolve) => grecaptcha.ready(resolve));
    try {
        return await grecaptcha.execute(siteKey, {action});
    } catch {
        // api.js가 이미 다른 키로 떠 있으면(디시 comment.js나 앞선 디시콘 재전송) 그 키만 실행할 수 있어 던진다.
        // 이 키로 보이지 않는 위젯을 키마다 한 번만 그려 다시 쓴다. 매번 그리면 위젯과 배지가 쌓인다.
        const widgets = (scope.refresherRecaptchaWidgets ??= {});
        widgets[siteKey] ??= grecaptcha.render(document.body.appendChild(document.createElement("div")), {sitekey: siteKey, size: "invisible"});
        return grecaptcha.execute(widgets[siteKey], {action});
    }
};

/**
 * 탭의 페이지 컨텍스트에서 Turnstile 위젯을 그려 토큰을 받는다 (디시 comment.js의 ts_cmt_load·ts_cmt_wait). 직렬화되므로 바깥 변수를 쓰지 않는다.
 * host(미리보기 확인 창의 자리)가 없으면 투명하게 그리고, 확인을 눌러야 하면(interactive) 기다리지 않고 돌아온다. 아니면 디시처럼 wait까지만 기다린다.
 * host가 있으면 그 안에 보이게 그리고 누르거나 창이 닫힐 때(cancelEvent)까지 기다린다. 토큰은 한 번만 쓰이므로 받을 때마다 새로 그리고 지운다.
 */
const executeTurnstile = async ({sitekey, wait, appearance}: TurnstileConfig, hostAttribute: string | null, cancelEvent: string): Promise<TurnstileResult> => {
    type Turnstile = {
        render: (container: HTMLElement, parameters: Record<string, string | ((token: string) => void)>) => string | undefined;
        remove: (id: string) => void;
    };
    const scope = window as Window & { turnstile?: Turnstile };

    if (!scope.turnstile) {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("api.js"));
            document.head.append(script);
        });
    }

    const turnstile = scope.turnstile!;
    const started = performance.now();
    // 확인 창은 오버레이(열린 shadow root) 안에 있다.
    const host = hostAttribute ? document.querySelector("refresher-root")?.shadowRoot?.querySelector<HTMLElement>(`[${hostAttribute}]`) : null;
    const box = document.createElement("div");
    if (host) {
        host.append(box);
    } else {
        // data-refresher-ui: 확장이 붙인 UI라 디시 내용으로 세지 않는다 (차단 감지).
        // 화면 밖에 두면 크롬이 위젯 iframe을 느리게 돌려 판정이 몇 배 늦다. 화면 안에 투명하게 둔다.
        box.dataset.refresherUi = "";
        box.style.cssText = "position:fixed;left:0;bottom:0;opacity:0;pointer-events:none";
        document.body.append(box);
    }

    let state = "pending";
    let tokenMs = 0;
    let id: string | undefined;
    try {
        const token = await new Promise<string>((resolve) => {
            id = turnstile.render(box, {
                sitekey,
                action: "comment",
                appearance: host ? "always" : appearance || "interaction-only",
                language: "ko",
                // 확인 창은 디시 다크모드를 따르는 오버레이의 색을 맞춘다.
                ...(host && {theme: host.closest(".dark") ? "dark" : "light"}),
                callback: (token) => {
                    state = "ok";
                    tokenMs = Math.max(1, Math.round(performance.now() - started));
                    resolve(token);
                },
                "before-interactive-callback": () => {
                    state = "interactive";
                    if (!host) resolve("");
                },
                "error-callback": () => {
                    state = "error";
                    resolve("");
                }
            });
            if (host) host.addEventListener(cancelEvent, () => resolve(""), {once: true});
            else if (wait) setTimeout(() => resolve(""), wait);
        });
        return {token, state, tokenMs};
    } finally {
        if (id !== undefined) turnstile.remove(id);
        box.remove();
    }
};

/** 미리보기: 댓글·디시콘 작성과 댓글 삭제에 쓸 reCAPTCHA·Turnstile 토큰을 탭의 페이지(MAIN world)에서 받아 온다. */
export default defineBackgroundModule(meta, {
    listen() {
        // 6.2 이전의 미리보기로 읽은 글 기록(지금은 :visited로 표시)을 지운다. 6.3에서 뺀다.
        browser.runtime.onInstalled.addListener(() => void storage.removeItem(moduleDataKey("preview")));

        // 토큰은 디시 도메인에서 실행해야 유효하다. 상주 스크립트 없이 디시가 v3 토큰을 요구할 때만 주입한다.
        onMessage("refresher:grecaptchaToken", async ({data, sender}) => {
            if (!hasTab(sender)) return undefined;

            try {
                const siteKey = data.action === "insert_icon" ? ICON_SITE_KEY : COMMENT_SITE_KEYS[data.rcKey];
                const injection = runInPage(sender, executeGrecaptcha, [siteKey, data.action]);
                // 시간 초과가 이긴 뒤 탭이 닫혀 실패해도 처리되지 않은 거절로 남지 않게 한다.
                injection.catch(() => {});
                const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, GRECAPTCHA_TIMEOUT));
                const [result] = (await Promise.race([injection, timeout])) ?? [];
                return typeof result?.result === "string" ? result.result : undefined;
            } catch {
                return undefined;
            }
        });

        // 토큰은 디시 도메인에서 받아야 유효하다. 확인 창에 그릴 때는 사용자를 기다리므로 시간을 재지 않는다 (창을 닫으면 끝난다).
        onMessage("refresher:turnstileToken", async ({data: {config, visible}, sender}) => {
            if (!hasTab(sender)) return undefined;

            try {
                const injection = runInPage(sender, executeTurnstile, [config, visible ? TURNSTILE_HOST : null, TURNSTILE_CANCEL_EVENT]);
                injection.catch(() => {});
                const timeout = new Promise<undefined>((resolve) => {
                    if (!visible) setTimeout(resolve, TURNSTILE_TIMEOUT);
                });
                const [result] = (await Promise.race([injection, timeout])) ?? [];
                return result?.result ?? undefined;
            } catch {
                return undefined;
            }
        });
    }
});
