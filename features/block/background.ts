import {sendMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule} from "@/core/module/background";
import {IMAGE_HOST_ORIGINS, IMAGE_URL_PATTERNS} from "@/core/pages";

import meta from "./meta";

const IMAGE_MENU = "block:image";

/** 메뉴를 띄울 페이지: 차단 모듈이 돌아 메시지를 받는 글 목록·본문 (meta.ts의 BOARD_PAGE). 원본 보기 창·이미지만 연 탭에는 받을 쪽이 없다. */
const BOARD_PATTERNS = ["https://gall.dcinside.com/*board/view/*", "https://gall.dcinside.com/*board/lists/*"];

    // Chrome: 콘텐츠 스크립트가 본문 이미지를 읽게 viewimage.php로 가는 fetch·XHR 응답에 CORS 헤더를 붙인다. 페이지와 같은 캐시를 써서 다시 받지 않는다 (core/block.ts의 imageHash).
    // declarativeNetRequest는 콘텐츠 스크립트와 페이지 스크립트의 요청을 가르지 못해 페이지도 이 헤더를 받는다(쿠키 없이 받는 공개 이미지다).
    // 이미지 호스트 권한(선택 권한인 *.dcinside.co.kr)이 없으면 크롬이 규칙을 건너뛴다.
    // 양 브라우어가 같은 규칙을 쓴다 (Firefox MV3도 declarativeNetRequest를 지원한다).
    const CORS_RULE: Browser.declarativeNetRequest.Rule = {
        id: 1,
        action: {
            type: "modifyHeaders",
            responseHeaders: [{header: "Access-Control-Allow-Origin", operation: "set", value: "https://gall.dcinside.com"}]
        },
        condition: {
            requestDomains: ["dcinside.co.kr", "dcinside.com"],
            urlFilter: "/viewimage.php",
            resourceTypes: ["xmlhttprequest"],
            initiatorDomains: ["gall.dcinside.com"]
        }
    };

/** 우클릭한 이미지·움짤(<video>)을 차단한다. 해시는 그 탭이 구한다 (stores/blockRequest.ts의 blockImage). */
export default defineBackgroundModule(meta, {
    listen() {
        browser.contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId !== IMAGE_MENU || !info.srcUrl || tab?.id === undefined || tab.id < 0) return;

            const url = info.srcUrl;
            const target = {tabId: tab.id, frameId: info.frameId};
            // 권한 요청은 사용자 동작 안에서만 된다. 기다리기 전에 바로 부른다. 이미 있으면 묻지 않고 true다.
            browser.permissions.request({origins: IMAGE_HOST_ORIGINS})
                .then((granted) => (granted ? sendMessage("refresher:blockImage", url, target).catch((e: unknown) => {
                    console.error(e);
                    // 받는 쪽이 없다: 설치·업데이트 전에 열린 탭(크롬은 콘텐츠 스크립트를 다시 넣지 않는다)이나 차단 모듈이 뜨지 않은 탭. blockImage는 자기 오류를 토스트로 알린다.
                    return browser.scripting.executeScript({
                        target: {tabId: target.tabId, frameIds: [target.frameId ?? 0]},
                        func: (text: string) => alert(text),
                        args: ["이 페이지에서는 지금 이미지를 차단할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."]
                    });
                }) : undefined))
                .catch(console.error);
        });
    },

    async apply({enabled}) {
        // removeAll은 다른 모듈의 메뉴까지 지운다.
        await browser.contextMenus.remove(IMAGE_MENU).catch(() => {});
        await browser.declarativeNetRequest.updateSessionRules({removeRuleIds: [CORS_RULE.id], addRules: enabled ? [CORS_RULE] : []});
        if (enabled) browser.contextMenus.create({id: IMAGE_MENU, title: "이 이미지 차단", contexts: ["image", "video"], targetUrlPatterns: IMAGE_URL_PATTERNS, documentUrlPatterns: BOARD_PATTERNS});
    }
});
