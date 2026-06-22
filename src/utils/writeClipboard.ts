export const writeClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        try {
            textArea.focus();
            textArea.select();
            if (!document.execCommand("copy")) {
                throw new Error("Clipboard copy command was rejected.");
            }
        } finally {
            document.body.removeChild(textArea);
        }
    }
};

export default {writeClipboard};
