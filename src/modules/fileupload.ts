export default {
    name: "이미지 업로드 개선",
    description: "(작동 안함) 게시글 작성 중 붙여넣기로 이미지 업로드를 가능하게 해줍니다.",
    author: {name: "green1052"},
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/write/,
    require: ["filter", "http"],
    memory: {
        canvas: ""
    },
    enable: false,
    default_enable: false,
    func(filter: RefresherFilter, http: RefresherHTTP) {
        // this.memory.canvas = filter.add("#tx_canvas_wysiwyg", (element) => {
        //     // TODO: 드래그 드랍 지원
        //
        //     const iframe = (element as HTMLIFrameElement).contentWindow?.document;
        //     const contentContainer = iframe?.querySelector(".tx-content-container");
        //
        //     contentContainer?.addEventListener("paste", async (ev) => {
        //         const data = (ev as ClipboardEvent).clipboardData;
        //
        //         if (!data) return;
        //
        //         let file = data.files[0];
        //
        //         if (!file) return;
        //
        //         ev.stopPropagation();
        //         ev.preventDefault();
        //
        //         file = new File([file], `${new Date().getTime()}-${file.name}`, {type: file.type});
        //
        //         const r_key = (document.querySelector("#r_key") as HTMLInputElement).value;
        //         const gall_id = (document.querySelector("#id") as HTMLInputElement).value;
        //         const gall_no = (document.querySelector("#gallery_no") as HTMLInputElement).value;
        //         const _GALLTYPE_ = (document.querySelector("#_GALLTYPE_") as HTMLInputElement).value;
        //
        //         const form = new FormData();
        //         form.append("r_key", r_key);
        //         form.append("gall_id", gall_id);
        //         form.append("gall_no", gall_no);
        //         form.append("post_no", (document.querySelector("#no") as HTMLInputElement)?.value ?? "");
        //         form.append("upload_ing", "N");
        //         form.append("_GALLTYPE_", _GALLTYPE_);
        //         form.append("files", file);
        //
        //         const response = JSON.parse(await http.make(`https://upimg.dcinside.com/upimg_file.php?id=${gall_id}&r_key=${r_key}`, {
        //             method: "POST",
        //             cache: "no-store",
        //             referrer: location.href,
        //             body: form
        //         })).files[0];
        //
        //         const upload = {
        //             imageurl: response.url,
        //             filename: file.name,
        //             filesize: response.size,
        //             imagealign: "L",
        //             originalurl: response._s_url,
        //             thumburl: response._s2_url,
        //             file_temp_no: response.file_temp_no,
        //             mp4: ""
        //         };
        //
        //         // TODO 맨 위에 사진 올라가는거 고치기
        //         const script = document.createElement("script");
        //         script.textContent = `Editor.sidebar.getAttacher().image.execAttach(${JSON.stringify(upload)});`;
        //         document.head.appendChild(script);
        //         script.remove();
        //     });
        // });
    },
    revoke(filter: RefresherFilter) {
        // if (this.memory.canvas)
        //     filter.remove(this.memory.canvas);
        //
        // // TODO: 이벤트 리스너 빼기
    }
} as RefresherModule;