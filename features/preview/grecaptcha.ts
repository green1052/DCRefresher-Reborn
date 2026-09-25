/** MAIN world grecaptcha.content.ts와 postMessage 통신 (api.js를 처음 불러오므로 10초 타임아웃) */
export const getGrecaptchaToken = (action: "comment_submit" | "insert_icon"): Promise<string | undefined> =>
    new Promise((resolve) => {
        const timer = window.setTimeout(() => {
            window.removeEventListener("message", onMessage);
            resolve(undefined);
        }, 10_000);

        const onMessage = (event: MessageEvent): void => {
            if (event.source !== window || !event.data || event.data.type !== "refresherGrecaptchaToken") return;

            window.clearTimeout(timer);
            window.removeEventListener("message", onMessage);
            resolve(typeof event.data.token === "string" ? event.data.token : undefined);
        };

        window.addEventListener("message", onMessage);
        window.postMessage({type: "refresherGrecaptcha", action}, "*");
    });
