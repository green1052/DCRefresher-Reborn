import {defineConfig} from "wxt";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "./core/pages";

export default defineConfig({
    modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
    react: {
        vite: {
            compiler: true
        }
    },
    vite: () => ({
        build: {
            cssTarget: ["chrome140", "firefox140"]
        }
        // Radix CSS에서 엔트리마다 쓰지 않는 규칙을 빼는 일은 modules/slim-radix-css.ts가 한다
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
        minimum_chrome_version: "140",
        browser_specific_settings: {
            gecko: {
                id: "dcrefresher-reborn@green1052",
                strict_min_version: "140.0",
                data_collection_permissions: {
                    required: ["none"]
                }
            }
        },
        permissions: ["alarms", "contextMenus", "storage", "scripting", "unlimitedStorage"],
        host_permissions: ["https://*.dcinside.com/*"],
        // 디시 페이지에 입히는 CSS (entrypoints/page.content.scss). 콘텐츠 스크립트의 CSS는 오버레이 shadow에만 들어가므로 따로 넣는다
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
