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
    manifest: ({browser}) => ({
        name: "DCRefresher Reborn",
        description: "디시인사이드 개선 확장 프로그램",
        ...(browser === "firefox"
            ? {
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
            : {minimum_chrome_version: "140"}),
        permissions: ["alarms", "contextMenus", "storage", "scripting", "unlimitedStorage"],
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
            },
            // 크롬은 기본 키를 4개까지만 줄 수 있다 — 비워 두고 사용자가 지정한다
            blockReveal: {
                description: "컨텐츠 차단: 이 페이지에서 가린 내용 보기"
            }
        }
    })
});
