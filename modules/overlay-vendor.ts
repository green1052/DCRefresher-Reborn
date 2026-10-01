import type {Plugin} from "vite";
import {defineWxtModule} from "wxt/modules";

/**
 * 오버레이 UI 라이브러리를 콘텐츠 스크립트에서 떼어 낸다.
 *
 * 콘텐츠 스크립트는 모든 디시 페이지에서 통째로 컴파일된다. 오버레이(React DOM·Radix 기본 부품)는 처음 띄울 때만 쓰지만,
 * 번들 안에 있으면 쓰지 않는 페이지도 그 코드를 컴파일한다. 그래서 이 라이브러리들은 entrypoints/overlay-vendor.ts로 따로 빌드하고,
 * 오버레이를 처음 띄울 때 배경이 그 탭에 주입한다 (entrypoints/background/page.ts의 refresher:loadOverlay).
 *
 * 상태가 두 벌이 되지 않게 우리 코드와 React·Radix Themes는 콘텐츠 스크립트에 그대로 둔다. 두 빌드가 같은 것을 쓰도록:
 * - 콘텐츠 스크립트: 떼어 낸 패키지의 import를 overlay-vendor가 둔 전역(__refresherVendor)을 읽는 모듈로 바꾼다.
 *   CommonJS 모듈로 만들어 처음 require될 때 평가된다. 오버레이 코드만 이 패키지를 쓰므로 주입한 뒤에야 평가된다.
 * - overlay-vendor: react를 콘텐츠 스크립트가 둔 전역(__refresherReact)의 것으로 바꾼다. React가 두 벌이면 훅이 깨진다.
 *   빌드가 따로라 트리 셰이킹이 넘어가지 않으므로, 콘텐츠 스크립트 번들에 남은 모듈이 가져가는 이름만 overlay-vendor에 넣는다.
 * Radix Themes는 콘텐츠 스크립트에 남는다. modules/slim-radix-css.ts가 그 코드의 rt- 클래스로 오버레이 CSS를 줄인다.
 */

/** 떼어 내는 패키지 → overlay-vendor가 __refresherVendor에 두는 이름. */
export const VENDOR_PACKAGES = {
    "radix-ui": "radixUi",
    "radix-ui/internal": "radixInternal",
    "react-dom/client": "reactDomClient"
} as const;

/** overlay-vendor가 콘텐츠 스크립트의 것을 쓰는 패키지 → __refresherReact에 두는 이름. */
const SHARED_PACKAGES = {
    react: "react",
    "react/jsx-runtime": "jsxRuntime"
} as const;

const PREFIX = "\0refresher-global:";
const PICK_PREFIX = "\0refresher-pick:";

/** `import {A, B as C} from "radix-ui"`. 타입만 가져오는 import는 빌드 전에 지워진다. */
const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;

/** 패키지 import를 전역 객체의 값으로 바꾸는 플러그인. 없으면 원인을 알 수 있게 던진다. */
const fromGlobal = (name: string, global: string, packages: Record<string, string>): Plugin => ({
    name,
    enforce: "pre",
    resolveId(source) {
        return Object.hasOwn(packages, source) ? `${PREFIX}${source}` : null;
    },
    load(id) {
        if (!id.startsWith(PREFIX)) return null;
        const key = packages[id.slice(PREFIX.length)];
        return `const value = globalThis.${global}?.${key};
if (value === undefined) throw new Error("${global}.${key}가 없습니다. 오버레이 라이브러리를 주입하기 전에 불렀습니다.");
module.exports = value;`;
    }
});

/** 패키지 → 콘텐츠 스크립트가 쓰는 이름. 콘텐츠 스크립트 빌드가 채우고 뒤이은 overlay-vendor 빌드가 읽는다. */
type Picked = Map<string, Set<string>>;

/** 콘텐츠 스크립트 번들에 남은 모듈이 떼어 낸 패키지에서 가져가는 이름을 모은다. */
const collectImports = (picked: Picked): Plugin => {
    const byModule = new Map<string, Picked>();
    return {
        name: "refresher:overlay-vendor-collect",
        transform(code, id) {
            const found: Picked = new Map();
            for (const [, specifiers, source] of code.matchAll(NAMED_IMPORT)) {
                if (!Object.hasOwn(VENDOR_PACKAGES, source!)) continue;
                const names = found.get(source!) ?? new Set();
                for (const specifier of specifiers!.split(",")) {
                    const name = specifier.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
                    if (name && !specifier.trim().startsWith("type ")) names.add(name);
                }
                found.set(source!, names);
            }
            if (found.size > 0) byModule.set(id, found);
            return null;
        },
        generateBundle(_options, bundle) {
            picked.clear();
            for (const output of Object.values(bundle)) {
                if (output.type !== "chunk") continue;
                for (const id of output.moduleIds) {
                    for (const [source, names] of byModule.get(id) ?? []) {
                        picked.set(source, new Set([...(picked.get(source) ?? []), ...names]));
                    }
                }
            }
        }
    };
};

/**
 * overlay-vendor의 패키지 import를 콘텐츠 스크립트가 쓰는 이름만 다시 내보내는 모듈로 바꾼다.
 * 모은 것이 없으면(콘텐츠 스크립트를 빌드하지 않았으면) 모두 넣는다.
 */
const pickExports = (picked: Picked): Plugin => ({
    name: "refresher:overlay-vendor-pick",
    enforce: "pre",
    resolveId(source, importer) {
        if (!Object.hasOwn(VENDOR_PACKAGES, source) || importer?.startsWith(PICK_PREFIX) || !importer?.includes("/entrypoints/overlay-vendor")) return null;
        return `${PICK_PREFIX}${source}`;
    },
    load(id) {
        if (!id.startsWith(PICK_PREFIX)) return null;
        const source = id.slice(PICK_PREFIX.length);
        const names = picked.get(source);
        return names ? `export {${[...names].join(", ")}} from "${source}";` : `export * from "${source}";`;
    }
});

export default defineWxtModule((wxt) => {
    const picked: Picked = new Map();
    wxt.hook("vite:build:extendConfig", (entries, config) => {
        const names = entries.map((entry) => entry.name);
        config.plugins ??= [];
        if (names.includes("content")) {
            config.plugins.push(fromGlobal("refresher:overlay-vendor-imports", "__refresherVendor", VENDOR_PACKAGES), collectImports(picked));
        }
        if (names.includes("overlay-vendor")) {
            config.plugins.push(fromGlobal("refresher:overlay-vendor-react", "__refresherReact", SHARED_PACKAGES), pickExports(picked));
        }
    });
});
