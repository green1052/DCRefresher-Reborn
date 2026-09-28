import {defineConfig} from "wxt";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "./core/pages";

/**
 * 오버레이가 쓰지 않는 Radix 컴포넌트(클래스 접두어). 오버레이에서 새 컴포넌트를 쓰게 되면 여기서 뺀다.
 * Select가 쓰는 ScrollArea 등 다른 컴포넌트가 의존하는 Base*는 남긴다.
 */
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
                     * 오버레이 shadow에 넣는 Radix CSS(overlay-radix.css)만 더 줄인다. 옵션·팝업용(radix-themes.css)은 그대로 둔다.
                     * Radix를 올리면 아래 가정이 여전히 맞는지 다시 확인한다.
                     * - min-width 미디어 블록 제거: 반응형 prop용으로 CSS의 절반을 차지한다.
                     *   오버레이에서 {initial, md} 같은 prop을 쓰면 initial 값으로 고정된다.
                     * - U+200D content 제거: DataList 정렬용 한 글자 때문에 CSS 문자열 전체가 2바이트 문자열로 저장된다.
                     * - 오버레이가 쓰지 않는 컴포넌트의 규칙 제거
                     * - @font-face 제거: 오버레이는 --default-font-family를 덮어쓰고 Code를 쓰지 않아 Radix 글꼴을 쓰지 않는다.
                     *   두면 WXT가 shadow에서 떼어 디시 페이지의 head에 넣는다
                     * :root → :host는 WXT가 shadow에 넣을 때 한다 (cssInjectionMode: "ui").
                     * 쓰는 색만 가져오는 일은 radix-themes.css의 @import가 맡는다.
                     */
                    {
                        postcssPlugin: "slim-overlay-radix",
                        Once(root, {result}) {
                            if (!result.opts.from?.endsWith("styles/overlay-radix.css")) return;

                            root.walkAtRules("media", (rule) => {
                                if (rule.params.includes("min-width")) rule.remove();
                            });
                            root.walkAtRules("font-face", (rule) => {
                                rule.remove();
                            });
                            root.walkDecls("content", (decl) => {
                                if (decl.value.includes("\u200d")) decl.remove();
                            });

                            // 선택자 목록에서 안 쓰는 컴포넌트 것만 떼고, 남는 게 없으면 규칙째 지운다
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
        // 디시 페이지에 입히는 CSS (entrypoints/page.content.scss). 콘텐츠 스크립트의 CSS는 오버레이 shadow에만 들어가므로 따로 넣는다
        content_scripts: [
            {
                matches: CONTENT_MATCHES,
                exclude_matches: CONTENT_EXCLUDE_MATCHES,
                css: ["content-scripts/page.css"],
                run_at: "document_start"
            }
        ],
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
                description: "글 목록 새로고침: 자동 새로고침 일시정지"
            },
            stealthPause: {
                suggested_key: {
                    default: "Alt+P"
                },
                description: "스텔스 모드: 이미지 잠시 보이기"
            },
            blockReveal: {
                description: "콘텐츠 차단: 이 페이지에서 가린 내용 보기"
            }
        }
    }
});
