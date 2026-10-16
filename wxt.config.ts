import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import {defineConfig} from "wxt";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES, IMAGE_HOST_ORIGINS} from "./core/pages";

export default defineConfig({
    modules: ["@wxt-dev/auto-icons"],
    vite: () => ({
        plugins: [
            preact(),
            tailwindcss()
        ]
    }),
    hooks: {
        // 우리 코드는 components·utils를 직접 import한다. 자동 import 스캔은 제네릭 타입 인자(V 등)를 export로 잘못 읽어 경고만 낸다.
        // WXT API(defineContentScript·browser 등)의 자동 import는 그대로 둔다. imports.dirs는 기본값과 합쳐지므로 여기서 비운다.
        "config:resolved": (wxt) => {
            if (wxt.config.imports) wxt.config.imports.dirs = [];
        }
    },
    zip: {
        // 파이어폭스 심사용 소스 zip. 테스트 결과물과 DB 빌드 결과(.gitignore에 있는 것)는 소스가 아니라 뺀다.
        excludeSources: ["test-results/**", "playwright-report/**", "db/**", "stats.html"]
    },
    dev: {
        reloadCommand: "Alt+Shift+R"
    },
    manifest: ({browser}) => ({
        name: "DCRefresher Reborn",
        // 코드가 쓰는 API 중 가장 늦게 들어온 것에 맞춘다 (빌드가 바꿔 주지 않는다).
        // Chrome 140: Uint8Array의 toBase64·fromBase64(백업·IP DB). Firefox 144: storage.local.getBytesInUse(정보 탭), getKeys(143).
        // 다른 브라우저의 키는 알 수 없는 키라 manifest 경고로 남으므로 그 브라우저에만 넣는다.
        ...(browser === "firefox"
            ? {
                browser_specific_settings: {
                    gecko: {
                        id: "dcrefresher-reborn@green1052",
                        strict_min_version: "144.0",
                        data_collection_permissions: {
                            required: ["none"]
                        }
                    }
                }
            }
            : {minimum_chrome_version: "140"}),
        // 이미지 차단(features/block/background.ts)이 본문 이미지를 다시 받지 않고 읽는 데 쓴다. 크롬은 CORS 헤더를 붙이는 규칙,
        // 파이어폭스는 페이지가 받는 응답을 흘려보내며 읽는 필터다. 둘 다 설치·업데이트 때 묻지 않는 권한이다.
        permissions: ["alarms", "contextMenus", "storage", "scripting", "unlimitedStorage",
                      ...(browser === "firefox" ? ["webRequest", "webRequestBlocking"] : ["declarativeNetRequestWithHostAccess"])],
        host_permissions: ["https://*.dcinside.com/*"],
        // 본문 이미지 호스트. 이미지를 처음 차단할 때 묻는다 (core/pages.ts의 IMAGE_HOST_ORIGINS).
        // MV2(파이어폭스)는 optional_host_permissions가 없어 WXT가 지우므로 optional_permissions에 넣는다.
        optional_host_permissions: IMAGE_HOST_ORIGINS,
        ...(browser === "firefox" && {optional_permissions: IMAGE_HOST_ORIGINS}),
        content_scripts: [
            {
                matches: CONTENT_MATCHES,
                exclude_matches: CONTENT_EXCLUDE_MATCHES,
                css: ["content-scripts/page.css"],
                run_at: "document_start"
            }
        ]
    })
});
