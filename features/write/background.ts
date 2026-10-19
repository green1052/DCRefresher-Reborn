import {onMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule, hasTab, runFileInPage} from "@/core/module/background";

import meta from "./meta";

/** 글쓰기: 탭이 요청하면 그 페이지(MAIN world)에 올리는 이미지를 바꾸는 리스너(entrypoints/upload-hook.ts)를 넣는다. */
export default defineBackgroundModule(meta, {
    listen() {
        onMessage("refresher:hookUploads", async ({sender}) => {
            if (!hasTab(sender)) return;

            await runFileInPage(sender, "/upload-hook.js").catch(console.error);
        });
    }
});
