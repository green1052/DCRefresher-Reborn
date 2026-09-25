import {defineConfig} from "wxt";

export default defineConfig({
    modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
    react: {
        vite: {
            compiler: true
        }
    },
    dev: {
        reloadCommand: "Alt+Shift+R"
    },
    manifest: {
        name: "DCRefresher Reborn",
        description: "디시인사이드 개선 확장 프로그램",
        minimum_chrome_version: "140",
        permissions: ["alarms", "contextMenus", "storage", "unlimitedStorage", "clipboardWrite"],
        host_permissions: ["https://*.dcinside.com/*"],
        // reCAPTCHA 토큰용 — 콘텐츠 스크립트가 필요할 때만 페이지에 넣는다 (features/preview/grecaptcha.ts)
        web_accessible_resources: [{resources: ["grecaptcha.js"], matches: ["https://*.dcinside.com/*"]}],
        commands: {
            refreshLists: {
                suggested_key: {
                    default: "Alt+R"
                },
                description: "글 목록 새로고침: 새로고침"
            },
            refreshPause: {
                suggested_key: {
                    default: "Alt+S"
                },
                description: "글 목록 새로고침: 일시 비활성화"
            },
            stealthPause: {
                suggested_key: {
                    default: "Alt+P"
                },
                description: "스텔스 모드: 일시 비활성화"
            }
        },
        browser_specific_settings: {
            gecko: {
                id: "dcrefresher-reborn@green1052",
                strict_min_version: "140.0",
                data_collection_permissions: {
                    required: ["none"]
                }
            }
        }
    }
});
