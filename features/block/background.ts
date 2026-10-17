import {storage} from "wxt/utils/storage";

import {type ImageHashes, onMessage, sendMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule} from "@/core/module/background";
import {IMAGE_HOST_ORIGINS, IMAGE_URL_PATTERNS} from "@/core/pages";
import {blockListKey} from "@/core/storage/items";
import {sha256} from "@/utils/hash";
import {imageFingerprints} from "@/utils/imageFingerprint";
import {isWholeMp4} from "@/utils/mp4";
import {isRecord} from "@/utils/record";

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

/**
 * 파이어폭스: 이미지 주소 → 페이지가 받은 파일의 해시 (받는 중이면 끝날 때 풀린다). 파일 해시(file)는 지문보다 먼저 풀린다.
 * done은 다 구한 결과다. 본문 이미지 주소의 파일은 바뀌지 않으므로 다시 받을 때 또 구하지 않는다.
 */
interface HashEntry {
    /** 이 항목을 만든 요청. 그 요청이 실패하면 항목을 지운다 (dropFailed). */
    requestId: string;
    file: Promise<string | undefined>;
    hashes: Promise<ImageHashes | undefined>;
    done?: ImageHashes;
}

const imageHashes = new Map<string, HashEntry>();
/**
 * 파이어폭스: 비슷한 이미지 지문도 구할지. 디코딩이 해시보다 훨씬 무거워 그 설정이 켜져 있고 지문이 있는 항목이 있을 때만 구한다.
 * 페이지 쪽 캔버스는 지문 방지 설정이 켜지면 잡음이 섞이지만 배경은 섞이지 않는다.
 */
let similarSetting = false;
let similarEnabled = false;

// 지문을 기다리는 동안 받은 바이트를 쥐지 않게 해시는 Promise로 받는다 (매개변수는 함수가 끝날 때까지 남는다).
const hashFile = async (file: Blob, hashing: Promise<string>, onFile: (hash: string) => void): Promise<ImageHashes> => {
    const hash = await hashing;
    onFile(hash);
    return {file: hash, similar: similarEnabled ? (await imageFingerprints(file)) ?? null : undefined};
};
// 오래된 것부터 버린다. 버린 이미지를 같은 탭이 메모리 캐시로 다시 쓰면 탭이 한 번 더 받는다 (core/block.ts의 imageHash).
const MAX_IMAGE_HASHES = 500;

/**
 * 파이어폭스: 페이지가 받는 본문 이미지·움짤(mp4, 요청 유형 media)을 그대로 흘려보내며 해시를 구해 둔다. 디스크 캐시에서 온 응답도 지나간다.
 * 같은 탭이 메모리 캐시를 다시 쓰면 요청이 없어 지나가지 않으므로 해시를 주소별로 남겨 두고 탭이 물어 간다 (refresher:imageHash).
 */
const hashImageResponse = ({requestId, url, type}: Browser.webRequest.OnBeforeRequestDetails): undefined => {
    const previous = imageHashes.get(url);
    imageHashes.delete(url);
    // 필요한 것(지문은 similarEnabled일 때)을 다 구해 두었으면 응답을 엿보지 않고 오래된 순서만 바꾼다.
    if (previous?.done && (!similarEnabled || previous.done.similar !== undefined)) {
        imageHashes.set(url, previous);
        return undefined;
    }

    const filter = browser.webRequest.filterResponseData(requestId);
    const chunks: ArrayBuffer[] = [];
    const file = Promise.withResolvers<string | undefined>();
    const hashes = Promise.withResolvers<ImageHashes | undefined>();
    const entry: HashEntry = {requestId, file: file.promise, hashes: hashes.promise};
    const resolve = (done: Promise<ImageHashes | undefined>): void => {
        hashes.resolve(done);
        // 파일 해시를 먼저 알리지 못했으면(앞서 구한 것을 쓰는 등) 다 끝난 것으로 푼다. 먼저 푼 값이 남는다.
        void done.then((result) => {
            file.resolve(result?.file);
            entry.done = result;
        }, () => file.resolve(undefined));
    };

    imageHashes.set(url, entry);
    if (imageHashes.size > MAX_IMAGE_HASHES) imageHashes.delete(imageHashes.keys().next().value ?? url);

    filter.ondata = (ev) => {
        chunks.push(ev.data);
        filter.write(ev.data);
    };
    filter.onstop = () => {
        filter.close();
        // 캐시를 재검증해 304를 받으면 본문 없이 끝나고, 움짤은 구간 요청으로 파일 일부만 지나가기도 한다.
        // 그런 것의 해시를 남기지 않고 앞서 구한 것을 쓴다 (없으면 탭이 직접 읽는다).
        const blob = new Blob(chunks);
        // Blob이 사본을 가진다. done.then 콜백이 이 범위를 지문이 끝날 때까지 붙잡으므로 조각은 바로 놓는다.
        chunks.length = 0;
        resolve(blob.arrayBuffer().then((bytes) =>
            bytes.byteLength === 0 || (type === "media" && !isWholeMp4(new Uint8Array(bytes))) ? previous?.hashes : hashFile(blob, sha256(bytes), file.resolve)));
    };
    filter.onerror = () => resolve(Promise.resolve(previous?.hashes));
    return undefined;
};

/**
 * 파이어폭스: 중간에 끊긴 요청도 받은 만큼으로 stop이 와 잘린 파일의 해시가 남는다. 그 요청이 만든 항목이면 지워 다음 요청이 다시 구하게 한다.
 * 같은 주소에 늦게 온 다른 요청의 항목은 남긴다.
 */
const dropFailed = ({requestId, url}: Browser.webRequest.OnErrorOccurredDetails): void => {
    if (imageHashes.get(url)?.requestId === requestId) imageHashes.delete(url);
};

/** 파이어폭스: 모듈이 켜져 있고 차단한 이미지가 있을 때만 응답을 엿본다. 없으면 페이지가 해시를 묻지 않는다 (core/block.ts의 isImageBlocked). */
let filterEnabled = false;
const IMAGE_LIST_KEY = blockListKey("IMAGE");

const syncImageFilter = async (): Promise<void> => {
    // stores/blocks는 배경에 Preact를 딸려 보내므로 불러오지 않는다. 검사 없이 BlockEntry[]로 읽으면 깨진 항목 하나에 필터를 맞추지 못한다.
    const stored = await storage.getItem<unknown>(IMAGE_LIST_KEY);
    const entries = Array.isArray(stored) ? stored.filter(isRecord) : [];
    const on = filterEnabled && entries.length > 0;
    similarEnabled = similarSetting && entries.some((entry) => typeof entry.similar === "string");
    if (on === browser.webRequest.onBeforeRequest.hasListener(hashImageResponse)) return;
    const filter: Browser.webRequest.RequestFilter = {urls: IMAGE_URL_PATTERNS, types: ["image", "media"]};
    if (on) {
        browser.webRequest.onBeforeRequest.addListener(hashImageResponse, filter, ["blocking"]);
        browser.webRequest.onErrorOccurred.addListener(dropFailed, filter);
    } else {
        browser.webRequest.onBeforeRequest.removeListener(hashImageResponse);
        browser.webRequest.onErrorOccurred.removeListener(dropFailed);
    }
};

/** 우클릭한 이미지·움짤(<video>)을 차단한다. 해시는 그 탭이 구한다 (stores/blockRequest.ts의 blockImage). */
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
            onMessage("refresher:imageHash", ({data: {url, similar}}) => {
                const known = imageHashes.get(url);
                return similar ? known?.hashes : known?.file.then((file) => (file ? {file} : undefined));
            });
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

        if (enabled) browser.contextMenus.create({id: IMAGE_MENU, title: "이 이미지 차단", contexts: ["image", "video"], targetUrlPatterns: IMAGE_URL_PATTERNS, documentUrlPatterns: BOARD_PATTERNS});
    }
});
