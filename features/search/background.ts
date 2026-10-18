import {isHTTPError} from "ky";

import {http} from "@/core/http/client";
import {onMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule} from "@/core/module/background";

/** 검색: 아이디로 작성자 글을 찾을 때 갤로그에서 닉네임을 읽는다. CORS를 열지 않아 콘텐츠 스크립트가 직접 받지 못하므로 배경이 대신 받는다. */
export default defineBackgroundModule({
    // index.ts는 콘텐츠 쪽 코드를 불러오므로 id만 같게 적는다.
    id: "search",

    listen() {
        // 없는 아이디는 갤로그가 404를 준다. 오류가 아니라 null로 돌려준다.
        onMessage("refresher:gallogPage", async ({data: id}) => {
            try {
                return await http.get(`https://gallog.dcinside.com/${encodeURIComponent(id)}`).text();
            } catch (e) {
                if (isHTTPError(e) && e.response.status === 404) return null;
                throw e;
            }
        });
    }
});
