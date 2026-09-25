import {injectScript} from "wxt/utils/inject-script";

/** 디시 댓글·디시콘·글자콘의 reCAPTCHA v3 사이트 키 (comment.js) */
const SITE_KEY = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";

/** api.js가 막혀 있으면(광고 차단 등) 끝나지 않으니 기다리지 않는다 */
const TIMEOUT = 15_000;

/**
 * 디시가 v3 토큰을 요구할 때만 페이지에 grecaptcha.js를 넣어 토큰을 받는다 (토큰은 디시 페이지에서 받아야 유효하다).
 * 실패·시간 초과면 undefined
 */
export const grecaptchaToken = (action: "comment_submit" | "insert_icon"): Promise<string | undefined> =>
    new Promise((resolve) => {
        const timer = window.setTimeout(() => resolve(undefined), TIMEOUT);
        const done = (token?: string): void => {
            window.clearTimeout(timer);
            resolve(token || undefined);
        };

        injectScript("/grecaptcha.js", {
            modifyScript(script) {
                Object.assign(script.dataset, {siteKey: SITE_KEY, action});
                script.addEventListener("refresher:grecaptcha", (ev) => done((ev as CustomEvent<string>).detail), {once: true});
            }
        }).catch(() => done());
    });
