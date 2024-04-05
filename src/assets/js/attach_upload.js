window.addEventListener("message", (event) => {
    if (event.data.type === "attach_upload" && event.data.data) {
        window.Editor.getSidebar().getAttacher("image", this).attachHandler(event.data.data);
    }
});