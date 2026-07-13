# AGENTS.md

WXT browser extension (Vue 3 + TypeScript + Bun) that enhances dcinside.com. Use `bun`.

## Commands

- `bun install` — also runs `postinstall: wxt prepare` which generates `.wxt/`
- `bun dev` — Chrome dev (WXT dev server, auto-reload)
- `bun dev:firefox` — Firefox dev
- `bun build` — builds Chrome **and** Firefox into `.output/`
- `bun zip` — zips both targets (used by CI release)

No test, lint, format, or typecheck scripts exist. Verify edits by:
- `bunx wxt prepare` then `bunx tsc --noEmit -p tsconfig.json` (typecheck; requires `.wxt/` generated first)
- `bun build` (compiles both targets)

## Setup gotcha

`tsconfig.json` extends `.wxt/tsconfig.json`, which is **generated** by `wxt prepare` (gitignored). On a fresh clone, `bun install` triggers this via `postinstall`. If `.wxt/` is missing (e.g. after `git clean`), run `bunx wxt prepare` before anything type-checks.

## Auto-imports (do not add explicit imports for these)

WXT auto-imports globals declared in `.wxt/types/imports.d.ts` (generated, gitignored). Auto-import dirs are configured in `wxt.config.ts` (`imports.dirs`): `components`, `composables`, `hooks`, `utils`, `storage`, `http`. Notably:
- WXT APIs: `defineBackground`, `defineContentScript`, `defineUnlistedScript`, `defineWxtPlugin`, `browser`, `storage`, `createIntegratedUi`, `createShadowRootUi`, `createIframeUi`, `defineAppConfig`
- Vue APIs: `ref`, `computed`, `reactive`, `watch`, `createApp`, `defineComponent`, `nextTick`, ...
- Many exports from auto-import dirs: `blockStorage`, `blockModeStorage`, `memoStorage`, `modulesStorage`, `settingsStorage` (from `src/storage/`), `client`, `http` helpers (from `src/http/`), `User`, `toast`, `createTooltip` (from `src/utils/`), `useRelativeTime` (from `src/composables/`)

**Note:** Content-specific code lives under `src/entrypoints/content/` and is NOT auto-imported. The preview module (`src/entrypoints/content/modules/preview/`) uses explicit imports for its symbols (`makeBodyFrame`, `makeCommentFrame`, `previewRequest`, `panel`, `blockPreset`, `closeAllPopups`, `createMiniPreview`, `miniPreview*`, `getRelevantData`, `PostCache`, `ScrollDetection`, `queryString`). `useDcconPopup` and `useMeDetection` (in `src/entrypoints/content/composables/`) are also explicitly imported.

If unsure whether a symbol is auto-imported, grep `.wxt/types/imports.d.ts`. Adding a redundant explicit import can cause conflicts.

Global types (`RefresherModule`, `RefresherSettings`, `RefresherBlockType`, `RefresherMemoType`, `RefresherEventBus`, ...) are declared `global` in `src/@types/*.ts` and need no import.

Path aliases (from generated tsconfig): `@/` and `~/` → `src/`; `@@/` and `~~/` → project root.

## Architecture

Entrypoints live in `src/entrypoints/`:
- `background.ts` — service worker; context menus, commands, periodic database fetch from `https://dcrefresher.green1052.com/data`, storage migration
- `content/index.ts` — content script on `https://*.dcinside.com/*` (excludes event/h5/m/mall/wiki subdomains), runs at `document_start`
- `grecaptcha.content.ts` — separate content script
- `popup/` — standalone Vue app (own `App.vue`, `main.ts`, `index.html`)

### Module system (main extension mechanism)

`content/index.ts` auto-loads modules via `import.meta.glob` matching BOTH `./modules/*/index.ts` (folder form) and `./modules/*.ts` (flat form), then registers each **default export** as a `RefresherModule` through `src/core/modules.ts`. To add a feature: either drop a new `*.ts` file in `src/entrypoints/content/modules/` or create `src/entrypoints/content/modules/{name}/index.ts` (folder form, for modules with co-located helpers). The shape is the global `RefresherModule` interface in `src/@types/module.ts` (`name`, `description`, `url?`, `func?`, `revoke?`, `settings`, `status`, `data`, `memory`, `shortcuts`, `update`, `enable`, `default_enable`). After all modules load, `filter.run()` applies registered filters.

### Two storage layers — do not conflate

- `src/storage/webStorage.ts` (imported as default `storage` in many files) — raw `browser.storage.local` wrapper (via WXT `storage.getItem`/`setItem`); keys like `refresher.module:NAME`, `NAME.enable`, `refresher.database.*`
- `src/storage/wxtStorage.ts` — WXT `storage.defineItem` typed items with `local:`-prefixed keys (`__REFRESHER_BLOCK`, `__REFRESHER_MEMO`, `__REFRESHER_MODULES`, `__REFRESHER_SETTINGS`). Uses the auto-imported WXT `storage` global (different from the webStorage default export)
- `src/storage/migration.ts` migrates legacy keys; invoked from background + content on load

### Three messaging/event mechanisms — use the right one

- `src/http/messaging.ts` — `@webext-core/messaging` typed protocol for **background ↔ content** cross-context calls (`sendMessage`/`onMessage`, `ProtocolMap`). Extend `ProtocolMap` to add messages.
- `src/core/communicate.ts` — in-content `runtime.onMessage` hook registry (`addHook`/`clearHook`). Background broadcasts `{type, data}` to all tabs; content hooks respond by `type`.
- `src/core/eventbus.ts` — in-content pub/sub (`eventBus.on`/`emit`/`emitNextTick`)

### Other core files

- `src/core/filtering.ts` — filter engine; modules register filter IDs, `filter.run()`/`filter.runSpecific(id)` apply them
- `src/core/settings.ts` — per-module settings store; settings updates emit `refresherUpdateSetting` on the event bus
- `src/components/` — shared Vue SFCs (Composition API) for content-script UI: countdown, dccon, loader, previewButton, timestamp, toast, user. Preview-specific SFCs live co-located under `src/entrypoints/content/modules/preview/components/` (`frame/`, `popup/`, `comment/`). SCSS in `src/assets/styles/index.scss` imported by `content/index.ts`

### Directory structure

```
src/
├── @types/         # global type declarations (no imports needed)
├── assets/         # icons (icons/*.webp), styles
├── components/     # shared Vue SFCs only (countdown, dccon, loader, previewButton, timestamp, toast, user)
├── composables/    # useRelativeTime.ts (shared)
├── core/           # shared infra only (NO .vue): block, communicate, eventbus, filtering, memo, modules, settings, updateCheck
├── entrypoints/    # WXT entrypoints
│   ├── background.ts
│   ├── grecaptcha.content.ts
│   ├── popup/      # standalone Vue app (App.vue, main.ts, index.html, components/, composables/, utils/)
│   └── content/    # content script + all content-specific code
│       ├── index.ts
│       ├── composables/  # useDcconPopup, useMeDetection
│       └── modules/      # auto-loaded feature modules (flat *.ts or {name}/index.ts folder form)
│           ├── block/    # index.ts + request.ts
│           ├── manage/   # index.ts + helpers.ts
│           ├── refresh/  # index.ts + load.ts + controller.ts
│           ├── preview/  # index.ts + controller.ts + request, panel, bodyFrame, commentFrame, miniPreview, cache, scrollDetection, getRelevantData, postParser, frame, previewFrame + components/ (frame/, popup/, comment/)
│           └── *.ts      # simple modules (data, fonts, imagesearch, layout, stealth, userinfo, write)
├── http/           # http.ts (URLs), httpClient.ts (ky), messaging.ts
├── storage/        # webStorage.ts, wxtStorage.ts, migration.ts
└── utils/          # generic utils: observe, tooltip, toast, comment, memoAsk, user, userDataInsert, ip, types
```

## Manifest

Defined in `wxt.config.ts` (no static `manifest.json`). Edit permissions, host_permissions (`https://*.dcinside.com/*`), commands (Alt+R / Alt+S / Alt+P), `web_accessible_resources`, and `browser_specific_settings` there. `@wxt-dev/auto-icons` generates icons from `src/assets/icon.png`.

## Gitignored local files

`.env`, `.wxt/`, `.output/`, `web-ext.config.ts`. The latter contains machine-specific Chrome binary/profile paths — never commit it.

## Release

Tag push matching `*.*.*` triggers `.github/workflows/build.yml`: `bun install` → `bun zip` → GitHub Release (both `*-chrome.zip` and `*-firefox.zip`) → `wxt submit` to Chrome Web Store + Firefox AMO using repo secrets. Bump `version` in `package.json` to release.

## Conventions

- UI text and code comments are in Korean — preserve this.
- Renovate config extends `github>green1052/renovate-config`.
