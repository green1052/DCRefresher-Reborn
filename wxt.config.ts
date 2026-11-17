import tailwindcss from "@tailwindcss/vite";
import {defineConfig} from "wxt";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "./core/pages";

export default defineConfig({
    manifestVersion: 3,
    modules: ["@wxt-dev/auto-icons"],
    vite: () => ({
        plugins: [
            // Tailwind 최적화는 대상이 고정이라 끄고 Vite 압축(lightningcss)이 cssTarget에 맞추게 한다.
            tailwindcss({optimize: false})
        ],
        build: {
            cssTarget: ["chrome140", "firefox144"],
            // 최소 버전(Chrome 140, Firefox 144)은 modulepreload를 지원해 Vite의 polyfill이 필요 없다.
            modulePreload: {polyfill: false}
        }
    }),
    hooks: {
        // 제네릭 타입 인자를 export로 잘못 읽어 경고만 내니 직접 import한다 - dirs는 기본값과 합쳐지므로 비운다.
        "config:resolved": (wxt) => {
            if (wxt.config.imports) wxt.config.imports.dirs = [];
        },
        // 부트스트랩이 런타임에 찾는 경로라 content-main 파일 이름의 해시를 빼고, WXT가 덮어쓴 설정(이슈 #177)을 빌드 뒤에 고친다.
        "vite:build:extendConfig": ((group: unknown, config: {build?: {rollupOptions?: {output?: {entryFileNames?: unknown}}}}) => {
            if (!Array.isArray(group) || !group.some((entry) => entry?.name === "content-main")) return;
            const output = config.build?.rollupOptions?.output;
            if (!output || typeof output.entryFileNames !== "function") return;
            const original = output.entryFileNames as (chunk: {name: string}) => unknown;
            output.entryFileNames = (chunk: {name: string}) => chunk.name === "content-main" ? "chunks/content-main.js" : original(chunk);
        }) as never
    },
    zip: {
        // 파이어폭스 심사용 소스 zip. 테스트 결과물과 DB 빌드 결과(.gitignore에 있는 것)는 소스가 아니라 뺀다.
        excludeSources: ["test-results/**", "playwright-report/**", "db/**", "stats.html"]
    },
    dev: {
        reloadCommand: "Alt+Shift+R"
    },
    manifest: ({browser}) => {
        const firefox = browser === "firefox";
        return {
            name: "DCRefresher Reborn",
            // 코드가 쓰는 API 중 가장 늦은 것에 맞춘다 - Chrome 140(Uint8Array toBase64), Firefox 144(getBytesInUse).
            ...(firefox
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
            permissions: ["alarms", "contextMenus", "storage", "scripting", "unlimitedStorage"],
            host_permissions: ["https://*.dcinside.com/*"],
            content_scripts: [
                {
                    matches: CONTENT_MATCHES,
                    exclude_matches: CONTENT_EXCLUDE_MATCHES,
                    css: ["content-scripts/page.css"],
                    run_at: "document_start"
                }
            ],
            // 콘텐츠 본문 청크와 오버레이 CSS - 웹 페이지에서 접근할 수 있으니 DC 페이지에만 연다.
            web_accessible_resources: [{matches: CONTENT_MATCHES, resources: ["chunks/*.js", "content-scripts/content.css"]}]
        };
    }
});
