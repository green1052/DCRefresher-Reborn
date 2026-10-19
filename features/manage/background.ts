import {http} from "@/core/http/client";
import {postSearchUrl} from "@/core/http/urls";
import {onMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule} from "@/core/module/background";

import meta from "./meta";

/** 관리: 같은 제목 글 찾기의 통합검색. CORS를 열지 않아 콘텐츠 스크립트가 직접 받지 못하므로 배경이 대신 받는다. */
export default defineBackgroundModule(meta, {
    listen() {
        onMessage("refresher:searchPosts", ({data: query}) => http.get(postSearchUrl(query)).text());
    }
});
