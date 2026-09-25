import {defineConfig} from "wxt";

export default defineConfig({
    modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
    react: {
        vite: {
            compiler: true
        }
    },
    // WXT 기본 리로드 단축키(Alt+R)가 refreshLists와 겹쳐 dev에서 둘 중 하나가 먹통이 된다
    dev: {
        reloadCommand: "Alt+Shift+R"
    },
    manifest: {
        name: "DCRefresher Reborn",
        description: "디시인사이드 개선 확장 프로그램",
        minimum_chrome_version: "140",
        // "tabs"는 쓰는 곳이 없다(탭 url 조회도 host_permissions로 된다) — 넣으면 설치 경고에 방문 기록 읽기가 붙는다
        permissions: ["alarms", "contextMenus", "storage", "scripting", "unlimitedStorage", "clipboardWrite"],
        host_permissions: ["https://*.dcinside.com/*"],
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
