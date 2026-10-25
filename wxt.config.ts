import {fileURLToPath} from "node:url";

import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import {cn} from "cn/vite";
import {defineConfig} from "wxt";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES, IMAGE_HOST_ORIGINS} from "./core/pages";

export default defineConfig({
    modules: ["@wxt-dev/auto-icons"],
    vite: () => ({
        resolve: {
            alias: [
                // cn(클래스 병합)은 소스에 실제로 쓴 클래스 그룹만 담은 표(utils/cn-tables.ts, 아래 cn 플러그인이 빌드마다 만든다)를 쓴다. 전체 표보다 5KB쯤 작다.
                // 클래스 이름을 문자열로 이어 붙여 만들면 표에 없어 병합되지 않는다 (Tailwind 스캔과 같은 제약).
                {find: /^cn$/, replacement: fileURLToPath(new URL("utils/cn.ts", import.meta.url))},
                // Base UI가 부르는 React 18 shim 대신 preact/compat의 useSyncExternalStore를 쓴다.
                {find: /^use-sync-external-store\/shim(\/index\.js)?$/, replacement: "preact/compat"}
            ]
        },
        plugins: [
            cn({content: ["{components,core,entrypoints,features,stores,utils}/**/*.{ts,tsx}"], out: "utils/cn-tables.ts", css: "assets/styles/tailwind.css"}),
            preact(),
            // Tailwind의 자체 최적화는 대상 브라우저가 고정(Chrome 111·Firefox 128)이라 CSS 중첩을 풀고 접두어를 붙인다.
            // 끄고 Vite의 압축(lightningcss)이 아래 cssTarget, 곧 manifest의 최소 버전에 맞추게 한다.
            tailwindcss({optimize: false})
        ],
        build: {
            cssTarget: ["chrome140", "firefox144"],
            rolldownOptions: {
                // 한글이 한 글자라도 있으면 V8이 스크립트 소스 전체를 2바이트 문자열로 둔다. \uXXXX로 바꿔 ASCII만
                // 내보내면 1바이트 문자열이 되어 탭마다 실리는 본문 청크(content-main.js)의 메모리가 절반쯤로 준다.
                // 파일은 20KB쯤 커진다.
                output: {minify: {compress: true, mangle: true, codegen: {asciiOnly: true}}}
            },
            // 최소 버전(Chrome 140·Firefox 144)은 modulepreload를 지원해 Vite의 polyfill이 필요 없다.
            modulePreload: {polyfill: false}
        }
    }),
    hooks: {
        // components·utils 자동 import 스캔은 제네릭 타입 인자(V 등)를 export로 잘못 읽어 경고만 낸다. 직접 import하므로 끈다.
        // imports.dirs는 기본값과 합쳐지므로 여기서 비운다. WXT API(defineContentScript·browser 등) 자동 import는 남는다.
        "config:resolved": (wxt) => {
            if (wxt.config.imports) wxt.config.imports.dirs = [];
        },
        // 멀티페이지(HTML) 그룹에서 content-main의 파일 이름을 고정한다. 부트스트랩이 런타임에 찾는 경로라
        // 해시가 들어가면 안 된다. WXT가 파일 이름 옵션을 일부러 덮어쓰므로(이슈 #177) 빌드가 끝난 설정을
        // 이 훅에서 고친다(공식 예제 esm-content-script-ui가 같은 훅을 쓴다). 0.21에는 타입이 없어 캐스팅한다.
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
            // 코드가 쓰는 API 중 가장 늦게 들어온 것에 맞춘다 (빌드가 바꿔 주지 않는다).
            // Chrome 140: Uint8Array의 toBase64·fromBase64(백업·IP DB). Firefox 144: storage.local.getBytesInUse(정보 탭), getKeys(143).
            // 다른 브라우저의 키는 알 수 없는 키라 manifest 경고로 남으므로 그 브라우저에만 넣는다.
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
            // 이미지 차단(features/block/background.ts)이 본문 이미지를 다시 받지 않고 읽는 데 쓴다.
            // 크롬은 CORS 헤더를 붙이는 규칙, 파이어폭스는 응답 스트림 필터다. 둘 다 설치·업데이트 때 묻지 않는 권한이다.
            permissions: ["alarms", "contextMenus", "storage", "scripting", "unlimitedStorage",
                          ...(firefox ? ["webRequest", "webRequestBlocking"] : ["declarativeNetRequestWithHostAccess"])],
            host_permissions: ["https://*.dcinside.com/*"],
            // 본문 이미지 호스트. 이미지를 처음 차단할 때 묻는다 (core/pages.ts의 IMAGE_HOST_ORIGINS).
            // MV2(파이어폭스)는 optional_host_permissions가 없어 WXT가 지우므로 optional_permissions에 넣는다.
            optional_host_permissions: IMAGE_HOST_ORIGINS,
            ...(firefox && {optional_permissions: IMAGE_HOST_ORIGINS}),
            content_scripts: [
                {
                    matches: CONTENT_MATCHES,
                    exclude_matches: CONTENT_EXCLUDE_MATCHES,
                    css: ["content-scripts/page.css"],
                    run_at: "document_start"
                }
            ],
            // 콘텐츠 스크립트 본문 청크(entrypoints/content/index.tsx가 런타임에 불러온다)와 오버레이가 읽는 CSS.
            // 웹 페이지에서도 접근할 수 있게 되므로 DC 페이지에만 연다. 파이어폭스(MV2)는 문자열 배열이다.
            web_accessible_resources: firefox
                ? ["chunks/*.js", "content-scripts/content.css"]
                : [{matches: CONTENT_MATCHES, resources: ["chunks/*.js", "content-scripts/content.css"]}]
        };
    }
});
