export const writeClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
    }
};

export default {writeClipboard};