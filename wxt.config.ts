import {defineConfig} from "wxt";

export default defineConfig({
    modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
    react: {
        vite: {
            compiler: true
        }
    },
    vite: () => ({
        css: {
            postcss: {
                plugins: [
                    /**
                     * 오버레이(콘텐츠 스크립트 shadow)에 넣는 Radix CSS만 줄인다 — 옵션·팝업의 styles.css는 그대로.
                     * - min-width 미디어 블록: 반응형 prop용인데 오버레이는 쓰지 않는다 (CSS의 절반). 오버레이에 {initial, md} 같은 prop을 쓰면 initial로 고정된다
                     * - U+200D content: DataList 정렬용 한 글자 때문에 CSS 문자열 전체가 2바이트로 저장된다 (오버레이는 DataList를 안 쓴다)
                     * Radix를 올리면 다시 확인한다
                     */
                    {
                        postcssPlugin: "slim-overlay-radix",
                        Once(root, {result}) {
                            if (!result.opts.from?.endsWith("themes/styles.css?inline")) return;

                            root.walkAtRules("media", (rule) => {
                                if (rule.params.includes("min-width")) rule.remove();
                            });
                            root.walkDecls("content", (decl) => {
                                if (decl.value.includes("\u200d")) decl.remove();
                            });
                        }
                    }
                ]
            }
        }
    }),
    dev: {
        reloadCommand: "Alt+Shift+R"
    },
    manifest: ({browser}) => ({
        name: "DCRefresher Reborn",
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
