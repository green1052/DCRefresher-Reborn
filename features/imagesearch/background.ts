import {defineBackgroundModule} from "@/core/module/background";

import {IMAGE_SEARCH_ENGINES, IMAGE_SEARCH_ID, IMAGE_SEARCH_SETTINGS, IMAGE_URL_PATTERNS, imageSearchUrl} from "./engines";

const MENU_PREFIX = "imagesearch:";

/** 이미지 우클릭 메뉴 — 켠 엔진마다 하나 (둘 이상이면 브라우저가 확장 이름 아래로 묶는다). 모듈이 꺼져 있으면 없다 */
export default defineBackgroundModule({
    id: IMAGE_SEARCH_ID,
    settings: IMAGE_SEARCH_SETTINGS,

    listen() {
        browser.contextMenus.onClicked.addListener(async (info, tab) => {
            const id = String(info.menuItemId);
            const url = id.startsWith(MENU_PREFIX) && info.srcUrl ? imageSearchUrl(id.slice(MENU_PREFIX.length), info.srcUrl) : null;
            if (!url) return;

            // 이미지가 있던 탭 바로 옆에, 그 탭을 opener로 연다
            await browser.tabs.create(tab?.id !== undefined && tab.id >= 0 ? {url, index: tab.index + 1, openerTabId: tab.id, windowId: tab.windowId} : {url});
        });
    },

    async apply({enabled, settings}) {
        // 이 모듈의 메뉴만 지운다 — removeAll은 다른 모듈의 메뉴까지 지운다. 크롬은 메뉴를 남겨 두니 워커가 새로 떠도 지울 것이 있다
        for (const engine of Object.keys(IMAGE_SEARCH_ENGINES)) {
            await browser.contextMenus.remove(MENU_PREFIX + engine).catch(() => {});
        }
        if (!enabled) return;

        for (const [engine, {name}] of Object.entries(IMAGE_SEARCH_ENGINES)) {
            if (settings[engine] !== true) continue;
            browser.contextMenus.create({id: MENU_PREFIX + engine, title: `${name} 검색`, contexts: ["image"], targetUrlPatterns: IMAGE_URL_PATTERNS});
        }
    }
});
