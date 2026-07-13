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

        const getGrecaptcha = (): GrecaptchaRuntime | null => {
            const scope = window as Window & { grecaptcha?: GrecaptchaRuntime };
            return scope.grecaptcha ?? null;
        };

        const script = document.createElement("script");
        script.src = "https://www.google.com/recaptcha/api.js?render=6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";
        script.async = true;
        script.onload = () => {
            window.addEventListener("message", (event) => {
                if (
                    event.source !== window ||
                    !event.data ||
                    event.data.type !== "refresherGrecaptcha" ||
                    typeof event.data.action !== "string"
                ) {
                    return;
                }

                const grecaptcha = getGrecaptcha();
                if (!grecaptcha) return;

                grecaptcha.ready(() => {
                    void (async () => {
                        try {
                            const token = await grecaptcha.execute(grecaptchaSiteKey, {
                                action: event.data.action
                            });

                            window.postMessage({type: "refresherGrecaptchaToken", token}, "*");
                        } catch (error) {
                            console.error("Failed to execute reCAPTCHA:", error);
                        }
                    })();
                });
            });
        };
        document.head.appendChild(script);
    }
});