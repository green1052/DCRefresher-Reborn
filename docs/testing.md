# 테스트

단위 테스트(Vitest), E2E(Playwright), 손으로 확인할 것입니다.

## 단위 테스트 (Vitest)

`bun run test`. jsdom이 Bun에서 뜨지 않아 Vitest는 Node에서 실행됩니다. 확장 API는 WXT의 `WxtVitest` 플러그인이 [`@webext-core/fake-browser`](https://webext-core.aklinker1.io/fake-browser/installation)로 바꿔 인메모리 저장소로 동작합니다. 저장소를 직접 넣을 때는 `fakeBrowser.storage.local.set({"refresher:modules": …})`처럼 `local:` 없는 키를 씁니다. `WxtVitest`는 `wxt.config.ts`의 vite 플러그인을 불러오지 않으므로 `vitest.config.ts`가 `@preact/preset-vite`를 따로 넣습니다. React Compiler는 테스트에서 돌아가지 않습니다.

- 테스트는 `tests/unit/`에 소스 경로를 따라 둡니다 (`core/block.ts` → `tests/unit/core/block.test.ts`). `modules/`에 두면 WXT가 WXT 모듈로 불러오므로 소스 옆에 두지 않습니다.
- 목·스파이·fake 저장소·타이머는 테스트마다 되돌리므로(`tests/setup.ts`, `vitest.config.ts`의 `mockReset`·`restoreMocks`) 테스트 파일에서 `restoreAllMocks`·`mockReset`·`useRealTimers`를 따로 부르지 않습니다.
- `tests/setup.ts`는 Node·jsdom·fake-browser에 없는 API(`cookieStore`, `navigator.locks` 등)를 채웁니다. 확장이 실행되는 브라우저에는 다 있는 것들이라 소스는 그대로 둡니다. `Uint8Array`의 `toBase64`·`fromBase64`·`toHex`는 Node 25부터 있어 채우지 않고 CI가 최신 Node를 받습니다.
- 공통 도우미는 `tests/helpers.ts`에, 한 영역에서만 쓰는 도우미는 해당 테스트 파일이나 폴더에 둡니다. 시간을 정해 기다리는 대신(`setTimeout(…, 10)`) `tick()`이나 `expect.poll`을 씁니다.
- 기본 환경은 jsdom입니다. jsdom이 방해하는 테스트(`core/backup`의 gzip, `tests/unit/modules/`의 빌드 모듈)는 파일 머리에 `// @vitest-environment node`를 둡니다.
- WXT API만 자동 import됩니다. `components`·`utils`는 직접 import합니다.
- WXT의 `#imports`를 mock할 때는 실제 경로(`wxt/utils/storage` 등)로 합니다. `.wxt/types/imports-module.d.ts`에 있습니다.
- 모듈 레지스트리·스토어처럼 모듈 단위 싱글턴이 있는 코드는 테스트마다 다른 모듈 id를 쓰거나 한 테스트 안에서 이어서 봅니다.

## E2E (Playwright)

`bun run build`로 확장을 빌드한 뒤 `bun run e2e`로 실행합니다. Playwright도 Node에서 실행됩니다. Bun에서는 테스트가 무작위로 멈춥니다.

- **디시에는 요청을 보내지 않습니다.** fixtures가 `dcinside.com` 주소를 모두 `e2e/dcinside.ts`의 가짜 목록·글·댓글로 응답합니다. 흉내 낸 쓰기는 `site.submitted`에 모으고 그 밖의 읽기가 아닌 요청에는 500을 줘서 테스트가 바로 실패합니다. IP DB 서버는 끊습니다. 디시 마크업이 바뀌어 모듈을 고치면 가짜 페이지도 같이 고칩니다.
- 스펙에서는 선택자를 직접 쓰는 대신 `e2e/pages/`의 페이지 객체(`openListPage`, `openPopup`, `openOptions`)를 씁니다. 설정은 `storage.setModules({...})`·`storage.setModuleSettings(id, {...})`로 넣습니다. 디시 마크업이나 클래스 이름이 바뀌면 페이지 객체만 고칩니다.
- `errors` fixture가 모든 테스트에서 페이지 오류와 `console.error`가 없는지 봅니다. 디시 페이지의 `page.evaluate`에서는 `chrome.storage`에 닿지 않으므로 `storage` fixture를 씁니다.
- **파이어폭스**(`bun run e2e:firefox`): `e2e/firefox.ts`가 원격 디버깅 서버로 `.output/firefox-mv2`를 임시 부가 기능으로 설치합니다. Playwright의 파이어폭스는 `moz-extension://` 페이지로 이동하지 못해 팝업·옵션 테스트는 크로미엄에서만 실행되고 파이어폭스에서는 콘텐츠 스크립트 테스트만 돌아갑니다.
- **실제 디시**(`bun run e2e:live`, `e2e/live/`): 실제 디시에 요청하되 읽기가 아닌 POST는 끊어 아무것도 쓰지 않습니다. 모양만 보며 네트워크에 따라 흔들릴 수 있어 CI에는 넣지 않았습니다. `DC_LIST_URL`에 PC 목록 주소를 주면 그 갤러리에서 실행됩니다(기본은 미니 갤러리 `bjwg64`).
- 미리 설치된 크로미엄을 쓰려면 `PLAYWRIGHT_CHROMIUM=/경로/chrome`을 줍니다.

## 손으로 확인할 것

- **두 브라우저에서 모두 확인합니다.** 파이어폭스 E2E는 콘텐츠 스크립트만 봅니다([Firefox](firefox.md)). 옵션·팝업·배경(알람, DB 갱신, 단축키, 우클릭 메뉴)도 봅니다.
- **디시에 쓰기 요청을 보내지 마세요.** 댓글·디시콘·추천·관리 요청은 실제로 반영됩니다. 브라우저 자동화로 실제 디시를 시험할 때는 쓰기 요청(댓글·디시콘·글자콘 작성, 댓글 삭제, 추천, 디시콘 추가 `/dccon/buy`, `*_manager_board_ajax` 관리 요청)을 가로채 막고, 읽기 요청(글·목록 GET과 댓글 목록 POST `/board/comment/`)만 보냅니다.
- **요청을 몰아 보내지 마세요.** 요청이 많으면 디시가 IP를 잠시 막습니다(빈 페이지). 반복 시험에는 저장해 둔 HTML을 요청 가로채기로 돌려주는 편이 안전합니다.
- 성능을 바꿨다면 바꾸기 전과 후를 같은 조건에서 여러 번 재서 비교합니다. 디시 페이지 자체의 스크립트가 유휴 중에도 CPU를 쓰므로 잡음이 큽니다.
