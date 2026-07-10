const legacyClipboardCopy = (text: string): void => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        if (!document.execCommand("copy")) {
            throw new Error("Clipboard copy command was rejected.");
        }
    } finally {
        document.body.removeChild(textArea);
    }
};

export const writeClipboard = async (text: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // fall through to legacy
        }
    }
    legacyClipboardCopy(text);
};

export default {writeClipboard};