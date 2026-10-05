import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "wxt";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "./core/pages";

/** 지원하는 가장 낮은 브라우저 버전 (manifest의 최소 버전). 빌드 대상은 Vite 기본값(baseline-widely-available)이다. */
const MIN_CHROME = 153;
const MIN_FIREFOX = 155;

export default defineConfig({
    modules: ["@wxt-dev/auto-icons"],
    vite: () => ({
        plugins: [
            // React Compiler를 Babel 없이 oxc(oxc-transform-react)로 돌린다. @vitejs/plugin-react에서 컴파일러 플러그인만 쓴다.
            // 나머지(React Fast Refresh)는 React 전용이라 뺀다. 이 플러그인이 JSX도 Preact 런타임으로 바꾼다.
            // React 18 대상으로 돌려 react-compiler-runtime을 쓰게 한다. 19 대상은 React 내부 런타임(react/compiler-runtime)을 써 Preact에 없다.
            ...react({compiler: {target: "18"}, jsxImportSource: "preact"}).filter((plugin) => plugin.name === "vite:react-compiler"),
            // React 대신 Preact를 쓴다. 코드와 라이브러리(Base UI 등)의 react·react-dom import는 preact/compat으로 바뀐다.
            // babel 옵션을 주지 않으면 JSX는 oxc로 바뀐다 (preset-vite 2.10.4+).
            preact(),
            tailwindcss(),
            // Tailwind는 CSS 맨 앞에 라이선스 주석(/*! tailwindcss … */)을 늘 붙이고, CSS 압축기(Lightning CSS)는 /*! 주석을 지우는 옵션이 없다.
            {
                name: "strip-tailwind-banner",
                apply: "build",
                // 콘텐츠 스크립트(IIFE)의 CSS는 vite:css-post가 generateBundle에서 내보내므로 그 뒤에 돈다.
                enforce: "post",
                generateBundle(_, bundle) {
                    for (const file of Object.values(bundle)) {
                        if (file.type === "asset" && file.fileName.endsWith(".css") && typeof file.source === "string") file.source = file.source.replace(/\/\*! tailwindcss v[^*]*\*\/\n?/, "");
                    }
                }
            }
        ],
        build: {
            rolldownOptions: {
                checks: {
                    // react-compiler-runtime의 "use no memo"는 컴파일러가 그 파일을 건너뛰게 하는 표시라 번들에서 빠져도 된다.
                    moduleLevelDirective: false,
                    // dev 빌드는 WXT가 소스맵을 켜는데, Tailwind는 빌드 모드에서 CSS 소스맵을 만들지 않아 경고한다. CSS 소스맵은 쓰지 않는다.
                    sourcemapBroken: false
                }
            }
        }
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
        minimum_chrome_version: String(MIN_CHROME),
        browser_specific_settings: {
            gecko: {
                id: "dcrefresher-reborn@green1052",
                strict_min_version: `${MIN_FIREFOX}.0`,
                data_collection_permissions: {
                    required: ["none"]
                }
            }
        },
        permissions: ["alarms", "contextMenus", "storage", "scripting", "unlimitedStorage"],
        host_permissions: ["https://*.dcinside.com/*"],
        // 디시 페이지에 입히는 CSS (entrypoints/page.content.css). 콘텐츠 스크립트의 CSS는 오버레이 shadow에만 들어가므로 따로 넣는다
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
