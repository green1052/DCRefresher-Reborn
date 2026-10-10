import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import {defineConfig} from "wxt";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "./core/pages";

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
        excludeSources: ["test-results/**", "playwright-report/**", "db/**"]
    },
    dev: {
        reloadCommand: "Alt+Shift+R"
    },
    manifest: {
        name: "DCRefresher Reborn",
        // 코드가 쓰는 API 중 가장 늦게 들어온 것에 맞춘다 (빌드가 바꿔 주지 않는다).
        // Chrome 140: Uint8Array의 toBase64·fromBase64(백업·IP DB). Firefox 144: storage.local.getBytesInUse(정보 탭), getKeys(143).
        minimum_chrome_version: "140",
        browser_specific_settings: {
            gecko: {
                id: "dcrefresher-reborn@green1052",
                strict_min_version: "144.0",
                data_collection_permissions: {
                    required: ["none"]
                }
            }
        },
        permissions: ["alarms", "contextMenus", "storage", "scripting", "unlimitedStorage"],
        host_permissions: ["https://*.dcinside.com/*"],
        content_scripts: [
            {
                matches: CONTENT_MATCHES,
                exclude_matches: CONTENT_EXCLUDE_MATCHES,
                css: ["content-scripts/page.css"],
                run_at: "document_start"
            }
        ]
    }
});
