import tailwindcss from "@tailwindcss/vite";
import {rm} from "node:fs/promises";
import {join} from "node:path";
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
        // 파일 이름의 내용 해시(-AbCdEf12)를 뗀다. 확장 패키지는 통째로 배포되니 해시의 캐시 무효화 역할이 없고, 이름이 고정이면 디버깅이 쉽다.
        // content-main.js가 그대로 chunks/content-main.js가 되는 것도 이 훅이 한다(부트스트랩이 런타임에 찾는 경로. WXT가 덮어쓴 설정이라 빌드 뒤에 고친다, 이슈 #177).
        "vite:build:extendConfig": ((_group: unknown, config: {build?: {rollupOptions?: {output?: Record<string, unknown>}}}) => {
            const output = config.build?.rollupOptions?.output;
            if (!output) return;
            const stripHash = (name: unknown): unknown =>
                typeof name === "string" ? name.replace(/-\[hash\]/g, "").replace(/-[A-Za-z0-9_-]{8}(\.[a-z]+)$/, "$1") : name;
            for (const key of ["entryFileNames", "chunkFileNames", "assetFileNames"]) {
                const value = output[key];
                if (typeof value === "function") {
                    const original = value as (chunk: never) => unknown;
                    output[key] = (chunk: never) => stripHash(original(chunk));
                } else if (typeof value === "string") {
                    output[key] = stripHash(value);
                }
            }
        }) as never,
        // 콘텐츠 스크립트 그룹의 html 껍데기(content-main.html)는 아무도 참조하지 않는다 - 패키지에서 뺀다.
        "build:done": async (wxt) => {
            await rm(join(wxt.config.outDir, "content-main.html"), {force: true});
        }
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
