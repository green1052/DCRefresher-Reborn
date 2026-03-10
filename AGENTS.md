# AI Agent Guide - DCRefresher Reborn

This guide outlines the architectural patterns, conventions, and workflows for working on the DCRefresher Reborn
codebase.

## 🏗️ Architecture Overview

The project is a browser extension built with **WXT (Web Extension Tools)**, **Vue 3**, and **TypeScript**.
It enhances the DCInside website by injecting features via a modular content script system.

### Key Directories

- `src/entrypoints`: Extension entry points (background, content scripts, popup).
    - `content.ts`: Main content script entry; registers and loads all modules.
- `src/modules`: Feature implementations. Each file is a self-contained module.
- `src/core`: Core framework logic (module loader, DOM observation, event bus).
- `src/components`: Vue components using the composition API.
- `src/utils`: Shared utilities (HTTP, storage, messaging).

## 🧩 Module System

The core of the extension is the module system. Features are implemented as "Modules" in `src/modules/*`.

### Creating a Module

A module exports an object implementing the `RefresherModule` interface (implicitly defined in `src/@types/module.ts`).

```typescript
// Example Structure
export default {
    name: "Module Name",
    description: "Description",
    enable: true,             // Default enabled state
    default_enable: true,
    require: ["http", "filter"], // Dependencies injected into func
    settings: {               // User configurable settings
        optionName: {
            name: "Option Title",
            type: "checkbox", // or "range", "select"
            default: true
        }
    },
    memory: {                 // Runtime state (cleared on revoke)
        stateVar: null
    },
    // Main logic, dependencies injected in order of 'require'
    func: (http, filter) => {
        // Implementation
    },
    // Cleanup logic when module is disabled
    revoke: (http, filter) => {
        // Remove listeners, DOM changes
    }
};
```

### Dependency Injection

Core services are available to modules via the `require` array. Commonly used services:

- `filter`: DOM observation and manipulation (`src/core/filtering.ts`).
- `http`: HTTP client wrapper around `ky` (`src/utils/http.ts`).
- `eventBus`: Internal event emitter (`src/core/eventbus.ts`).
- `block`, `memo`: specialized services.

## 👁️ DOM Manipulation & Observation

**Do not use raw MutationObserver directly.** Use the `filter` utility for performance and consistency.

- **`filter.add(scope, callback)`**: Registers a callback to run whenever elements matching `scope` (CSS selector)
  appear.
- **`cash-dom`**: Used as a lightweight jQuery alternative (imported as `$`).

```typescript
// Example: Modify comments
filter.add(".comment_list", (element) => {
    $(element).find(".author").addClass("highlight");
});
```

## 🔄 Messaging & State

- **Reactive State**: Use `src/utils/storage.ts` (based on `wxt/storage`) for synchronizing state across contexts (
  Popup, Background, Content Scripts).
    - Use `modulesStorage`, `settingsStorage`, `blockStorage`, `memoStorage` for reactive data.
    - Components should `.watch()` these storage items rather than polling or using message passing.
- **Persistent Data**: `src/utils/webStorage.ts` is still used for direct inconsistent Key-Value access, but prefer
  `wxt/storage` for structured data.
- **Messaging**: Use `src/utils/messaging.ts` for imperative actions (e.g. broadcasting events), NOT for state
  synchronization.
- **EventBus**: Use `eventBus` for decoupled communication within the same context.

## 🖥️ UI Components

- **Popup**: Standard Vue 3 app in `src/entrypoints/popup`.
- **Injected UI**: Use `src/core/frame.ts` to mount Vue components into the web page DOM.
    - `Frame` creates a Vue app instance and mounts `frameComponent.vue`.

## 🛠️ Workflow

- **Development**: `pnpm dev` - Starts the WXT dev server with HMR.
- **Build**: `pnpm build` - Generates the production extension in `dist/`.
- **Package**: `pnpm zip` - Creates a zip file for store submission.

## ⚠️ Important Conventions

- **State Management**: Modify `module.memory` for runtime state. This ensures state is reset when a module is toggled
  off/on without reloading the page.
- **Styles**: SCSS files in `src/styles`. Global styles in `index.scss`.
- **APIs**: Use the provided wrappers (`http`, `storage`) instead of raw browser APIs to ensure consistent error
  handling and typing.

