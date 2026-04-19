# AGENTS.md - src/modules

## OVERVIEW

User-facing feature modules implementing dcinside.com enhancements. 11 modules export default `RefresherModule` objects.

## WHERE TO LOOK

| Module           | Purpose                    | Key Settings                                       |
|------------------|----------------------------|----------------------------------------------------|
| `block.ts`       | Hide blocked users/content | `replyRemove`, `blur`                              |
| `refresh.ts`     | Auto-refresh list          | `refreshRate`, `fadeIn`, `useBetterBrowse`         |
| `preview.ts`     | Post preview popup         | `tooltipMode`, `toggleAdminPanel`, `bypassCaptcha` |
| `stealth.ts`     | Hide all images            | (toggle only)                                      |
| `userinfo.ts`    | Show IP/UID/memos          | `showIpInfo`, `showTooltip`                        |
| `write.ts`       | Write functionality        | -                                                  |
| `manage.ts`      | Gallery management         | -                                                  |
| `data.ts`        | Data management            | -                                                  |
| `fonts.ts`       | Font customization         | -                                                  |
| `imagesearch.ts` | Image search               | -                                                  |
| `layout.ts`      | Layout changes             | -                                                  |

## CONVENTIONS

### Module Structure

```typescript
export default {
    name: "모듈명",
    description: "설명",
    url: /\/board\/(view|lists)/,      // URL pattern for activation
    status: {},                        // Runtime settings values
    memory: { ... },                   // Module state (UUIDs, caches, etc.)
    enable: boolean,                  // Default enable state
    default_enable: boolean,          // Default setting value
    settings: { ... },                 // Configuration schema
    shortcuts?: { ... },               // Keyboard shortcuts
    func(deps) { ... },                // Init with injected deps
    revoke(deps) { ... }               // Cleanup
} as RefresherModule<{ memory, settings }>;
```

### Settings Schema

- `type: "check"` → boolean toggle
- `type: "range"` → slider (min, max, step, unit)
- `type: "option"` → dropdown (items object)
- `type: "text"` → string input


### Memory Pattern

- Use `uuid`/`uuid2` for `filter.add()` return values
- Use `memory.lastSelect` for context menu timestamp validation
- Event listeners stored as cleanup references

## NOTES

- All module names/descriptions in Korean
- Modules run only on `https://*.dcinside.com/*` (enforced by `url` pattern)
- `memory` persists across page navigations (different from status)
- `filter.add()` returns UUID for later `filter.remove()` in revoke
- EventBus listeners stored and removed in revoke
- Context menu modules share selection via `eventBus.on("refresherUserContextMenu", ...)`