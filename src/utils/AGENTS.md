# src/utils - Utility Functions

## OVERVIEW

Utility functions for DCRefresher: storage, HTTP, IP lookup, user management, DOM observation, and notifications.

## WHERE TO LOOK

| File                 | Purpose             | Key Patterns                                                                    |
|----------------------|---------------------|---------------------------------------------------------------------------------|
| `webStorage.ts`      | Raw browser storage | Module data with `refresher.module:` prefix, JSON auto-parse on get             |
| `storage.ts`         | Type-safe storage   | WXT `storage.defineItem` with defaults for blocks/memos/modules/settings        |
| `http.ts`            | DC inside API URLs  | Gallery type detection (`checkMinor`, `checkMini`, `checkPerson`), URL builders |
| `ip.ts`              | IP ISP lookup       | Lazy-loaded from storage (`refresher.database.ip`)                              |
| `messaging.ts`       | Extension messaging | `@webext-core/messaging` with `store`/`broadcast` protocol                      |
| `comment.ts`         | Comment submission  | Custom dcinside `service_code` decryption, uses `ky`                            |
| `user.ts`            | User data class     | Integrates memo + IP + ratio + ban, icon-based type detection                   |
| `scrollDetection.ts` | Scroll analysis     | Distinguishes mouse (fixed delta) vs trackpad (variable)                        |
| `observe.ts`         | DOM element finding | MutationObserver with 3s timeout, returns NodeList                              |
| `toast.ts`           | Notifications       | Vue component, `DOMContentLoaded` mount, Escape to close                        |
| `writeClipboard.ts`  | Clipboard fallback  | Primary: Clipboard API, fallback: textarea execCommand                          |
| `color.ts`           | Color utilities     | Random hex generator                                                            |
| `types.ts`           | Type helpers        | `Nullable<T>`, `NullableProperties<O>`, `ObjectEnum<V>`                         |
| `getURL.ts`          | Extension URLs      | Wrapper for `browser.runtime.getURL`                                            |

## NOTES

- **Dual storage**: Raw `webStorage` for dynamic module data, `storage.ts` for type-safe defined items
- **Comment encryption**: `comment.ts` contains dcinside's proprietary `service_code` decoder (lines 10-70)
- **User class**: `User` auto-resolves memo, IP data, ratio, ban on construction
- **Scroll detection**: Tracks session delta to differentiate mouse wheel from trackpad (critical for gallery
  navigation)
- **No external deps**: Most utils are vanilla - only `comment.ts`, `user.ts`, `toast.ts` import frameworks
- **Dependencies**: `comment.ts` imports `ky`, `cash-dom`; `user.ts` imports core `memo`; `toast.ts` imports Vue