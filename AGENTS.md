# DCRefresher Reborn - Project Knowledge Base

**Generated:** 2026-04-14
**Commit:** 4a1e39c
**Branch:** main

## OVERVIEW

Browser extension for dcinside.com improvements. Built with WXT framework, Vue 3, TypeScript. Korean community tool with
modular architecture.

## STRUCTURE

```
C:\Dev\DCRefresher-Reborn/
├── src/
│   ├── @types/          # Global type augmentations (RefresherModule, etc.)
│   ├── assets/          # Static resources, SCSS styles
│   ├── components/      # Vue components
│   ├── core/            # Framework internals (11 files)
│   │   ├── modules.ts   # Module registry & loader
│   │   ├── eventbus.ts  # Pub/sub system
│   │   ├── communicate.ts # Inter-component messaging
│   │   ├── filtering.ts # Content filtering
│   │   ├── settings.ts  # Settings management
│   │   └── ...
│   ├── entrypoints/     # WXT entry points
│   │   ├── content.ts   # Main content script
│   │   ├── background.ts # Service worker
│   │   ├── grecaptcha.content.ts # reCAPTCHA handler
│   │   └── popup/       # Popup UI (Vue app)
│   ├── modules/         # Feature modules (11 files)
│   │   ├── block.ts     # Block functionality
│   │   ├── refresh.ts   # Auto-refresh
│   │   ├── stealth.ts   # Stealth mode
│   │   ├── preview.ts   # Preview popup
│   │   └── ...
│   └── utils/           # Utility functions
├── wxt.config.ts        # WXT configuration
├── tsconfig.json        # Extends .wxt/tsconfig.json
└── package.json         # pnpm, Vue 3, WXT 0.20
```

## WHERE TO LOOK

| Task                   | Location                                                 | Notes                                             |
|------------------------|----------------------------------------------------------|---------------------------------------------------|
| Add new module         | `src/modules/*.ts`                                       | Follow `RefresherModule` interface pattern        |
| Module lifecycle       | `src/core/modules.ts`                                    | `register()`, `runModule()`, `revokeModule()`     |
| Module dependencies    | `src/core/modules.ts` lines 18-26                        | `ItemToRefresherMap` defines injectable utilities |
| Inter-module messaging | `src/core/communicate.ts`                                | `addHook()` for message handling                  |
| Global types           | `src/@types/module.ts`                                   | `RefresherModule` interface definition            |
| Content script entry   | `src/entrypoints/content.ts`                             | Loads all modules, runs filter                    |
| Settings storage       | `src/utils/webStorage.ts`                                | `storage.module.*` for module data                |
| UI components          | `src/components/` or `src/entrypoints/popup/components/` | Vue 3 SFCs                                        |
| Styles                 | `src/assets/styles/`                                     | SCSS, index.scss imported in content.ts           |

## CONVENTIONS

### Module Pattern

```typescript
// src/modules/example.ts
export default {
    name: "example",
    default_enable: true,
    require: ["filter", "eventBus"], // Dependencies injected in order
    settings: {
        option1: { type: "switch", default: true }
    },
    func(filter, eventBus) {
        // Module initialization
    },
    revoke(filter, eventBus) {
        // Cleanup on disable
    },
    update: {
        option1(value, filter, eventBus) {
            // Handle setting change
        }
    }
} as RefresherModule;
```

### Dependency Injection

- Modules declare `require: ["filter", "eventBus", "block", "http", "ip", "memo"]`
- Dependencies injected as function arguments in `ItemToRefresherMap` order
- See `src/core/modules.ts` lines 18-26 for available utilities

### Type System

- Global types via `declare global` in `src/@types/*.d.ts`
- `RefresherModule` interface defines module shape
- `ItemToRefresherMap` maps dependency names to implementations
- `ValueOf<T>` utility type in `src/@types/global.d.ts`

### Storage

- Module data: `storage.module.get/setGlobal()` via Proxy
- Settings: `settings.load()` with defaults
- Enable state: `storage.set("${module.name}.enable", value)`

## ANTI-PATTERNS (THIS PROJECT)

| Pattern         | Status            | Location                                          |
|-----------------|-------------------|---------------------------------------------------|
| `@ts-ignore`    | **5 occurrences** | `src/core/modules.ts` lines 35, 45, 78, 83, 92    |
| ESLint config   | **None**          | No `.eslintrc`, no `eslintConfig` in package.json |
| Prettier config | **None**          | No formatting rules enforced                      |

## UNIQUE STYLES

1. **Custom Module System**: Proprietary `RefresherModule` pattern instead of WXT's built-in module system. Modules are
   plain objects with lifecycle hooks.

2. **Proxy-Based Persistence**: Module data uses Proxy that auto-saves to storage on mutation (`src/core/modules.ts`
   lines 93-105).

3. **Dual Core Concept**: `core/` = framework internals, `modules/` = user-facing features (inverse of typical naming).

4. **EventBus Pattern**: Custom pub/sub in `src/core/eventbus.ts` for inter-module communication.

5. **Global Type Augmentation**: All custom types added to global scope via `.d.ts` files in `src/@types/`.

## COMMANDS

```bash
# Development
pnpm dev              # Chrome dev mode
pnpm dev:firefox      # Firefox dev mode

# Build
pnpm build            # Build both Chrome & Firefox

# Package
pnpm zip              # Chrome extension zip
pnpm zip:firefox      # Firefox extension zip
```

## NOTES

- **Host restriction**: Content scripts only run on `https://*.dcinside.com/*`
- **pnpm required**: Package manager locked to pnpm@10.31.0
- **WXT generates types**: `.wxt/tsconfig.json` and `.wxt/wxt.d.ts` are auto-generated
- **Module loading**: All modules loaded in parallel via `Promise.all()` in `content.ts`
- **Context menus**: Defined inline in `background.ts` (not in manifest)
- **Git releases**: CI triggers on tags matching `*.*.*`, auto-submits to stores

## CHILD DOCUMENTS

- [src/core/AGENTS.md](src/core/AGENTS.md) - Framework internals
- [src/modules/AGENTS.md](src/modules/AGENTS.md) - Feature modules
- [src/utils/AGENTS.md](src/utils/AGENTS.md) - Utility functions