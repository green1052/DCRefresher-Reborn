# 테스트

단위 테스트(Vitest), E2E(Playwright), 손으로 확인할 것입니다.

## 단위 테스트 (Vitest)

`bun run test`. Vitest는 Node에서 돕니다(jsdom이 Bun에서 뜨지 않는다). `vitest.config.ts`가 WXT의 `WxtVitest` 플러그인을 씁니다. `@/` 별칭과 `import.meta.env.BROWSER` 같은 전역을 맞추고, 확장 API(`browser.*`)를 [`@webext-core/fake-browser`](https://webext-core.aklinker1.io/fake-browser/installation)로 바꿉니다. 그래서 `storage.getItems`·`storage.watch`·`defineItem`이 인메모리 저장소로 그대로 돕니다. 저장소를 직접 넣을 때는 `fakeBrowser.storage.local.set({"refresher:modules": …})`처럼 `local:` 없는 키를 씁니다. `WxtVitest`는 `wxt.config.ts`의 vite 플러그인을 불러오지 않으므로, `vitest.config.ts`가 `@preact/preset-vite`를 따로 넣어 `react`를 `preact/compat`으로 바꾸고 zustand도 같이 변환합니다(`server.deps.inline`). React Compiler는 테스트에서 돌지 않습니다.

- 테스트는 `tests/unit/`에 소스 경로를 따라 둡니다 (`core/block.ts` → `tests/unit/core/block.test.ts`). `modules/`에 두면 WXT가 WXT 모듈로 불러오므로 소스 옆에 두지 않습니다.
- `tests/setup.ts`가 테스트마다 `fakeBrowser.reset()`을 하고 끝나면 `vi.useRealTimers()`로 돌립니다. 목·스파이는 `vitest.config.ts`의 `mockReset`·`restoreMocks`가 테스트마다 되돌리므로, 테스트 파일에서 `restoreAllMocks`·`mockReset`·`useRealTimers`를 따로 부르지 않습니다.
- `tests/setup.ts`는 Node·jsdom·fake-browser에 없는 것(`Uint8Array`의 `toBase64`·`fromBase64`, Cookie Store API `cookieStore`, `performance.getEntriesByType`, `CSSStyleDeclaration`의 반복, `navigator.locks`, fake-browser의 `storage.local.getKeys`)을 채웁니다. 확장이 도는 브라우저에는 다 있는 것들이라 소스는 그대로 둡니다.
- 공통 도우미는 `tests/helpers.ts`에 둡니다. `tick()`(타이머·저장소 알림 한 차례 기다리기), `stored(key)`(fake 저장소 값 하나), `setting({...})`·`testModule({...})`(이름·설명을 비운 설정 스키마와 모듈), `preData({...})`(목록 행에서 읽은 글 정보), `setBlockLists(...)`(차단 스토어에 목록 넣기)입니다. 한 영역에서만 쓰는 도우미는 그 테스트 파일(또는 `tests/unit/modules/fixture.ts`처럼 그 폴더)에 둡니다. 시간을 정해 기다리지(`setTimeout(…, 10)`) 말고 `tick()`이나 `expect.poll`을 씁니다.
- 기본 환경은 jsdom입니다. DOM을 안 쓰고 jsdom이 방해하는 테스트(`core/backup`의 gzip, `tests/unit/modules/`의 빌드 모듈)는 파일 머리에 `// @vitest-environment node`를 둡니다.
- WXT API(`defineContentScript`·`browser`·`storage` 등)만 자동 import됩니다. `components`·`utils`는 자동 import하지 않으니(`wxt.config.ts`의 `config:resolved` 훅) 직접 import합니다.
- WXT의 `#imports`를 mock할 때는 실제 경로(`wxt/utils/storage` 등)로 합니다. `.wxt/types/imports-module.d.ts`에 있습니다.
- 모듈 레지스트리·스토어처럼 모듈 단위 싱글턴(`instances`, `once`)이 있는 코드는 테스트마다 다른 모듈 id를 쓰거나 한 테스트 안에서 이어서 봅니다.

## E2E (Playwright)

[WXT의 Playwright 예제](https://github.com/wxt-dev/examples/tree/main/examples/playwright-e2e-testing)와 같은 구성입니다. `bun run build`로 확장(`.output/chrome-mv3`)을 빌드한 뒤 `bun run e2e`가 `playwright.config.ts`로 돕니다.

```
e2e/
├─ fixtures.ts           # 영속 컨텍스트에 확장을 올리고 site·extensionId·storage·errors·listPage를 준다
├─ firefox.ts            # 파이어폭스에 확장을 임시 부가 기능으로 설치하고 배경 페이지에서 코드를 돌린다
├─ dcinside.ts           # 가짜 디시 (FakeSite: 목록·글·댓글·디시콘·갤로그, 받은 쓰기 요청과 목록 요청 수)
├─ pages/                # 페이지 객체 (list.ts의 openListPage, extension.ts의 openPopup·openOptions)
├─ live/                 # 실제 디시 E2E (bun run e2e:live)
└─ *.spec.ts             # list, preview, overlay, options, popup
```

- `fixtures.ts`가 [Playwright의 확장 테스트 방식](https://playwright.dev/docs/chrome-extensions)대로 확장을 올리고, 배경 서비스 워커에서 `extensionId`를 꺼냅니다. 프로필은 `launchPersistentContext("")`로 비워 두어 Playwright가 테스트마다 임시 프로필을 만들고 닫을 때 지웁니다. Playwright도 Node에서 돕니다(Bun에서는 테스트가 무작위로 멈춘다). 테스트는 `pages/`의 `openPopup(context, extensionId)` 같은 함수로 페이지를 열고 그 반환값으로 조작합니다.
- **디시에는 요청을 보내지 않습니다.** fixtures가 `dcinside.com` 주소를 모두 `e2e/dcinside.ts`의 가짜 목록·글·댓글로 응답하고, 흉내 낸 쓰기(댓글 작성·삭제, 디시콘 댓글)는 `site.submitted`에 모으고, 그 밖의 읽기가 아닌 요청에는 500을 줘서 테스트가 바로 실패합니다. 테스트는 `site` fixture로 가짜 디시의 행·댓글을 바꿉니다. IP DB 서버는 끊습니다(파이어폭스는 `context.route`가 배경 페이지 요청을 가로채지 못해 `e2e/firefox.ts`의 `OFFLINE_PREFS`가 없는 프록시로 보냅니다). 디시 마크업이 바뀌어 모듈을 고치면 가짜 페이지도 같이 고칩니다.
- 스펙은 선택자를 직접 쓰지 않고 페이지 객체를 씁니다. 목록 페이지(`openListPage`)는 `titles`·`replyCounts`·`writers` 같은 로케이터, 제목을 우클릭해 창을 여는 `openPreview(index)`와 오버레이 안의 `frame`·`mini`·`bubble`·`dialog`·`toast`를 주고, 팝업은 `openPopup(context, extensionId, tab)`로 그 탭에서 연 것처럼 엽니다. 설정은 `storage.setModules({...})`·`storage.setModuleSettings(id, {...})`로 넣습니다. 디시 마크업이나 클래스 이름이 바뀌면 페이지 객체만 고칩니다.
- `errors` fixture가 페이지 오류와 `console.error`를 모아 테스트 끝에 비어 있는지 봅니다. 모든 테스트에 자동으로 걸리므로(`auto`) 테스트에서 받지 않아도 됩니다. `listPage`는 콘텐츠 스크립트가 돈 목록 페이지(`pages/list.ts`), `storage`는 배경을 통한 확장 저장소입니다 (디시 페이지의 `page.evaluate`에서는 `chrome.storage`에 닿지 않습니다).
- **파이어폭스**(`bun run e2e:firefox`): Playwright의 파이어폭스는 실행 인자로 확장을 올릴 수 없어, `e2e/firefox.ts`가 web-ext처럼 원격 디버깅 서버(`-start-debugger-server`)에 붙어 `.output/firefox-mv2`를 임시 부가 기능으로 설치합니다. `storage`는 같은 디버깅 연결로 배경 페이지에서 식을 계산해(`evaluateJSAsync`) 읽고 씁니다. Playwright의 파이어폭스는 `moz-extension://` 페이지로 이동하지 못하므로(`page.goto`가 끝나지 않고, 확장이 연 탭도 잡지 못합니다) 팝업·옵션 테스트(`popup.spec.ts`, `options.spec.ts`)는 크로미엄에서만 돌고 파이어폭스는 콘텐츠 스크립트 테스트만 돕니다.
- **실제 디시**(`bun run e2e:live`, `e2e/live/`): 가짜 페이지 대신 실제 디시에 요청합니다. 글·댓글이 그때그때 달라 개수·내용이 아니라 모양만 봅니다. 픽스처(`routeLive`)가 디시·IP DB 서버 밖 요청(광고 등)과 읽기가 아닌 POST(댓글·추천·삭제 등)를 끊어 테스트가 디시에 아무것도 쓰지 않습니다. 디시 스크립트 오류는 빼고 확장에서 난 오류만 실패로 봅니다. 네트워크에 따라 흔들릴 수 있어 CI·릴리즈 워크플로에는 넣지 않았습니다. 기본은 미니 갤러리 `bjwg64`이고, `DC_LIST_URL`에 다른 갤러리의 PC 목록 주소를 주면 그 갤러리로 돕니다.
- 확장은 headless shell에 올라가지 않아 크로미엄 본체(`channel: "chromium"`)로 headless 실행합니다. 미리 설치된 크로미엄을 쓰려면 `PLAYWRIGHT_CHROMIUM=/경로/chrome`을 줍니다.
- 실패한 실행의 트레이스·리포트는 `test-results/`, `playwright-report/`에 남습니다 (git에 올리지 않습니다). CI·릴리즈 워크플로는 실패 때 이것을 아티팩트로 올립니다.

## 손으로 확인할 것

- **두 브라우저에서 모두 확인합니다.** 파이어폭스 E2E는 콘텐츠 스크립트만 봅니다. Chrome에서 되는 것이 Firefox에서 깨지는 일이 실제로 있었습니다([Firefox](firefox.md)). 콘텐츠 스크립트뿐 아니라 옵션·팝업·배경(알람, DB 갱신, 단축키, 우클릭 메뉴)도 봅니다.
- **디시에 쓰기 요청을 보내지 마세요.** 댓글·디시콘·추천·관리 요청은 실제로 반영됩니다. 브라우저 자동화로 실제 디시를 시험할 때는 쓰기 요청(댓글·디시콘·글자콘 작성, 댓글 삭제, 추천, 디시콘 추가 `/dccon/buy`, `*_manager_board_ajax` 관리 요청)을 가로채 막고, 읽기 요청(글·목록 GET과 댓글 목록 POST `/board/comment/`)만 보냅니다.
- **요청을 몰아 보내지 마세요.** 요청이 많으면 디시가 IP를 잠시 막습니다(빈 페이지). 반복 시험에는 저장해 둔 HTML을 요청 가로채기로 돌려주는 편이 안전합니다.
- 성능을 바꿨다면 바꾸기 전과 후를 같은 조건에서 여러 번 재서 비교합니다. 디시 페이지 자체의 스크립트가 유휴 중에도 CPU를 쓰므로 잡음이 큽니다.
