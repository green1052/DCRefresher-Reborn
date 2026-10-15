import {onMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule, hasTab, runFileInPage} from "@/core/module/background";

/** 글쓰기: 탭이 요청하면 그 페이지(MAIN world)에 올리는 이미지를 바꾸는 리스너(entrypoints/upload-hook.ts)를 넣는다. */
export default defineBackgroundModule({
    // meta.ts는 아이콘(lucide·Preact)을 불러오므로 id만 같게 적는다.
    id: "write",

    listen() {
        onMessage("refresher:hookUploads", async ({sender}) => {
            if (!hasTab(sender)) return;

            await runFileInPage(sender, "/upload-hook.js").catch(console.error);
        });
    }
});
