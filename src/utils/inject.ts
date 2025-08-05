import getURL from "./getURL";

export const injectScript = (
    filename: string,
    options?: {
        defer?: boolean;
        async?: boolean;
        onLoad?: () => void;
        onError?: (error: Event) => void;
    }
): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!filename) {
            reject(new Error("Filename is required"));
            return;
        }

        const injectScriptElement = () => {
            try {
                const scriptElement = document.createElement("script");
                scriptElement.src = getURL(filename);

                if (options?.defer) scriptElement.defer = true;
                if (options?.async) scriptElement.async = true;

                scriptElement.onload = () => {
                    options?.onLoad?.();
                    resolve();
                };

                scriptElement.onerror = (error) => {
                    options?.onError?.(error);
                    reject(new Error(`Failed to load script: ${filename}`));
                };

                (document.body || document.head || document.documentElement).appendChild(scriptElement);
            } catch (error) {
                reject(error);
            }
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", injectScriptElement, { once: true });
        } else {
            injectScriptElement();
        }
    });
};

export default injectScript;
