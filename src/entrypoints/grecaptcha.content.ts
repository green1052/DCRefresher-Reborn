export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*"
    ],
    world: "MAIN",
    runAt: "document_end",
    main() {
        // @ts-ignore
        $.getScript("https://www.google.com/recaptcha/api.js?render=6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI", () => {
            window.addEventListener("message", (event) => {
                if (event.data.type === "refresherGrecaptcha" && event.data.action) {
                    // @ts-ignore
                    grecaptcha.ready(async () => {
                        // @ts-ignore
                        const token = await grecaptcha.execute("6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI", {
                            action: event.data.action
                        });

                        window.postMessage({type: "refresherGrecaptchaToken", token}, "*");
                    });
                }
            });
        });
    }
});
