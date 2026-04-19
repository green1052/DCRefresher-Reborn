# src/core - Framework Internals

**Generated:** 2026-04-14

## OVERVIEW

Internal utilities powering the module system: filtering, settings, block, memo, frame, and update checking.

## WHERE TO LOOK

| File                 | Purpose                    | Key Patterns                                                |
|----------------------|----------------------------|-------------------------------------------------------------|
| `filtering.ts`       | Content filtering engine   | `filter.add()`, `filter.run()`, Observer-based DOM scanning |
| `block.ts`           | Block management (9 types) | `block.check()`, regex support, gallery-scoped rules        |
| `memo.ts`            | User memo system           | `memo.add()`, `memo.get()`, color-coded notes               |
| `settings.ts`        | Settings persistence       | Event-driven sync via `refresherSettingsSync`               |
| `frame.ts`           | Frame stack manager        | Vue 3 app mounting, event emitter compatibility             |
| `frameComponent.vue` | Frame UI component         | Group/Scroll composables, fade transitions                  |
| `updateCheck.ts`     | Update notifications       | Toast on install/update (3s delay)                          |

## NOTES

- **Filtering**: Uses `src/utils/observe` for DOM observation. `neverExpire` option keeps observer alive.
- **Block types**: NICK, ID, IP, TITLE, TEXT, COMMENT, DCCON, TAB, IMAGE. Modes: SAME, CONTAIN, NOT_SAME, NOT_CONTAIN.
- **Block advanced**: Uses `new Function()` for eval - security risk? User-provided code runs in block context.
- **Memo cache**: In-memory cache synced with storage watchers. Triggers `refresh` event on change.
- **Frame architecture**: Vue 3 `createApp()` mounted to dynamically created `<refresher-frame-outer>`. `$on/$emit`
  pattern for cross-frame communication.
- **Storage watchers**: Block and Memo use WXT storage `.watch()` to auto-update in-memory cache.
- **Proxy auto-save**: Module data (in `modules.ts`) uses Proxy - mutations trigger automatic
  `storage.module.setGlobal()`.