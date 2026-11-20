# 테스트

## 단위 테스트 (Vitest)

`bun run test`. jsdom이 Bun에서 안 떠서 Node에서 실행됩니다. 확장 API는 WxtVitest 플러그인이 [`@webext-core/fake-browser`](https://webext-core.aklinker1.io/fake-browser/installation)로 바꿉니다. 저장소를 직접 넣을 때는 `fakeBrowser.storage.local.set({"refresher:modules": ...})`처럼 `local:` 없는 키를 씁니다.

- 테스트는 `tests/unit/`에 소스 경로를 따라 둡니다. `modules/`에 두면 WXT가 모듈로 불러오므로 소스 옆에 두지 않습니다. 목, 스파이, fake 저장소, 타이머는 테스트마다 되돌아가므로(`tests/setup.ts`) 따로 되돌리지 않습니다.
- `tests/setup.ts`는 Node, jsdom에 없는 API(`cookieStore`, `navigator.locks` 등)를 채웁니다. 기본 환경은 jsdom이고 방해하면 파일 머리에 `// @vitest-environment node`를 둡니다.
- `vmThreads` 풀이라 Node 내장 모듈 오류는 `instanceof Error`이 어긋날 수 있습니다(그러면 `vitest.config.ts`의 `pool` 삭제).
- 공통 도우미는 `tests/helpers.ts`. 시간 대기는 `tick()`, `expect.poll`을 쓰고 컴포넌트는 그 안의 `render`, `act`로 그립니다. `lucide-preact`는 `vi.mock`으로 평범한 요소로 바꿉니다(`tests/unit/features/preview/ui/Votes.test.tsx`), 다이얼로그(`components/dialogs.tsx`)도 필요한 export만 갈아끼웁니다.
- WXT API만 자동 import됩니다(`components`, `utils`는 직접). `#imports`를 mock할 때는 실제 경로(`wxt/utils/storage`)로 합니다. 모듈 단위 싱글턴은 테스트마다 다른 모듈 id를 쓰거나 한 테스트 안에서 이어 봅니다.

## E2E (Playwright)

- `bun run e2e`(`e2e:firefox`는 파이어폭스용). 스크립트가 먼저 확장을 빌드하고 Node에서 실행됩니다(Bun에서는 무작위로 멈춤).
- **디시에 요청을 보내지 않습니다.** fixtures가 `dcinside.com` 주소를 `e2e/dcinside.ts`의 가짜 목록, 글, 댓글로 응답하고 그 밖의 쓰기 요청에는 500을 줍니다. IP DB는 `test.use({serveIpDb: true})` 테스트만 가짜로 응답하고(`e2e/ipdb.ts`) 파이어폭스는 건너뜁니다. 디시 마크업이 바뀌면 가짜 페이지도 고칩니다.
- 선택자 대신 `e2e/pages/`의 페이지 객체(`openListPage`, `openPopup`, `openOptions`, `gallery.ts`의 `viewPage`, `managementPage`)를 쓰고 설정은 `storage.setModules({...})`, `storage.setModuleSettings(id, {...})`로 넣습니다. `errors` fixture가 페이지 오류, `console.error`를 봅니다.
- **파이어폭스**: `e2e/firefox.ts`가 원격 디버깅 서버로 `.output/firefox-mv3`를 임시 부가 기능으로 설치합니다. `moz-extension://` 이동이 안 돼 팝업, 옵션 테스트는 Chromium에서만 돌고 파이어폭스는 콘텐츠 스크립트만 봅니다.
- **실제 디시**(`bun run e2e:live`, `e2e/live/`): 읽기 외 POST는 끊어 아무것도 쓰지 않습니다. 조용히 멈추는 기능이 찾는 선택자(`features/write/markup.ts`, `features/refresh/markup.ts`), 디시 JS에서 옮겨 쓴 값과 Turnstile 칸(`core/preview/dcinside-js.ts`, `features/preview/comment-submit.ts`), `entrypoints/background/page.ts`가 읽는 `chk_user_block('...')` 호출이 실제 응답에 있는지 봅니다.
- `live` 잡은 CI(`.github/workflows/ci.yml`)에서 PR, 릴리즈마다 돌고 갤러리는 `bjwg64` 고정입니다. 미리 설치된 Chromium은 `PLAYWRIGHT_CHROMIUM=/경로/chrome`.

## 손으로 확인할 것

- 두 브라우저에서 모두 확인합니다. 파이어폭스 E2E는 콘텐츠 스크립트만 봅니다([Firefox](firefox.md)). 옵션, 팝업, 배경(알람, DB 갱신, 단축키, 우클릭 메뉴)도 봅니다.
- 디시에 쓰기 요청을 보내지 마세요(실제로 반영됨). 자동화로 디시를 시험할 때는 쓰기를 가로채 막고 읽기만 보냅니다. 요청을 몰아 보내면 IP가 잠시 막히니 반복 시험에는 저장한 HTML을 돌려주는 편이 안전합니다.
- 성능은 바꾸기 전후를 같은 조건에서 여러 번 재서 비교합니다(디시 페이지 스크립트가 유휴 중에도 CPU를 써 잡음이 큼).
