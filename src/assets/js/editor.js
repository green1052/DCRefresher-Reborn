window.addEventListener("message", (event) => {
    if (event.data.type === "refresherAttachUpload" && event.data.data)
        window.Editor.getSidebar().getAttacher("image", this).attachHandler(event.data.data);
});

window.addEventListener("DOMContentLoaded", () =>
    EditorJSLoader.ready(() => window.postMessage({type: "refresherEditorLoaded"}, "*"))
);