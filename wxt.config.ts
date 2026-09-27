import {defineConfig} from "wxt";

/** 오버레이가 쓰지 않는 Radix 컴포넌트 (클래스 접두어). 오버레이에서 새 컴포넌트를 쓰면 여기서 뺀다 — Select가 쓰는 ScrollArea 등 Base*는 남긴다 */
const UNUSED_OVERLAY_COMPONENT = new RegExp(
    "\\.rt-(DataList|Table|Tabs|TabNav|BaseTabList|Avatar|Progress|Code|Inset|CheckboxCards|CheckboxGroup|RadioCards|HoverCard|ContextMenu|DropdownMenu|BaseMenu|AlertDialog|ThemePanel|Container|Section)"
);

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
        },
        css: {
            postcss: {
                plugins: [
                    /**
                     * 오버레이(콘텐츠 스크립트 shadow)에 넣는 Radix CSS(radix-themes.css?inline)만 더 줄인다 — 옵션·팝업은 그대로. Radix를 올리면 다시 확인한다.
                     * - min-width 미디어 블록: 반응형 prop용인데 오버레이는 쓰지 않는다 (CSS의 절반). 오버레이에 {initial, md} 같은 prop을 쓰면 initial로 고정된다
                     * - U+200D content: DataList 정렬용 한 글자 때문에 CSS 문자열 전체가 2바이트로 저장된다 (오버레이는 DataList를 안 쓴다)
                     * - 오버레이가 쓰지 않는 컴포넌트의 규칙
                     * 쓰는 색만 가져오는 것은 radix-themes.css의 @import가 한다 (Radix가 색마다 나눠 둔 파일)
                     */
                    {
                        postcssPlugin: "slim-overlay-radix",
                        Once(root, {result}) {
                            if (!result.opts.from?.endsWith("styles/radix-themes.css?inline")) return;

                            root.walkAtRules("media", (rule) => {
                                if (rule.params.includes("min-width")) rule.remove();
                            });
                            root.walkDecls("content", (decl) => {
                                if (decl.value.includes("\u200d")) decl.remove();
                            });

                            // 여러 선택자 중 안 쓰는 컴포넌트 것만 떼고, 남는 게 없으면 규칙째 뺀다
                            root.walkRules((rule) => {
                                const selectors = rule.selectors.filter((selector) => !UNUSED_OVERLAY_COMPONENT.test(selector));
                                if (selectors.length === 0) rule.remove();
                                else if (selectors.length !== rule.selectors.length) rule.selectors = selectors;
                            });
                            root.walkAtRules((rule) => {
                                if (rule.nodes?.length === 0) rule.remove();
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
            blockReveal: {
                description: "컨텐츠 차단: 이 페이지에서 가린 내용 보기"
            }
        }
    }
});
