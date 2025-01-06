$.getScript("https://www.google.com/recaptcha/api.js?render=6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI", () => {
    window.addEventListener("message", (event) => {
        if (event.data.type === "refresherGrecaptcha" && event.data.action) {
            grecaptcha.ready(async () => {
                const token = await grecaptcha.execute("6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI", {action: event.data.action});
                window.postMessage({type: "refresherGrecaptchaToken", token}, "*");
            });
        }
    });
});