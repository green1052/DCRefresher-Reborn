export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*",
        "https://gallog.dcinside.com/*"
    ],
    world: "MAIN",
    runAt: "document_end",
    main() {
        const grecaptchaSiteKey = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";

        interface GrecaptchaRuntime {
            ready: (callback: () => void) => void;
            execute: (siteKey: string, options: { action: string }) => Promise<string>;
        }

        const scope = window as Window & { grecaptcha?: GrecaptchaRuntime };

        // api.js를 미리 넣으면 원문 comment.js/dccon.js의 typeof grecaptcha 검사가 바뀌어 v3 대신 v2 체크박스가 뜬다.
        // 서버가 'false||captcha||v3'를 돌려줘 토큰 요청이 처음 왔을 때만 불러온다 (디시 $.getScript와 같음)
        let loading: Promise<GrecaptchaRuntime> | undefined;

        const loadGrecaptcha = (): Promise<GrecaptchaRuntime> => {
            loading ??= new Promise<GrecaptchaRuntime>((resolve, reject) => {
                if (scope.grecaptcha) {
                    resolve(scope.grecaptcha);
                    return;
                }

                const script = document.createElement("script");
                script.src = `https://www.google.com/recaptcha/api.js?render=${grecaptchaSiteKey}`;
                script.async = true;
                script.onload = () => (scope.grecaptcha ? resolve(scope.grecaptcha) : reject(new Error("grecaptcha가 없습니다.")));
                script.onerror = () => reject(new Error("api.js를 불러오지 못했습니다."));
                document.head.appendChild(script);
            }).catch((error: unknown) => {
                loading = undefined;
                throw error;
            });

            return loading;
        };

        window.addEventListener("message", (event) => {
            if (
                event.source !== window ||
                !event.data ||
                event.data.type !== "refresherGrecaptcha" ||
                typeof event.data.action !== "string"
            ) {
                return;
            }

            void (async () => {
                try {
                    const grecaptcha = await loadGrecaptcha();
                    await new Promise<void>((resolve) => grecaptcha.ready(resolve));

                    const token = await grecaptcha.execute(grecaptchaSiteKey, {
                        action: event.data.action
                    });

                    window.postMessage({type: "refresherGrecaptchaToken", token}, "*");
                } catch (error) {
                    console.error("Failed to execute reCAPTCHA:", error);
                    // 기다리는 쪽이 타임아웃까지 붙잡히지 않게 빈 응답
                    window.postMessage({type: "refresherGrecaptchaToken"}, "*");
                }
            })();
        });
    }
});
