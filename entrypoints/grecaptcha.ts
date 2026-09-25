/**
 * 페이지(MAIN world)에서 reCAPTCHA v3 토큰을 받아 온다 — features/preview/grecaptcha.ts가 필요할 때만 injectScript로 넣는다.
 * 받을 값은 script.dataset(siteKey, action)으로 오고, 결과는 같은 요소에 "refresher:grecaptcha" 이벤트(detail: 토큰, 실패면 "")로 돌려준다.
 * api.js는 이때 처음 불러온다 — 미리 넣으면 원문 comment.js의 typeof grecaptcha 검사가 바뀌어 v2 체크박스가 뜬다
 */
type Grecaptcha = { ready: (callback: () => void) => void; execute: (key: string, options: { action: string }) => Promise<string> };

export default defineUnlistedScript(async () => {
    // await 전에 잡아야 한다 — 비동기 뒤에는 currentScript가 null이다
    const script = document.currentScript as HTMLScriptElement;
    const {siteKey = "", action = ""} = script.dataset;
    const respond = (token = ""): boolean => script.dispatchEvent(new CustomEvent("refresher:grecaptcha", {detail: token}));

    try {
        const scope = window as Window & { grecaptcha?: Grecaptcha };
        if (!scope.grecaptcha) {
            await new Promise<void>((resolve, reject) => {
                const api = document.createElement("script");
                api.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
                api.onload = () => resolve();
                api.onerror = () => reject(new Error("api.js"));
                document.head.append(api);
            });
        }

        const grecaptcha = scope.grecaptcha!;
        await new Promise<void>((resolve) => grecaptcha.ready(resolve));
        respond(await grecaptcha.execute(siteKey, {action}));
    } catch {
        respond();
    }
});
