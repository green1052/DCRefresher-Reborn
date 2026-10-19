import {defineBackgroundModule} from "@/core/module/background";
import {IMAGE_URL_PATTERNS} from "@/core/pages";
import {arrayIncludes} from "@/utils/typed";

import meta, {ENGINE_IDS, ENGINES} from "./meta";

const MENU_PREFIX = "imagesearch:";

/** 우클릭한 이미지를 engine으로 검색할 주소. 디시 본문 이미지가 아니면 null이다. */
const imageSearchUrl = (engine: string, src: string): string | null => {
    if (!arrayIncludes(ENGINE_IDS, engine) || !src.includes("viewimage.php")) return null;

    // 디시콘 주소(image.dcinside.com/dccon.php)로 바꾼다. 호스트·경로만 바꾸고 쿼리는 그대로 둔다.
    const url = new URL(src);
    url.host = "image.dcinside.com";
    url.pathname = "/dccon.php";

    return ENGINES[engine].url + encodeURIComponent(url.toString());
};

/** 켠 엔진마다 이미지 우클릭 메뉴를 하나씩 만든다. 이 확장의 메뉴가 둘 이상이면(block의 "이 이미지 차단" 포함) 브라우저가 확장 이름 아래로 묶는다. */
export default defineBackgroundModule(meta, {
    listen() {
        browser.contextMenus.onClicked.addListener(async (info, tab) => {
            const id = String(info.menuItemId);
            const url = id.startsWith(MENU_PREFIX) && info.srcUrl ? imageSearchUrl(id.slice(MENU_PREFIX.length), info.srcUrl) : null;
            if (!url) return;

            await browser.tabs.create(tab?.id !== undefined && tab.id >= 0 ? {url, index: tab.index + 1, openerTabId: tab.id, windowId: tab.windowId} : {url});
        });
    },

    async apply({enabled, settings}) {
        // removeAll은 다른 모듈의 메뉴까지 지우므로 이 모듈의 메뉴만 지운다.
        // 크롬은 워커가 다시 떠도 메뉴를 남겨 두므로 첫 apply에도 지울 것이 있다.
        await Promise.all(ENGINE_IDS.map((engine) => browser.contextMenus.remove(MENU_PREFIX + engine).catch(() => {})));
        if (!enabled) return;

        for (const engine of ENGINE_IDS) {
            if (!settings[engine]) continue;
            browser.contextMenus.create({id: MENU_PREFIX + engine, title: `${ENGINES[engine].name} 검색`, contexts: ["image"], targetUrlPatterns: IMAGE_URL_PATTERNS});
        }
    }
});
