$.getScript("https://www.google.com/recaptcha/api.js?render=6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI", () => {
    window.addEventListener("message", (event) => {
        if (event.data.type === "refresherGrecaptcha" && event.data.action) {
            grecaptcha.ready(() => {
                grecaptcha.execute("6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI", {action: event.data.action}).then((token) => {
                    window.postMessage({type: "refresherGrecaptchaToken", token}, "*");
                });
            });
        }
    });
});