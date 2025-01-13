import {runtime} from "webextension-polyfill";

export const inject = (filename: string) => {
    document.addEventListener("DOMContentLoaded", () => {
        const scriptElement = document.createElement("script");
        scriptElement.src = runtime.getURL(filename);
        document.body.appendChild(scriptElement);
    });
};