import getURL from "./getURL";

export default (filename: string) => {
    document.addEventListener("DOMContentLoaded", () => {
        const scriptElement = document.createElement("script");
        scriptElement.src = getURL(filename);
        document.body.appendChild(scriptElement);
    });
};
