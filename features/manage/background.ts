import {http} from "@/core/http/client";
import {postSearchUrl} from "@/core/http/urls";
import {onMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule} from "@/core/module/background";

/** 관리: 같은 제목 글 찾기의 통합검색. CORS를 열지 않아 콘텐츠 스크립트가 직접 받지 못하므로 배경이 대신 받는다. */
export default defineBackgroundModule({
    // index.ts는 Preact 화면을 불러오므로 id만 같게 적는다.
    id: "manage",

    listen() {
        onMessage("refresher:searchPosts", ({data: query}) => http.get(postSearchUrl(query)).text());
    }
});
