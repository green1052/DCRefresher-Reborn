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
            document.execCommand("copy");
        } finally {
            document.body.removeChild(textArea);
        }
    }
};

export default {writeClipboard};