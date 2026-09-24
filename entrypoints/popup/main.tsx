import "./popup.scss";

void (async () => {
    await browser.runtime.openOptionsPage();
    window.close();
})();