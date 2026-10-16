import {storage} from "wxt/utils/storage";

import {type ImageHashes, onMessage, sendMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule} from "@/core/module/background";
import {IMAGE_HOST_ORIGINS, IMAGE_URL_PATTERNS} from "@/core/pages";
import {blockListKey} from "@/core/storage/items";
import type {BlockEntry} from "@/core/storage/types";
import {sha256} from "@/utils/hash";
import {imageFingerprints} from "@/utils/imageFingerprint";

import {BLOCK_SETTINGS} from "./settings";

const IMAGE_MENU = "block:image";

/** 메뉴를 띄울 페이지: 차단 모듈이 돌아 메시지를 받는 글 목록·본문 (meta.ts의 BOARD_PAGE). 원본 보기 창·이미지만 연 탭에는 받을 쪽이 없다. */
const BOARD_PATTERNS = ["https://gall.dcinside.com/*board/view/*", "https://gall.dcinside.com/*board/lists/*"];

/**
 * 크롬: 디시 탭의 콘텐츠 스크립트가 본문 이미지를 읽을 수 있게 그 요청(xmlhttprequest)의 응답에만 CORS 헤더를 붙인다.
 * 페이지의 <img> 요청은 건드리지 않는다. 콘텐츠 스크립트의 요청은 페이지와 같은 캐시를 써서 이미지를 다시 받지 않는다 (core/block.ts의 imageHash).
 * 이미지 호스트 권한이 없으면 크롬이 규칙을 건너뛴다.
 */
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

/** 파이어폭스: 이미지 주소 → 페이지가 받은 파일의 해시 (받는 중이면 끝날 때 풀린다). */
const imageHashes = new Map<string, Promise<ImageHashes | undefined>>();
/**
 * 파이어폭스: 비슷한 이미지 지문도 구할지. 디코딩이 해시보다 훨씬 무거워 그 설정이 켜져 있고 지문이 있는 항목이 있을 때만 구한다.
 * 페이지 쪽 캔버스는 지문 방지 설정이 켜지면 잡음이 섞이지만 배경은 섞이지 않는다.
 */
let similarSetting = false;
let similarEnabled = false;

const hashFile = async (file: Blob): Promise<ImageHashes> => ({
    file: await sha256(await file.arrayBuffer()),
    similar: similarEnabled ? (await imageFingerprints(file)) ?? null : undefined
});
// 오래된 것부터 버린다. 버린 이미지를 같은 탭이 메모리 캐시로 다시 쓰면 탭이 한 번 더 받는다 (core/block.ts의 imageHash).
const MAX_IMAGE_HASHES = 500;

/**
 * 파이어폭스: 페이지가 받는 본문 이미지를 그대로 흘려보내며 해시를 구해 둔다. 디스크 캐시에서 온 응답도 지나간다.
 * 같은 탭이 메모리 캐시를 다시 쓰면 요청이 없어 지나가지 않으므로 해시를 주소별로 남겨 두고 탭이 물어 간다 (refresher:imageHash).
 */
const hashImageResponse = ({requestId, url}: Browser.webRequest.OnBeforeRequestDetails): undefined => {
    const filter = browser.webRequest.filterResponseData(requestId);
    const chunks: ArrayBuffer[] = [];
    const {promise, resolve} = Promise.withResolvers<ImageHashes | undefined>();
    const previous = imageHashes.get(url);

    imageHashes.delete(url);
    imageHashes.set(url, promise);
    if (imageHashes.size > MAX_IMAGE_HASHES) imageHashes.delete(imageHashes.keys().next().value ?? url);

    filter.ondata = (ev) => {
        chunks.push(ev.data);
        filter.write(ev.data);
    };
    filter.onstop = () => {
        filter.close();
        // 캐시를 재검증해 304를 받으면 본문 없이 끝난다. 빈 데이터의 해시를 남기지 않고 앞서 구한 것을 쓴다 (없으면 탭이 직접 읽는다).
        resolve(chunks.length > 0 ? hashFile(new Blob(chunks)) : previous);
    };
    filter.onerror = () => resolve(undefined);
    return undefined;
};

/** 파이어폭스: 모듈이 켜져 있고 차단한 이미지가 있을 때만 응답을 엿본다. 없으면 페이지가 해시를 묻지 않는다 (core/block.ts의 isImageBlocked). */
let filterEnabled = false;
const IMAGE_LIST_KEY = blockListKey("IMAGE");

const syncImageFilter = async (): Promise<void> => {
    const entries = await storage.getItem<BlockEntry[]>(IMAGE_LIST_KEY, {fallback: []});
    const on = filterEnabled && entries.length > 0;
    similarEnabled = similarSetting && entries.some((entry) => entry.similar);
    if (on === browser.webRequest.onBeforeRequest.hasListener(hashImageResponse)) return;
    if (on) browser.webRequest.onBeforeRequest.addListener(hashImageResponse, {urls: IMAGE_URL_PATTERNS, types: ["image"]}, ["blocking"]);
    else browser.webRequest.onBeforeRequest.removeListener(hashImageResponse);
};

/** 우클릭한 이미지를 차단한다. 해시는 그 탭이 구한다 (stores/blockRequest.ts의 blockImage). */
export default defineBackgroundModule({
    id: "block",
    settings: BLOCK_SETTINGS,

    listen() {
        browser.contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId !== IMAGE_MENU || !info.srcUrl || tab?.id === undefined || tab.id < 0) return;

            const url = info.srcUrl;
            const target = {tabId: tab.id, frameId: info.frameId};
            // 권한 요청은 사용자 동작 안에서만 된다. 기다리기 전에 바로 부른다. 이미 있으면 묻지 않고 true다.
            browser.permissions.request({origins: IMAGE_HOST_ORIGINS})
                .then((granted) => (granted ? sendMessage("refresher:blockImage", url, target) : undefined))
                .catch(console.error);
        });

        if (import.meta.env.BROWSER === "firefox") {
            onMessage("refresher:imageHash", ({data: url}) => imageHashes.get(url));
            storage.watch(IMAGE_LIST_KEY, () => void syncImageFilter().catch(console.error));
        }
    },

    async apply({enabled, settings}) {
        // removeAll은 다른 모듈의 메뉴까지 지운다.
        await browser.contextMenus.remove(IMAGE_MENU).catch(() => {});

        if (import.meta.env.BROWSER === "firefox") {
            filterEnabled = enabled;
            similarSetting = settings.similarImages === true;
            await syncImageFilter();
        } else {
            await browser.declarativeNetRequest.updateSessionRules({removeRuleIds: [CORS_RULE.id], addRules: enabled ? [CORS_RULE] : []});
        }

        if (enabled) browser.contextMenus.create({id: IMAGE_MENU, title: "이 이미지 차단", contexts: ["image"], targetUrlPatterns: IMAGE_URL_PATTERNS, documentUrlPatterns: BOARD_PATTERNS});
    }
});
