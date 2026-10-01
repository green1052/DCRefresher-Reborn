# 개발 문서

DCRefresher Reborn의 구조, 기능을 더하는 방법, 테스트와 릴리즈 절차를 정리한 문서입니다. 사용법은 [위키](https://github.com/green1052/DCRefresher-Reborn/wiki)를 보세요.

- [스택](#스택)
- [시작하기](#시작하기)
- [디렉터리](#디렉터리)
- [실행 흐름](#실행-흐름)
- [모듈 시스템](#모듈-시스템)
- [저장소](#저장소)
- [HTTP](#http)
- [Firefox에서 주의할 점](#firefox에서-주의할-점)
- [오버레이와 CSS](#오버레이와-css)
- [미리보기](#미리보기)
- [글 목록 새로고침](#글-목록-새로고침)
- [코드 규칙](#코드-규칙)
- [테스트](#테스트)
- [릴리즈](#릴리즈)
- [IP·밴 DB](#ip밴-db)

## 스택

| 항목 | 사용 |
|------|------|
| 확장 프레임워크 | [WXT](https://wxt.dev). Chrome은 MV3, Firefox는 MV2 (둘 다 최소 140) |
| UI | React 19 + React Compiler, [Radix Themes](https://www.radix-ui.com/themes) |
| 상태 | zustand |
| 저장소 | WXT storage (`wxt/utils/storage`) |
| HTTP | ky + p-limit |
| 캐시 | `utils/lru.ts`의 `LruCache` (Map으로 만든 작은 메모리 캐시. 콘텐츠 스크립트에 라이브러리를 싣지 않는다) |
| HTML 정화 | DOMPurify (`utils/sanitize.ts`) |
| 메시징 | @webext-core/messaging |
| 타입 도우미 | ts-extras (`objectKeys`, `objectEntries`, `arrayIncludes`) |
| 패키지 관리·실행 | Bun 1.4 이상 |
| 테스트 | Vitest (`wxt/testing/vitest-plugin`, fake-browser), Playwright (`e2e`) |

## 시작하기

```sh
bun install            # 의존성 설치 (postinstall이 wxt prepare로 .wxt 타입을 만든다)
bun run dev            # Chrome 개발 모드 (코드를 고치면 다시 빌드하고 확장을 새로 불러온다)
bun run dev:firefox    # Firefox 개발 모드
bun run compile        # 타입 검사 (tsc --noEmit)
bun run test           # 단위 테스트 (Vitest). test:watch는 지켜보며 다시 돈다
bun run e2e            # E2E (Playwright, 크로미엄에 확장을 올린다). 먼저 bun run build
bun run e2e:firefox    # 파이어폭스 E2E. 먼저 bun run build:firefox, 처음 한 번 bunx playwright install firefox
bun run build          # .output/chrome-mv3
bun run build:firefox  # .output/firefox-mv2
bun run zip            # 배포용 zip
bun run zip:firefox    # Firefox zip + 소스 zip
```

`tsconfig.json`은 `noUnusedLocals`, `noUnusedParameters`를 켜 둡니다. 커밋 전에 `bun run compile`, `bun run test`, `bun run build`가 통과해야 합니다. E2E(`bun run e2e`)는 먼저 `bun run build`로 확장을 빌드해야 하고, 처음 한 번 `bunx playwright install chromium`으로 크로미엄을 받아야 합니다 (headless shell이 아니라 크로미엄 본체여야 확장이 올라갑니다). 이 검사들은 릴리즈 워크플로(`.github/workflows/release.yml`)에서도 돌고, 실패하면 릴리즈하지 않습니다.

개발 모드는 따로 정하지 않으면 설치된 Chrome/Firefox를 새 임시 프로필로 띄웁니다. 다른 실행 파일이나 프로필을 쓰려면 저장소에 올리지 않는 `web-ext.config.ts`(`.gitignore`에 있음)를 만듭니다. 실행 파일은 `binaries`, 프로필은 `chromiumProfile`·`firefoxProfile`로 정하고, 프로필에 바뀐 내용을 남기려면 `keepProfileChanges: true`를 줍니다. Firefox 계열 브라우저(Zen 등)도 `firefox`에 그 실행 파일을 넣으면 됩니다. 평소 쓰는 기본 프로필을 그대로 쓰는 것은 권하지 않습니다(Chrome은 기본 사용자 데이터 폴더에서 원격 디버깅을 막습니다).

```ts
import {defineWebExtConfig} from "wxt";

export default defineWebExtConfig({
    binaries: {
        chrome: "C:/Program Files/Google/Chrome/Application/chrome.exe",
        firefox: "C:/Program Files/Mozilla Firefox/firefox.exe"
    }
});
```

개발 모드 없이 빌드 결과를 직접 올려 볼 수도 있습니다. Chrome은 `chrome://extensions`에서 개발자 모드를 켜고 **압축해제된 확장 프로그램을 로드합니다**로 `.output/chrome-mv3`를 고릅니다. Firefox는 `about:debugging#/runtime/this-firefox`의 **임시 부가 기능 로드**로 `.output/firefox-mv2/manifest.json`을 고릅니다. 개발 모드에서 확장을 다시 불러오는 단축키는 `Alt+Shift+R`입니다(`wxt.config.ts`의 `dev.reloadCommand`). 기본 키(`suggested_key`)가 있는 명령이 4개가 되면 WXT가 이 단축키를 넣지 않으니, 새 단축키에는 기본 키를 주지 않거나 이 점을 감안하세요.

## 디렉터리

```
entrypoints/
  background/       배경 스크립트. index.ts(단축키 전달, 설치·업데이트 처리, 배경 모듈 실행), page.ts(MAIN world 주입), database.ts(DB 갱신 알람), backup.ts(자동 백업)
  content/          콘텐츠 스크립트. 모듈 레지스트리 시작, 오버레이(shadow DOM) 마운트
  page.content.scss 디시 페이지에 입히는 CSS (manifest로 따로 주입)
  options/          옵션 페이지 (설정·차단·메모·단축키·데이터·정보·개발자 탭)
  popup/            팝업 (모듈 켜고 끄기, 현재 페이지 토글)
features/<id>/      기능 모듈 하나. meta.ts(이름·아이콘·설정 스키마), index.ts(콘텐츠), background.ts(배경, 선택), ui/(React, 선택)
modules/            WXT 로컬 모듈. 모듈 api 타입 생성(module-types.ts), 엔트리마다 Radix CSS 줄이기(slim-radix-css.ts)
core/               모듈 시스템, 저장소 키, HTTP, 필터링, 차단 판정, 미리보기 요청·파싱, 백업, DB, 마이그레이션
stores/             여러 화면이 같이 쓰는 zustand 스토어 (모듈 on/off·설정, 차단, 메모, 오버레이 UI)
components/         공용 React 컴포넌트, 오버레이 루트(components/overlay)
utils/              DOM·이벤트·정화(DOMPurify)·다크모드 등 작은 도우미
assets/styles/      페이지에 넣는 SCSS, 오버레이 CSS, Radix CSS 진입점 (radix-themes.css: 옵션·오버레이, radix-themes-popup.css: 팝업)
scripts/            IP DB 빌드 스크립트 (GitHub Actions의 DB 워크플로가 실행)
tests/              unit/(Vitest, 소스 경로를 따라 둔다), setup.ts(단위 테스트 공통 준비)
e2e/                Playwright E2E (가짜 디시 페이지, 페이지 객체 pages/, 파이어폭스 설치 firefox.ts)
```

`features/index.ts`가 `import.meta.glob("./*/index.ts")`로 모듈을, `features/meta.ts`가 `./*/meta.ts`로 모듈 메타를 모읍니다. 새 폴더를 만들면 목록에 따로 등록할 필요가 없습니다. 콘텐츠 스크립트만 `features/index.ts`를 쓰고, 옵션·팝업·`stores/modules.ts`는 `features/meta.ts`를 씁니다. setup이 쓰는 HTTP 클라이언트·캐시·DOM 코드가 옵션·팝업 번들에 딸려 가지 않게 하기 위해서입니다.

확장의 진입점, 공용 코드, 저장소, 외부 서버가 어떻게 이어지는지 한눈에 본 그림입니다. 실선은 호출·읽기·쓰기이고 점선은 `core/messaging/protocol.ts`의 메시지입니다.

```mermaid
flowchart LR
    subgraph EXT["외부"]
        DC["dcinside.com<br>페이지·ajax"]
        GH["dcrefresher.green1052.com<br>data 브랜치 (Cloudflare Pages)"]
    end

    subgraph ENTRY["entrypoints"]
        CS["콘텐츠 스크립트<br>content/index.tsx"]
        PCSS["page.content.scss"]
        BG["배경 스크립트<br>background/index.ts"]
        OPT["옵션 페이지"]
        POP["팝업"]
    end

    subgraph CORE["core · features · stores"]
        REG["모듈 레지스트리<br>core/module"]
        FEAT["기능 모듈<br>features/*/index.ts"]
        BGM["배경 모듈<br>features/*/background.ts"]
        OV["오버레이 shadow root<br>components/overlay"]
        PREV["미리보기 요청·파싱<br>core/preview"]
        HTTP["HTTP 클라이언트<br>core/http"]
        DB["IP·밴 DB<br>core/database.ts"]
        ST["zustand 스토어<br>stores/"]
    end

    subgraph STORE["저장소"]
        LOCAL["storage.local<br>core/storage/items"]
        SYNC["storage.sync<br>클라우드 백업"]
    end

    PCSS -->|"manifest로 주입"| DC
    CS -->|"loadAll · setup"| REG
    REG --> FEAT
    REG -->|"on/off·설정 읽기·감시"| LOCAL
    CS -->|"처음 필요할 때 띄움"| OV
    FEAT -->|"토스트 · 미리보기 UI"| OV
    FEAT --> PREV
    PREV --> HTTP
    FEAT --> HTTP
    HTTP -->|"http · ajax"| DC
    CS -->|"initDatabase"| DB
    BG -->|"알람 · 설치 때 갱신"| DB
    OPT -->|"지금 갱신"| DB
    DB -->|"updateDatabase (http)"| GH
    DB -->|"읽기 · 쓰기"| LOCAL
    FEAT --> ST
    OPT --> ST
    POP --> ST
    ST --> LOCAL
    OPT -->|"백업 · 복원"| SYNC
    BG -->|"자동 백업"| SYNC
    BG -->|"listen · apply"| BGM
    BGM -->|"설정 감시"| LOCAL
    BG -->|"MAIN world 주입<br>reCAPTCHA · 목록 스크립트"| DC
    BG -.->|"executeShortcut"| CS
    FEAT -.->|"grecaptchaToken · listReplaced<br>hookUploads · searchPosts"| BG
    POP -.->|"pageState · pageAction"| CS
```

## 실행 흐름

### 콘텐츠 스크립트

`entrypoints/content/index.tsx`가 디시 페이지(`core/pages.ts`의 `CONTENT_MATCHES`)에서 `document_start`에 실행됩니다.

1. Firefox가 재주입하며 남긴 옛 오버레이와 잠금을 걷어 내고, 단축키·팝업 메시지를 받을 준비를 합니다.
2. 저장소를 기다리기 전에, 확장이 업데이트되거나 꺼져 컨텍스트가 무효가 되면 모듈을 멈추는 처리를 겁니다. 확장이 정말 없어졌을 때만 새로고침 안내를 띄웁니다.
3. 오버레이는 바로 띄우지 않습니다. 토스트, 유저 버블, 미리보기처럼 화면에 그릴 것이 처음 생길 때 React와 오버레이 CSS를 불러와 띄웁니다. 글 제목에서 오른쪽 버튼을 누르는 순간에도 미리 띄워 첫 미리보기 창을 빨리 보이게 합니다.
4. 글 목록·본문 페이지(`BOARD_PAGE`)면 차단·메모 스토어를 읽기 시작하고, 동시에 모듈 on/off와 설정을 읽습니다(`core/module/registry.ts`의 `loadAll`). 모듈의 `setup`은 차단·메모를 다 읽은 뒤에 돕니다. 차례로 기다리면 저장소 왕복이 쌓여 모듈이 목록을 한참 읽은 뒤에야 뜹니다.
5. 글 목록·본문 페이지에서는 모듈을 다 불러온 뒤 가장 큰 IP DB를 읽습니다(`core/database.ts`의 `initDatabase`, userinfo가 켜져 있으면 그 setup이 먼저 부릅니다). 저장소는 요청 순서대로 읽히기 때문입니다. 밴 DB는 처음 조회할 때 읽습니다.

콘텐츠 스크립트가 뜰 때 도는 순서입니다. 점선은 조건이 생길 때만 도는 길이고, 글 목록·본문 페이지에서는 차단·메모 스토어와 모듈 on/off·설정을 동시에 읽은 뒤에 모듈 `setup`이 돕니다.

```mermaid
flowchart TD
    S["document_start<br>main 실행"] --> F{"refresher-root가 남아 있나<br>Firefox 재주입"}
    F -->|예| C["옛 오버레이 제거<br>스크롤·클릭 잠금·aria-hidden 해제<br>미리보기 history 되돌리기"]
    F -->|아니오| M
    C --> M["메시지 핸들러 등록<br>executeShortcut·pageState·pageAction"]
    M --> I["ctx.onInvalidated 등록<br>stopAll, 확장이 없어졌으면 안내<br>5초마다 무효화 검사"]
    I --> O["오버레이 지연 마운트 구독<br>useUiStore·usePreviewStore"]
    O -.->|"토스트·버블·메모<br>미리보기·우클릭 warm"| MO["DOM 준비 뒤 mountOverlay<br>React·CSS 불러와<br>shadow DOM에 마운트"]
    O --> K["임시 차단 경고 준비<br>setBlockedHandler·빈 페이지 검사"]
    K --> B{"BOARD_PAGE인가"}
    B -->|예| ST["initBlocksStore·initMemosStore<br>loadAll과 동시에 읽기"]
    B -->|항상| LA["loadAll<br>이 페이지 모듈만 거르기<br>on/off·모듈 설정 읽기"]
    ST -->|ready| SU
    LA --> SU["켜진 모듈 setup<br>BOARD_PAGE면 차단·메모를 다 읽은 뒤"]
    SU --> W["on/off·설정 감시(signal에 묶음)·bfcache 복귀 처리<br>on/off 한 번 더 맞춤"]
    W --> D{"BOARD_PAGE인가"}
    D -->|예| DB["initDatabase<br>IP DB 읽기"]
```

모듈은 이 문서를 불러온 주소(`core/http/urls.ts`의 `documentUrl`)로 판단합니다. 미리보기가 주소창을 글 주소로 바꿔도 페이지가 보여 주는 것은 그대로이기 때문입니다.

### 배경 스크립트

`entrypoints/background/index.ts`는 뜰 때마다 리스너와 배경 모듈의 `listen()`을 겁니다. 같은 폴더의 `page.ts`(탭의 페이지에서 대신 실행하는 것), `database.ts`(DB 주기 갱신), `backup.ts`(자동 백업)가 각자 리스너를 걸고, `index.ts`는 이것들을 부르고 설치·업데이트 처리를 합니다. 업데이트(`onInstalled`의 update) 때는 설정을 옮깁니다(v5 → v6은 5.x·6.0.2에서 올 때만, v6 안의 이름 변경은 매번). 이어서 배경 모듈을 맞추고 IP·밴 DB를 받습니다. 개발 빌드는 DB가 없을 때만 받고, DB 갱신 알람도 배포 빌드에서만 만듭니다. 자동 백업은 알람으로 돌립니다. 콘텐츠 스크립트가 요청하면 탭의 페이지 컨텍스트(MAIN world)에서 reCAPTCHA 토큰을 받거나 디시 목록 스크립트를 다시 돌립니다(`refresher:grecaptchaToken`, `refresher:listReplaced`). 글쓰기 모듈의 이미지 변환을 그 탭에 넣고(`refresher:hookUploads`), CORS를 열지 않는 디시 통합검색 결과를 대신 받아 줍니다(`refresher:searchPosts`, 관리 모듈의 같은 제목 찾기). Chrome은 서비스 워커라 언제든 멈췄다 다시 뜨므로, 전역 변수에 상태를 두지 말고 저장소에 둡니다.

## 모듈 시스템

### 모듈 정의

모듈은 두 파일로 나뉩니다. 옵션·팝업이 그리는 데 필요한 정보는 `features/<id>/meta.ts`에서 `defineModuleMeta`로, 페이지에서 하는 일은 `features/<id>/index.ts`에서 메타를 펼쳐 `defineModule`로 정의해 각각 default로 내보냅니다. 가장 작은 예는 `features/requests`입니다.

```ts
// meta.ts — 옵션·팝업·콘텐츠가 모두 불러오므로 React 컴포넌트(lucide 아이콘) 말고는 가벼운 것만 둔다
export default defineModuleMeta({
    id: "requests",            // 저장소 키에 쓰인다. 바꾸면 사용자 설정이 끊긴다
    name: "요청 제한",          // 옵션·팝업에 보이는 이름
    description: "…",
    icon: Gauge,               // lucide 아이콘
    // urls: [BOARD_PAGE],     // 이 주소에서만 실행 (core/pages.ts). 없으면 모든 디시 페이지, []면 어디서도 실행하지 않음
    // defaultEnable: false,   // 저장된 on/off가 없을 때(새로 설치했거나 업데이트로 새로 생긴 모듈) 꺼 둘 모듈

    settings: {
        concurrency: {type: "range", name: "동시 요청 수", desc: "…", default: 4, min: 1, max: 10, step: 1, unit: "개"}
    }
});

// index.ts — 콘텐츠 스크립트만 불러온다
export default defineModule({
    ...meta,

    setup(ctx) { setRequestConcurrency(ctx.settings.concurrency); },
    onChanged(ctx) { setRequestConcurrency(ctx.settings.concurrency); },
    revoke() { setRequestConcurrency(Number.POSITIVE_INFINITY); }
});
```

`meta.ts`에서 `settings`를 `satisfies SettingsSchema`로 따로 내보내면 `index.ts`의 도우미 함수가 `ModuleContext<typeof settings>`로 설정 타입을 이어 받습니다(아래 [컨텍스트](#컨텍스트-ctx)). 설정 스키마가 쓰는 상수(폰트 이름 만들기, 숨김 선택자 등)도 `meta.ts`에 두고 `index.ts`가 가져다 씁니다.

- **setup(ctx)**: 모듈이 켜진 페이지에서 실행됩니다. 돌려준 값은 그 모듈의 api가 되어 단축키·팝업 토글·다른 모듈이 받습니다.
- **revoke()**: 모듈을 끄면 실행됩니다. 페이지에 넣은 DOM·클래스·스타일을 되돌립니다.
- **onChanged(ctx, key)**: 켜져 있는 동안 설정이 바뀌면 바뀐 키마다 실행됩니다. `ctx.settings`는 늘 최신 값이므로, 설정을 쓸 때마다 읽는 모듈은 onChanged가 없어도 됩니다.
- 객체를 쓸 때 `setup`을 `shortcuts`, `pageToggles`보다 앞에 둡니다. TypeScript가 api 타입을 `setup`의 반환값에서 추론하기 때문입니다.

모듈 하나가 등록되고 켜지고 꺼지기까지의 흐름입니다. 단축키와 팝업 토글은 setup이 끝나 api가 준비된 모듈에만 전달되고, 끄면 signal을 먼저 abort한 뒤 revoke를 부릅니다.

```mermaid
flowchart TD
    A["loadAll(defs)"] --> B{"urls가 이 페이지와 맞나"}
    B -->|"아니오"| X["등록 안 함<br>설정도 읽지 않음"]
    B -->|"예"| C["register<br>설정이 있으면 읽고 watch"]
    C --> D{"켜져 있나<br>차단·메모 로드 뒤 판단<br>저장값 없으면 defaultEnable"}
    D -->|"아니오"| OFF["꺼진 채 대기"]
    D -->|"예"| S["start<br>AbortController·ctx 생성"]
    S --> SU["await setup(ctx)"]
    SU -->|"끝남·그사이 안 꺼짐"| R["ready<br>반환값을 api로 저장"]
    SU -->|"실패"| STOP
    R --> USE["단축키·pageToggles·getModuleApi<br>ready인 모듈만 받음"]
    C -.->|"설정 값 바뀜"| OC["실행 중이면<br>바뀐 키마다 onChanged(ctx, key)"]
    W["on/off 저장소 watch<br>+ 로드 끝에 1회<br>+ bfcache 복귀 시 설정 먼저 반영"] --> SY["sync<br>모듈마다 켜짐 여부 재확인"]
    SY -->|"켜짐"| S
    SY -->|"꺼짐"| STOP["stop<br>signal abort → 필터·addCleanup 해제"]
    STOP --> RV["revoke()<br>DOM·클래스·스타일 되돌림"]
    RV --> OFF
    INV["컨텍스트 무효화<br>stopAll"] --> AB["abort만<br>revoke 없이 페이지 그대로"]
```

### 컨텍스트 (ctx)

| 멤버 | 용도 |
|------|------|
| `settings` | 현재 설정값. 스키마에서 타입이 나온다 (check → boolean, range → number, option → 항목 키, order → 항목 키 배열) |
| `signal` | 이 실행의 AbortSignal. 모듈이 꺼지면 abort된다. `addEventListener`에 `{signal}`로 넘긴다 |
| `addFilter(selector, fn)` | 지금 있는 요소와 이후 추가되는 요소마다 `fn`을 실행한다 (core/filtering.ts의 MutationObserver 하나를 같이 쓴다) |
| `addCleanup(fn)` | signal을 받지 못하는 것(storage watch, zustand subscribe, 타이머)의 해제 함수를 등록한다 |

`addFilter`의 `fn`은 같은 요소에 여러 번 불릴 수 있습니다. 페이지를 읽는 동안 자식이 붙을 때마다 조상 필터가 다시 불리기 때문입니다. 넣은 요소가 이미 있는지 보고 건너뛰게 만드세요(글 목록 새로고침의 버튼이 예입니다).

모듈 안의 도우미 함수가 ctx를 받을 때는 설정 스키마를 상수로 빼서 타입을 이어 줍니다.

```ts
const settings = { … } satisfies SettingsSchema;
type Ctx = ModuleContext<typeof settings>;

const apply = (ctx: Ctx): void => { … ctx.settings.bodyFontSize … }; // number

export default defineModule({ …, settings, setup: apply });
```

### 설정 스키마

`core/module/types.ts`의 `SettingSchema`입니다. 옵션 페이지가 스키마만 보고 화면을 그립니다.

| type | 값 | 추가 필드 |
|------|----|-----------|
| `check` | boolean | |
| `text` | string | `placeholder` |
| `range` | number | `min`, `max`, `step`, `unit` |
| `option` | 항목 키 | `items: {키: 이름}` |
| `order` | 항목 키 배열 | `items`. 순서를 끌어서 바꾼다 |
| `color` | `#rrggbb` | |
| `key` | 키 하나 | 소문자 영문·숫자 |

같은 `group` 객체를 가진 설정은 옵션 화면에서 한 칸에 묶여 보입니다.

저장된 값은 읽을 때 스키마에 맞게 정리됩니다(`core/module/settings.ts`의 `normalizeSettings`). 타입이 틀리면 기본값을 쓰고, `range`는 `step` 단위로 맞춰 `min`~`max`로 자릅니다. 그래서 `range`의 기본값과 `max`는 `min`에서 `step`의 배수만큼 떨어진 값이어야 합니다. 스키마에서 사라진 설정과 없어진 모듈의 설정은 확장 페이지가 열릴 때 지워집니다(`stores/modules.ts`의 `pruneStaleSettings`). 설정 키 이름을 바꾸면 옛 값이 지워지므로 이전 코드를 같이 넣습니다([저장소](#저장소) 참고).

### 단축키와 팝업 토글

- **shortcuts**: `{명령 이름: (ctx, api) => …}`. 명령 이름은 `wxt.config.ts`의 manifest `commands`에 있어야 합니다. 배경 스크립트가 명령을 받아 탭으로 보내고, 레지스트리가 setup이 끝난 모듈에만 전달합니다.
- **pageToggles**: 팝업의 "현재 페이지"에 나오는 이 페이지 한정 토글입니다. 표시 정보(`id`, `label`, `icon`)는 `meta.ts`의 `toggles`에 두고(팝업이 아이콘을 여기서 찾습니다), `index.ts`의 `pageToggles`가 같은 객체를 펼쳐 `desc`(문자열 또는 `(api) => string`), `isOn(api)`, `toggle(api)`를 붙입니다. setup이 끝난 모듈의 토글만 보입니다.
  - 팝업은 처음 열 때와, 모듈 on/off 저장이 끝난 뒤에 탭에 상태를 묻습니다(`refresher:pageState`). 탭은 감시 알림을 기다리지 않고 저장소의 on/off를 직접 다시 읽어 맞춘 뒤, 시작하는 모듈의 setup이 끝나면 답합니다(`settledPageToggleStates`). 그래서 끈 모듈의 토글이 잠깐 남아 보이지 않습니다.

### 모듈 간 api

다른 모듈의 api는 `core/module/registry.ts`의 `getModuleApi(id)`로 받습니다. 그 모듈이 이 페이지에서 켜져 있고 setup이 끝났을 때만 값이 있습니다.

id와 api 타입은 따로 등록하지 않습니다. `defineModule`이 id 문자열과 `setup`의 리턴 타입을 타입에 남기고, WXT 로컬 모듈 `modules/module-types.ts`가 `features/*/index.ts`를 모아 `.wxt/types/modules.d.ts`에서 `ModuleApis`를 채웁니다(`bun install`·`dev`·`build`가 `wxt prepare`로 만듭니다). 그래서 `getModuleApi("`까지 치면 api를 내주는 모듈 id가 자동완성되고, 없는 id나 api가 없는 모듈을 넣으면 타입 오류가 납니다. 새 모듈을 만든 직후 자동완성에 안 나오면 `bunx wxt prepare`를 한 번 돌립니다.

```ts
// features/preview/index.ts — setup이 돌려주는 객체가 곧 api 타입이다
setup: (ctx): PreviewApi => ({archiveArticle: () => ctx.settings.archiveArticle, isOpen: () => usePreviewStore.getState().visible})

// features/refresh/index.ts
getModuleApi("preview")?.isOpen()
```

알림처럼 받는 쪽이 없어도 되는 신호도 이렇게 부릅니다. 받는 모듈이 꺼져 있으면 `?.`에서 끝납니다 (새로고침 → `getModuleApi("userinfo")?.checkNewPosts(rows)`, 미리보기 → `getModuleApi("refresh")?.reload()`).

### 확장 페이지 CSS 변수

모듈 설정이 옵션·팝업 화면에도 영향을 줘야 하면 `extensionPageVars(settings)`로 CSS 변수를 돌려줍니다. 모듈이 켜져 있을 때 옵션·팝업의 `<html>`에 들어갑니다. 폰트 교체 모듈이 `--refresher-font`를 이렇게 넘깁니다. 옵션·팝업 코드에 특정 모듈 이름을 적지 않기 위한 장치입니다.

### 배경 모듈

배경 스크립트에서 할 일(컨텍스트 메뉴 등)이 있으면 `features/<id>/background.ts`에서 `defineBackgroundModule`로 default 내보냅니다. `entrypoints/background/index.ts`가 glob으로 모아 실행합니다. `id`, `settings`, `defaultEnable`은 `index.ts`와 같아야 하므로 React 없는 파일(예: `features/imagesearch/engines.ts`)에 두고 양쪽에서 가져다 씁니다. `defaultEnable`이 다르면 옵션에서는 꺼져 있는데 배경은 켜진 것으로 봅니다.

- `listen()`: 배경이 뜰 때마다 동기로 실행됩니다. 서비스 워커를 깨울 이벤트 리스너는 여기서 겁니다.
- `apply({enabled, settings})`: 모듈을 켜고 끄거나 설정이 바뀔 때, 설치·브라우저 시작 때(Firefox는 배경이 뜰 때마다) 실행됩니다. 호출은 모듈마다 순서대로 한 번에 하나씩입니다.

배경 번들에는 React가 들어가면 안 됩니다. `background.ts`는 `index.ts`(아이콘·React import)를 불러오지 않고, 같이 쓰는 값은 React 없는 파일로 뺍니다. `features/imagesearch`가 예입니다. 페이지에서 할 일이 없는 모듈은 `index.ts`에 `urls: []`를 두어 디시 페이지에서 설정을 읽거나 감시하지 않게 합니다.

배경·옵션·팝업과 콘텐츠 스크립트가 같이 불러오는 파일(`core/`, `stores/` 등)은 모듈 최상위에서 페이지 전용 값을 계산하다 던지면 안 됩니다. 한 곳에서 던지면 그 번들 전체가 멈춥니다([Firefox에서 주의할 점](#firefox에서-주의할-점) 참고).

## 저장소

- 모든 키는 `core/storage/items.ts`에 모읍니다. `storage.defineItem`을 쓰고 직접 만든 저장소 래퍼는 두지 않습니다.
- `defineItem`은 만드는 순간 값을 한 번 읽습니다. 그래서 항목은 모듈 최상위가 아니라 처음 쓸 때 만듭니다(`items.ts`의 `lazyItem`·getter). 안 그러면 이 파일을 불러오는 모든 디시 페이지와 서비스 워커가 깰 때마다 쓰지도 않는 키를 십여 번 읽습니다.
- 읽기만 하는 곳은 항목을 만들지 않고 키로 읽고 감시합니다. 여러 키를 `storage.local.get` 한 번으로 읽고, 없는 값은 `null`이 오므로 받는 쪽이 기본값으로 맞춥니다. 항목은 쓸 때(`setValue`)와 옵션 페이지의 `useStorageItem`에서 씁니다.
  - 스토어처럼 키 여러 개를 읽고 따라가야 하면 `core/storage/sync.ts`의 `storageSync(keys, apply)`를 씁니다. 한 번에 읽고, 키마다 감시하고, bfcache에서 돌아오면 다시 읽습니다. 차단·메모·모듈 스토어가 이것을 씁니다.
  - 콘텐츠 스크립트의 감시는 `watchStorage(key, cb, signal)`로 컨텍스트의 signal에 묶습니다. 파이어폭스에서 스크립트가 다시 주입되면 이전 인스턴스가 남는데, 묶어 두면 그 인스턴스는 더 반응하지 않습니다.
  - 모듈 on/off와 설정은 `core/module/settings.ts`의 `readModuleStorage(ids)`로 읽고 `enablesOf`·`settingsOf`로 맞춥니다. 콘텐츠 레지스트리, 옵션·팝업 스토어, 배경 모듈이 같은 함수를 씁니다.
- 예외: IP·밴 DB(`DB_KEYS`)는 수백 KB라 항목을 아예 만들지 않습니다. 이 키는 쓰는 곳에서 `storage.getItem`·`storage.watch`로 다룹니다.
- 모듈 캐시(계속 불어나는 데이터)는 `moduleDataStorage(id, fallback)`로 만들되, 만드는 순간 값을 읽으므로 모듈 최상위가 아니라 `setup` 안에서 만듭니다. 이 키는 백업·내보내기와 자동 백업 대상에서 빠집니다. 개수 상한을 두세요 (글댓비 캐시는 500명).
- 백업 대상 판정은 `core/backup.ts`의 `isBackupTarget`입니다. 새 키가 백업되면 안 되는 성격(비밀번호, 다시 받을 수 있는 큰 데이터)이면 여기에 추가합니다. 클라우드 백업은 `storage.sync`의 용량(약 100KB)을 두 칸(수동·자동)이 나눠 씁니다.
- 차단 항목의 검사 방식(`mode`)이 비어 있으면 그 기기의 기본 차단 모드를 따릅니다. 그래서 차단 목록을 다른 기기로 옮기는 곳(데이터 탭 가져오기, 클라우드 합치기, 차단 탭 가져오기)은 내보낸 쪽의 기본 모드가 다르면 그 모드를 항목에 적어 둡니다. 새로 옮기는 경로를 만들 때도 같은 규칙을 따릅니다. v5 이전은 항목 대신 기본 모드(`refresher:block:defaults`)를 v5 값으로 맞춥니다(v5에서는 모든 유형이 '일치'였습니다).
- v5 사용자의 데이터는 업데이트 때와, 데이터 탭이 v5 백업을 가져오거나 복원할 때 `core/migrate-v5.ts`가 옮깁니다. v6 설정 키는 v5와 이름이 같습니다(`core/migrate-v5.ts` 머리 주석). 주석 표시는 미리보기 일부에만 있으니, 표시가 없어도 v5에 있던 설정 키는 이름을 바꾸지 마세요.
- v6 안에서 바뀐 설정(6.0.x의 `showIpInfo` 등)은 `core/migrate-settings.ts`에 변환 함수를 두고 세 곳에서 부릅니다. 배경의 `onInstalled`(update), `stores/modules.ts`의 `pruneStaleSettings`(정리하기 전), 데이터 탭이 쓰는 `core/settings-transfer.ts`의 `writeSettings`(복원·가져오기)입니다. 이전 코드는 여러 번 돌아도 결과가 같아야 합니다.
- 클라우드 복원·합치기, JSON 가져오기, 초기화가 저장소에 쓰는 규칙(지울 키, 합치는 방법, 기본 차단 모드 고정)은 `core/settings-transfer.ts`에 모여 있고 단위 테스트가 있습니다. `storage.local`을 직접 다루는 곳은 키 이름을 문자열로 적지 말고 `rawKey(MODULES_KEY)`처럼 `items.ts`의 키에서 만듭니다.

## HTTP

`core/http/client.ts`의 `http`(일반 요청)와 `ajax`(`X-Requested-With` 헤더를 붙인 디시 ajax 요청)를 씁니다.

- 두 클라이언트가 p-limit 하나를 같이 써서 합친 동시 요청 수를 제한합니다(ky 재시도 요청도 포함). 제한 값은 "요청 제한" 모듈 설정이고, 모듈이 꺼져 있거나 옵션·배경 페이지면 제한하지 않습니다. 탭마다 따로 셉니다.
- Firefox 콘텐츠 스크립트에서는 두 클라이언트 모두 `content.fetch`로 보냅니다. 페이지가 보낸 요청처럼 나가야 디시 ajax가 받아 줍니다.
- 시간 제한(15초)은 동시 요청 수 제한의 차례를 받은 뒤부터 잽니다. ky의 `timeout`은 `fetch`를 부르는 순간부터 재서 차례를 기다리는 시간까지 들어가므로 쓰지 않습니다(호출할 때도 주지 마세요). 시간 제한은 `AbortController`와 `setTimeout`으로 겁니다. `AbortSignal.timeout`은 Firefox 콘텐츠 스크립트에서 던집니다.
- 재시도는 ky 기본값(GET 같은 멱등 메서드만 최대 2번, 408·413·429·5xx 응답과 네트워크 오류)에 지터를 더하고, `Retry-After`는 최대 10초까지만 기다립니다. 15초 시간 초과와 `BlockedError`는 재시도하지 않고, 댓글 목록·쓰기 같은 POST도 재시도하지 않습니다. 자동 새로고침은 `retry: 0`으로 보내고, 실패하면 주기를 늘립니다.
- 요청이 너무 많으면 디시는 상태 코드 없이(200) 빈 페이지를 줍니다. 클라이언트는 dcinside.com의 GET 응답과 `/board/comment/` 아래 요청(댓글 목록·삭제)이 비어 있을 때만 `BlockedError`를 던집니다. 다른 ajax POST는 성공 응답도 비어 있을 수 있어 검사하지 않습니다. 콘텐츠 스크립트가 1분에 한 번 안내를 띄우므로, 기능 쪽에서는 `e instanceof BlockedError`일 때 자기 오류 토스트를 건너뜁니다(`utils/notify.ts` 참고).
- 갤러리 종류는 `core/http/urls.ts`의 `galleryKind(url)`(`"normal" | "minor" | "mini" | "person"`)로 다룹니다. 주소 경로(`mgallery/` 등)와 요청의 `_GALLTYPE_` 값(`G`·`M`·`MI`·`PR`)은 같은 파일의 표에만 두고, 주소·요청을 만들 때 `galleryPath`·`galltypeOf`로 꺼냅니다.
- 폼 본문은 `formBody({...})`로 만듭니다. 값이 `null`·`undefined`·`false`인 필드는 빠지고, 빈 문자열은 들어갑니다. CSRF 토큰(`ci_t`)이 붙는 디시 요청은 `csrfBody({...})`(`utils/cookie.ts`)를 씁니다. 끊은 요청인지는 `isAbortError(e)`로 봅니다.

## Firefox에서 주의할 점

Chrome에서만 시험하면 드러나지 않는 문제가 있습니다. 6.0.2에서는 아래 항목 중 첫째(`AbortSignal.timeout`)와 셋째(확장 페이지의 내비게이션 항목 이름)가 Firefox에서만 깨졌습니다. Firefox 쪽도 꼭 실행해 보세요([테스트](#테스트)).

- **콘텐츠 스크립트의 전역은 창(Window)이 아니라 샌드박스입니다.** 창이 있어야 하는 정적 API는 던집니다. 예를 들어 `AbortSignal.timeout()`은 "Could not find window"로 던져 모든 요청이 실패했습니다. `AbortController`와 `setTimeout`처럼 창이 없어도 되는 방법을 씁니다. `AbortSignal.any`, `AbortSignal.abort`는 괜찮습니다.
- **페이지 쪽 객체는 다른 영역(compartment)에서 옵니다.** `content.fetch`의 응답과 오류, `event.detail` 같은 값은 `instanceof`가 틀릴 수 있습니다. 오류는 `name`·`message`로 판단합니다(`isAbortError`, `utils/error.ts`의 `messageOf`).
- **확장 페이지(배경·옵션·팝업)의 내비게이션 항목 이름은 URL이 아니라 `"document"`입니다.** `performance.getEntriesByType("navigation")[0].name`을 `new URL()`에 그대로 넣으면 던져 배경·옵션·팝업이 통째로 멈췄습니다. 모듈 최상위에서 URL을 만들 때는 `URL.parse(...) ?? ...`처럼 던지지 않게 합니다.
- **MV2라 배경은 서비스 워커가 아니라 배경 페이지입니다.** 알람·메뉴·단축키는 두 브라우저에서 다 확인합니다.
- **Firefox 전용 API**는 `wxt/browser` 타입(Chrome 기준)에 없습니다. 지금은 `browser.commands.openShortcutSettings()` 한 곳이라 `// @ts-ignore`에 이유를 적어 두었습니다. 이런 곳이 늘어나면 그때 타입 선언을 추가합니다.

## 오버레이와 CSS

- 콘텐츠 스크립트는 `refresher-root` shadow DOM 안에 React 루트(`components/overlay/ContentRoot.tsx`)를 띄웁니다. 루트는 토스트(`Toasts.tsx`), 유저 버블(`UserBubble.tsx`), 메모 창(`MemoDialog.tsx`), 미리보기(`features/preview/ui/PreviewHost.tsx`)를 모아 그리기만 합니다. 디시 CSS와 Radix CSS가 서로 섞이지 않게 하기 위해서입니다. 포털은 `overlay.portal`입니다.
- 새 오버레이 UI(토스트·팝업 등)를 만들면 오버레이가 필요한지 판단하는 곳(`entrypoints/content/index.tsx`의 `needsOverlay`, 미리보기 UI는 `features/preview/ui/previewStore.ts`의 `needsPreviewOverlay`)에 넣어야 처음 띄울 때 오버레이가 생깁니다.
- 디시 페이지 자체를 바꾸는 CSS는 `assets/styles/content.scss`, `layout.scss`, `stealth.scss`입니다.
- 페이지·오버레이·옵션은 서로 다른 문서라 같은 규칙(차단 흐림, 스텔스 디시콘 가림, 접기 애니메이션)을 `assets/styles/_mixins.scss`의 mixin으로 맞춥니다. 옵션·팝업의 바탕과 Radix 기본값 덮기는 `_radix.scss`에 있습니다.
- 콘텐츠 스크립트는 `cssInjectionMode: "ui"`라서 불러오는 CSS(`radix-themes.css`, `overlay.scss`)가 오버레이를 처음 띄울 때 shadow에만 들어갑니다(WXT가 `:root`를 `:host`로 바꿈). 디시 페이지에 입히는 CSS(content·stealth·layout)는 `entrypoints/page.content.scss`로 따로 빌드되고, `wxt.config.ts`의 `manifest.content_scripts`가 콘텐츠 스크립트와 같은 주소(`core/pages.ts`의 `CONTENT_MATCHES`)에 넣습니다. 페이지용 CSS를 콘텐츠 스크립트에서 import하면 페이지가 아니라 오버레이에 들어갑니다.
- Radix CSS는 통째로 넣으면 엔트리마다 600KB라, 빌드 때 WXT 로컬 모듈 `modules/slim-radix-css.ts`가 엔트리(옵션·팝업·오버레이)마다 쓰지 않는 규칙을 뺍니다. 손으로 적는 목록은 없습니다. 그 엔트리에서 닿는 JS 청크에 든 `rt-*` 클래스 리터럴(트리 셰이킹으로 쓰는 컴포넌트 것만 남습니다)을 모아, 거기 없는 클래스의 규칙과 소스에서 쓰지 않는 반응형 접두어(`md:` 등)·`variant` 값·색 스케일·`@font-face`를 뺍니다. 새 Radix 컴포넌트나 반응형 prop을 쓰면 그대로 들어갑니다. 팝업은 옵션과 같은 CSS 파일을 import하면 Vite가 둘이 같이 쓰는 CSS 하나로 묶어 버리므로 `radix-themes-popup.css`를 따로 둡니다. 개발 서버(옵션·팝업 HMR)에서는 이 모듈이 돌지 않아 CSS가 통째로 들어갑니다.
- 다크모드는 Radix 문서 방식대로 `Theme`에 `appearance`를 넘기지 않고 조상의 `light`/`dark` 클래스로 바꿉니다(`utils/appearance.ts`). 옵션·팝업은 시스템 설정을, 오버레이는 디시 다크모드를 오버레이 최상위 요소(shadow 안의 컨테이너)에 옮깁니다. 스크롤바·폼 컨트롤도 따라가도록 같은 요소에 `color-scheme`을 같이 정합니다.
- `radix-themes.css`는 색 파일을 `base.css`보다 먼저 불러옵니다. 순서가 바뀌면 gray가 slate가 아닌 순수 회색이 됩니다.
- 설정값을 오버레이 CSS에 넘길 때는 `<html>`에 CSS 변수를 둡니다. 커스텀 속성은 shadow 경계를 넘어 상속됩니다(폰트 교체의 `--refresher-preview-font-size`가 예).

## 미리보기

`features/preview`가 가장 큰 모듈입니다.

| 파일 | 역할 |
|------|------|
| `index.ts` | 모듈 정의, 글·댓글 요청 흐름, 관리·차단 키, 주소창 기록 |
| `rows-input.ts` | 목록 행·제목 칸의 마우스 입력 (우클릭·길게 누르기·키 반전 좌클릭) |
| `mini.ts` | 미니 미리보기(제목 호버 카드)의 타이머·대상 |
| `rows.ts` | 목록 행 → 미리보기 대상(`GalleryPreData`), 앞·뒤 글 찾기 |
| `ui/previewStore.ts` | 미리보기 창 상태 (zustand) |
| `meta.ts` | 모듈 메타(이름·아이콘)와 설정 스키마 |
| `ui/Frame.tsx` | 창 (머리, 본문, 댓글 칸, 휠로 넘기기) |
| `ui/Votes.tsx`, `ErrorBlock.tsx`, `CountDown.tsx`, `fitMovies.ts`, `gifVideos.ts` | 추천 버튼, 오류 안내, 자동 삭제 카운트다운, 디시 동영상 iframe 크기 맞추기, 깨진 디시콘·움짤 mp4를 gif로 바꾸기 |
| `ui/CommentList.tsx`, `Comment.tsx`, `WriteComment.tsx` | 댓글 목록(답글 접기), 댓글 하나, 댓글 쓰기 |
| `ui/UserCard.tsx`, `TimeStamp.tsx` | 작성자 표시(배지·유저 버블), 상대 시각(공용 시계)과 `useTick`. 글 머리와 댓글이 같이 쓴다 |
| `ui/PreviewHost.tsx` | 미리보기 UI 최상위 (Frame·Popups·Mini) |
| `ui/Popups.tsx`, `Mini.tsx`, `DcconPopup.tsx` | 관리 패널·차단 팝업, 미니 미리보기, 디시콘 고르기 |
| `ui/DcconInfoPopup.tsx` | 본문·댓글 디시콘을 눌렀을 때 뜨는 디시콘 정보 창(패키지 보기, 패키지 추가, 우클릭 차단) |
| `nonmember.ts` | 비회원 닉네임·비밀번호 (디시 localStorage를 같이 씀) |
| `core/preview/request.ts` | 글·댓글 요청, 댓글 쓰기, 관리 요청, 디시콘 패키지 정보·추가 |
| `core/preview/parser.ts` | 글 HTML 파싱 (DOMParser) |
| `core/preview/comments.ts` | 댓글 정리, 차단·같은 댓글 접기, 삭제된 댓글 보존 |
| `core/preview/cache.ts` | 글·댓글 캐시 (1분, 50개) |
| `core/preview/types.ts` | `GalleryPreData`·`PostInfo`·댓글 타입 |

글을 여는 흐름은 이렇습니다.

1. 캐시에 없는 글이고 목록 행에 댓글 수가 보이면, 본문 요청과 함께 댓글 목록도 요청합니다. 댓글 토큰(`e_s_n_o`)은 갤러리마다 같아서 목록 페이지의 값을 쓰고, 본문을 읽은 뒤 그 글의 토큰·댓글 번호와 맞을 때만 결과를 씁니다. PageUp/PageDown이나 스크롤 끝 휠로 앞뒤 글로 넘길 때는 미리 요청하지 않습니다.
2. 캐시로 다시 연 글은 지난번 댓글 목록을 먼저 그리고, 새로 받은 목록이 같으면 다시 그리지 않습니다.
3. 댓글은 한 쪽에 100개씩 최대 10쪽을 받아 번호(등록)순으로 합칩니다. 디시 API는 1쪽에 가장 최근 댓글을 줍니다. 부모를 받지 못한 답글은 쓰레드 첫 댓글처럼 그립니다. 목록의 댓글 수로 쪽 수를 어림해 1쪽과 함께 요청하고, 1쪽의 쪽 나눔을 보고 모자란 쪽을 마저 받습니다.
4. 댓글을 그리는 곳(`pullComments`)은 순번으로 늦게 온 옛 목록이 새 목록을 덮지 않게 합니다. 댓글을 받는 새 경로를 만들 때는 이 함수 안에서 기다리게 합니다.

목록에서 글을 우클릭해 미리보기를 여는 순서입니다. 버튼을 누르는 동안 본문을 미리 받고, 연 뒤에는 댓글 요청을 본문 요청과 함께 보냅니다.

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자
    participant M as 미리보기 모듈
    participant C as 캐시
    participant S as 디시 서버
    participant W as 미리보기 창
    U->>M: 제목 우클릭 누름 (mousedown)
    opt 캐시에 없는 글
        M->>S: 본문 GET 미리 보내기 (requestPost)
    end
    M->>W: 오버레이 미리 띄우기 (warm)
    U->>M: 버튼 뗌 (contextmenu) → open()
    M->>W: 창 열기 (본문 받는 중)
    opt colorPreviewLink 켜짐
        M->>M: history.pushState 글 주소
    end
    par 댓글 미리 받기 (댓글 보이고 캐시에 없는 글)
        M->>S: 댓글 POST (목록 페이지의 e_s_n_o)
    and 본문 (load → getPost)
        M->>C: 캐시 확인 (받은 지 1분 안)
        alt 캐시에 없음
            M->>S: 본문 GET (미리 보낸 요청이면 그것을 기다림)
            S-->>M: 글 HTML → 파싱, 캐시에 저장
        end
    end
    M->>W: DOMPurify 정화 후 본문 그리기
    Note over M: pullComments
    opt 캐시로 연 글 (받은 지 2초 넘음)
        M->>W: 지난 댓글 목록 먼저 그리기
    end
    alt 방금 받은 본문의 댓글 0개, 보존 기록 없음
        M->>M: 요청 없이 빈 목록
    else 미리 받은 목록의 토큰·글 번호가 맞고 비어 있지 않음
        S-->>M: 미리 받은 댓글 목록
    else
        M->>S: fetchComments 100개씩 최대 10쪽, 번호순 합침
    end
    opt 삭제된 글과 댓글 보존 켜짐
        M->>C: 삭제 댓글 보존 (restoreArchive)
    end
    M->>W: 댓글 그리기
```

'주소창에 게시글 주소 표시'(`colorPreviewLink`, 기본 켜짐)가 켜져 있으면 미리보기가 글 주소를 기록에 쌓고, 닫을 때 쌓은 만큼 뒤로 갑니다. 브라우저 기록이 50개까지라 40칸이 넘으면 새로 쌓지 않고 바꿉니다. 뒤로·앞으로 가기로 미리보기 항목에 돌아왔는데 목록 문서가 bfcache에 없어 글 주소로 새로 불러오면(Firefox에서 잦음), 목록 주소로 바꿔 다시 불러온 뒤 그 글 미리보기를 엽니다. 새로고침(F5)은 글 페이지 그대로 둡니다.

본문 HTML은 `utils/sanitize.ts`에서 DOMPurify로 정화합니다. 재사용하는 `<template>`에서 `IN_PLACE`로 정화하는데, `<video>`가 든 DOMParser 문서는 Chrome에서 해제되지 않기 때문입니다. 파서도 같은 이유로 문서의 video·audio를 지우고 문서를 들고 있지 않습니다. 창을 닫거나 다음 글로 넘어가 문서에서 빠진 영상은 받기를 끊습니다(`gifVideos.ts`).

## 글 목록 새로고침

`features/refresh`는 목록을 받아 지금 목록 자리에 넣습니다.

- **자동 새로고침**은 목록 표만 파싱합니다. 받은 tbody가 지난번과 같으면 파싱도 하지 않습니다.
- 주소를 바꾸지 않은 로드(자동·단축키·관리 뒤 새로고침)는 검색 결과가 아니고 행 순서가 같거나 새 글이 한 자리(공지 아래)에 끼어든 것뿐이면 바뀐 행만 고칩니다(`list.ts`의 `insertionOf`). 조회·추천·댓글 수만 바뀐 행은 갈아끼우지 않고 숫자만 고칩니다. 그대로인 행은 hover·리스너가 남고 필터와 스타일 계산을 다시 하지 않습니다. '삭제된 글과 댓글 보존'이 켜져 있고 거르지 않은 1페이지(개념글·공지·말머리 목록이 아님)면 행 순서와 개수가 그대로일 때만 제자리에서 고칩니다. 그 밖에는 목록을 통째로 바꿉니다.
- **사용자가 한 로드**(단축키, 미리보기 관리·차단 뒤 새로고침, 페이지 번호 이동, 뒤로·앞으로 가기)와 검색 결과, 직전 요청이 실패한 다음 새로고침은 문서 전체를 파싱해 페이징 박스도 맞춥니다.
- 자동 새로고침을 건너뛰는 경우: 탭이 보이지 않을 때, 직전 새로고침 후 2초 안, 이전 요청을 받는 중일 때, 2페이지 이후, 미리보기가 열려 있을 때와 닫은 뒤 첫 주기, 목록 위에 마우스·포커스가 있을 때(설정), 사용자가 멈췄을 때(검색 결과는 설정에 따라 멈춘 채 시작). 관리 체크박스를 체크했거나 목록 행의 디시 유저 메뉴가 열려 있으면, 주소를 바꾸지 않는 로드는 단축키·관리 뒤 새로고침까지 건너뜁니다.
- 목록 요청이 실패하면(임시 차단과 목록 없는 응답 포함) 주기를 두 배씩 늘리고(최대 60초), 한 번 성공하면 원래 주기로 돌아갑니다. 실제 간격에는 0.5~2초가 무작위로 더해집니다.
- 미리보기가 쌓은 기록 사이를 뒤로·앞으로 가는 것은 같은 목록이라 다시 받지 않습니다.

목록을 한 번 받을 때의 흐름입니다. 자동 타이머와 사용자가 한 로드(force)는 거르는 조건이 다르고, 실패하면 다음 주기가 두 배씩 늘어납니다.

```mermaid
flowchart TD
    A["자동 타이머 주기<br>탭이 다시 보임, failures 0일 때"] --> C
    B["사용자 로드<br>단축키·페이지 이동·뒤로 가기·관리 뒤"] -->|"force"| C
    C{"로딩 중이거나<br>자동 로드인데 탭이 숨었나?"} -->|"예, 로딩 중 강제 로드면 rerun 표시"| SKIP
    C -->|"아니오"| D
    D{"자동 로드만 거름<br>2초 안·멈춤·2페이지 이후<br>미리보기 열림·닫은 뒤 첫 주기<br>목록 hover·focus 설정"} -->|"걸림"| SKIP
    D -->|"통과"| E
    E{"주소 안 바꾼 로드에서<br>관리 체크박스·유저 메뉴?"} -->|"예"| SKIP
    E -->|"아니오"| F["GET 목록<br>자동은 retry 0"]
    F -->|"요청 실패·임시 차단"| FAIL
    F -->|"주소 바뀜·요청 끊김: 버림"| Z
    F --> G{"tbody가 지난번과 같나?<br>주소 안 바꾼 로드만"}
    G -->|"예, failures 0"| SAME["교체 없이 끝"]
    G -->|"아니오"| K["파싱<br>자동·failures 0·검색 아님이면 tbody만<br>아니면 문서 전체, 페이징 박스도 맞춤"]
    K --> L{"지금 목록과 받은 목록이<br>둘 다 있나?"}
    L -->|"아니오"| FAIL
    L -->|"예, failures 0"| M{"insertionOf 제자리 가능?<br>이동·검색 아님<br>삭제 보존이면 순서·개수 같을 때"}
    M -->|"예"| N["바뀐 행만 고침"]
    M -->|"아니오"| O["목록 통째로 교체<br>삭제 보존이면 빠진 글 붉게 남김"]
    N --> P
    O --> P["listReplaced 메시지<br>페이지 넘김이면 목록 위로 스크롤<br>새 글 글댓비 조회(checkNewPosts)는 주소 안 바꾼 로드만"]
    FAIL["failures + 1<br>사용자 로드 실패면 오류 토스트<br>임시 차단은 HTTP 클라이언트가 알림"]
    P --> Z
    SAME --> Z
    FAIL --> Z
    Z["finally<br>주소가 바뀌었거나 rerun이면<br>강제로 다시 로드"] -.->|"다시 로드"| C
    Z --> Q
    SKIP["건너뜀"] --> Q
    Q["armNext<br>자동·뒤로 가기·관리 뒤 로드에서만<br>refreshRate × 2^failures, 최대 60초<br>+ 0.5~2초 무작위, 숨은 탭이면 안 걸음"] -.->|"다음 주기"| A
```

## 코드 규칙

- 반복은 `for...of`를 씁니다 (`forEach` 대신). catch 변수는 `e`, 이벤트 매개변수는 `ev`입니다.
- 브라우저 기본 기능, WXT 기능, 널리 쓰이고 관리가 잘 되는 라이브러리로 되면 직접 구현하지 않습니다. 라이브러리 코드는 패치하지 않습니다.
- 기능 하나를 고칠 때 여러 화면을 건드리지 않도록 모듈 구조를 따릅니다. 옵션·팝업은 모듈 정의(스키마, `extensionPageVars`, `pageToggles`)만 보고 그립니다.
- 타입은 정확하게 씁니다. 경계에서 `unknown`을 넘기거나 `as`로 덮지 말고 값을 검사해 좁힙니다.
- 주석은 한국어로, 코드만 봐서는 알 수 없는 이유(디시·브라우저 동작, 순서 제약, 성능 이유)를 적습니다.
- 커밋 메시지는 conventional commits(`feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `ci` …)를 따릅니다. 이슈 번호는 GitHub 이슈일 때만 적습니다.

## 테스트

### 단위 테스트 (Vitest)

`bun run test`. `vitest.config.ts`가 WXT의 `WxtVitest` 플러그인을 씁니다. `wxt.config.ts`의 vite 설정과 `@/` 별칭, `import.meta.env.BROWSER` 같은 전역을 맞추고, 확장 API(`browser.*`)를 [`@webext-core/fake-browser`](https://webext-core.aklinker1.io/fake-browser/installation)로 바꿉니다. 그래서 `storage.getItems`·`storage.watch`·`defineItem`이 인메모리 저장소로 그대로 돕니다. 저장소를 직접 넣을 때는 `fakeBrowser.storage.local.set({"refresher:modules": …})`처럼 `local:` 없는 키를 씁니다.

- 테스트는 `tests/unit/`에 소스 경로를 따라 둡니다 (`core/block.ts` → `tests/unit/core/block.test.ts`). `modules/`에 두면 WXT가 WXT 모듈로 불러오므로 소스 옆에 두지 않습니다.
- `tests/setup.ts`가 테스트마다 `fakeBrowser.reset()`을 하고, jsdom·Node에 없는 API(`Uint8Array.toBase64`, `performance.getEntriesByType`, `CSS.escape` 등)를 채웁니다. 실제 브라우저(140 이상)에는 다 있는 것들이라 소스는 그대로 둡니다.
- 기본 환경은 jsdom입니다. DOM을 안 쓰고 jsdom이 방해하는 모듈(`core/backup`의 gzip)은 파일 머리에 `// @vitest-environment node`를 둡니다.
- WXT의 `#imports`를 mock할 때는 실제 경로(`wxt/utils/storage` 등)로 합니다. `.wxt/types/imports-module.d.ts`에 있습니다.
- 모듈 레지스트리·스토어처럼 모듈 단위 싱글턴(`instances`, `once`)이 있는 코드는 테스트마다 다른 모듈 id를 쓰거나 한 테스트 안에서 이어서 봅니다.

### E2E (Playwright)

[WXT의 Playwright 예제](https://github.com/wxt-dev/examples/tree/main/examples/playwright-e2e-testing)와 같은 구성입니다. `bun run build`로 확장(`.output/chrome-mv3`)을 빌드한 뒤 `bun run e2e`가 `playwright.config.ts`로 돕니다.

```
e2e/
├─ fixtures.ts           # 영속 컨텍스트에 확장을 올리고 background·extensionId·storage·errors·listPage를 준다
├─ firefox.ts            # 파이어폭스에 확장을 임시 부가 기능으로 설치한다
├─ dcinside.ts           # 가짜 디시 목록·글·댓글
├─ pages/                # 페이지별 조작 (openPopup, openOptions, openListPage)
└─ *.spec.ts             # popup, options, content-script
```

- `fixtures.ts`가 [Playwright의 확장 테스트 방식](https://playwright.dev/docs/chrome-extensions)대로 확장을 올리고, 배경(MV3 서비스 워커, MV2 배경 페이지)에서 `extensionId`를 꺼냅니다. 테스트는 `pages/`의 `openPopup(page, extensionId)` 같은 함수로 페이지를 열고 그 반환값으로 조작합니다.
- **디시에는 요청을 보내지 않습니다.** fixtures가 `dcinside.com` 주소를 모두 `e2e/dcinside.ts`의 가짜 목록·글·댓글로 응답하고, 읽기가 아닌 POST에는 500을 줘서 쓰기 요청이 나가면 테스트가 바로 실패합니다. IP DB 서버는 끊습니다. 디시 마크업이 바뀌어 모듈을 고치면 가짜 페이지도 같이 고칩니다.
- `errors` fixture가 페이지 오류와 `console.error`를 모아 테스트 끝에 비어 있는지 봅니다. `listPage`는 콘텐츠 스크립트가 돈 목록 페이지(`pages/list.ts`), `storage`는 배경을 통한 확장 저장소입니다 (디시 페이지의 `page.evaluate`에서는 `chrome.storage`에 닿지 않습니다).
- **파이어폭스**(`bun run e2e:firefox`): Playwright의 파이어폭스는 실행 인자로 확장을 올릴 수 없어, `e2e/firefox.ts`가 web-ext처럼 원격 디버깅 서버(`-start-debugger-server`)에 붙어 `.output/firefox-mv2`를 임시 부가 기능으로 설치합니다. 확장 UUID는 `extensions.webextensions.uuids`로 고정해 `moz-extension://` 주소를 미리 압니다. 배경 페이지에는 닿을 수 없어 `storage`는 확장 페이지(`popup.html`)를 하나 열어 그 안에서 읽고 씁니다. 릴리즈 워크플로는 아직 크로미엄만 돌립니다.
- 확장은 headless shell에 올라가지 않아 크로미엄 본체(`channel: "chromium"`)로 headless 실행합니다. 미리 설치된 크로미엄을 쓰려면 `PLAYWRIGHT_CHROMIUM=/경로/chrome`을 줍니다.
- 실패한 실행의 트레이스·리포트는 `test-results/`, `playwright-report/`에 남습니다 (git에 올리지 않습니다). 릴리즈 워크플로는 실패 때 이것을 아티팩트로 올립니다.

### 손으로 확인할 것

- **두 브라우저에서 모두 확인합니다.** 자동화 테스트는 크로미엄에서만 돕니다. Chrome에서 되는 것이 Firefox에서 깨지는 일이 실제로 있었습니다([Firefox에서 주의할 점](#firefox에서-주의할-점)). 콘텐츠 스크립트뿐 아니라 옵션·팝업·배경(알람, DB 갱신, 단축키, 우클릭 메뉴)도 봅니다.
- **디시에 쓰기 요청을 보내지 마세요.** 댓글·디시콘·추천·관리 요청은 실제로 반영됩니다. 브라우저 자동화로 실제 디시를 시험할 때는 쓰기 요청(댓글·디시콘·글자콘 작성, 댓글 삭제, 추천, 디시콘 추가 `/dccon/buy`, `*_manager_board_ajax` 관리 요청)을 가로채 막고, 읽기 요청(글·목록 GET과 댓글 목록 POST `/board/comment/`)만 보냅니다.
- **요청을 몰아 보내지 마세요.** 요청이 많으면 디시가 IP를 잠시 막습니다(빈 페이지). 반복 시험에는 저장해 둔 HTML을 요청 가로채기로 돌려주는 편이 안전합니다.
- 성능을 바꿨다면 바꾸기 전과 후를 같은 조건에서 여러 번 재서 비교합니다. 디시 페이지 자체의 스크립트가 유휴 중에도 CPU를 쓰므로 잡음이 큽니다.

## 릴리즈

1. develop에서 `package.json`의 `version`을 올리고 `chore(release): X.Y.Z`로 커밋합니다.
2. release 브랜치에 develop을 머지 커밋(`Merge X.Y.Z into release`)으로 합치고 push합니다.
3. 버전 커밋에 `X.Y.Z` 태그를 만들어 push합니다.

태그를 push하면 `.github/workflows/release.yml`이 돕니다.

1. 태그와 `package.json` 버전이 같은지 확인하고, 타입 검사·단위 테스트를 하고, zip을 만든 뒤 E2E 테스트를 돌립니다. 하나라도 실패하면 릴리즈하지 않습니다. 모두 통과하면 zip을 GitHub 릴리즈에 올립니다.
2. Chrome 웹 스토어와 Firefox Add-ons에 함께 제출합니다. 한 스토어가 실패해도 다른 스토어는 끝까지 제출되고, 이 단계는 실패해도 넘어가므로(`continue-on-error`) DB는 막히지 않습니다.
3. DB 워크플로가 이 태그의 코드로 IP·밴 DB를 새로 만듭니다([IP·밴 DB](#ip밴-db)).

실패한 스토어는 그 단계의 로그에서 원인을 확인하고, 그 스토어만 따로 제출합니다(`.env.submit` 필요).

- Chrome: GitHub 릴리즈의 zip으로 `bunx wxt submit --chrome-zip <zip>`.
- Firefox: 소스 zip도 함께 내야 하므로 태그를 체크아웃해 `bun run zip:firefox`로 다시 만든 뒤 `bunx wxt submit --firefox-zip <zip> --firefox-sources-zip <sources zip>`.
- Chrome 웹 스토어는 심사 중인 버전이 있으면 새 버전을 올릴 수 없습니다. 심사가 끝난 뒤 GitHub 릴리즈의 zip으로 제출하거나, 다음 버전을 기다립니다. `CHROME_CANCEL_PENDING`으로 심사를 취소하고 올릴 수도 있지만 심사를 처음부터 다시 받습니다.

Chrome 웹 스토어는 API v2(서비스 계정)로 제출합니다. 인증은 한 번만 만들어 두면 됩니다.

1. `bunx wxt submit init`에서 Chrome Web Store와 `v2`를 고르고, 안내대로 서비스 계정을 만들어 확장 ID·게시자 ID·`client_email`·`private_key`를 넣습니다. 값은 `.env.submit`에 저장됩니다. 다시 실행하면 이전 값은 `.env.submit.backup-*`로 남습니다(둘 다 커밋하지 않습니다).
2. 저장소 시크릿 `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`를 `.env.submit`의 값으로 추가합니다. 비공개 키는 `\n`이 아니라 실제 줄바꿈이 든 여러 줄(`-----BEGIN PRIVATE KEY-----`부터)로 넣습니다.
3. Chrome 웹 스토어 개발자 대시보드의 **게시자 → 설정**에서 서비스 계정 이메일(`client_email`)을 서비스 계정으로 추가합니다. 빠지면 제출이 `PERMISSION_DENIED`로 실패합니다. 게시자마다 서비스 계정은 하나만 등록할 수 있습니다.

Firefox는 `FIREFOX_EXTENSION_ID`(`wxt.config.ts`의 gecko ID `dcrefresher-reborn@green1052`)와 `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET`(AMO API 키) 시크릿을 씁니다.

## IP·밴 DB

릴리즈 태그부터 확장이 IP·밴 DB를 저장하기까지의 흐름입니다. DB 워크플로는 릴리즈가 부를 때 말고도 수·토요일 예약과 수동 실행으로도 돌고, 확장은 `data` 브랜치를 Cloudflare Pages로 배포한 `dcrefresher.green1052.com`에서 파일을 받습니다.

```mermaid
flowchart TD
    A["develop: 버전 커밋<br>chore(release): X.Y.Z"] --> B["release 브랜치에 머지"]
    B --> C["X.Y.Z 태그 push"]

    subgraph REL["release.yml"]
        R1["태그·package.json 버전 확인<br>타입 검사·단위 테스트"] --> R2["zip 빌드·E2E<br>GitHub 릴리즈"]
        R2 --> R3["Chrome·Firefox 스토어 제출<br>continue-on-error"]
    end
    C --> R1

    subgraph DBW["db.yml"]
        D0["체크아웃<br>태그 또는 release 브랜치"] --> D1["data 브랜치의 ban.json 가져오기"]
        D1 --> D2["build-db.ts<br>MaxMind·VPN 목록·KISA"]
        D2 --> D3["data 브랜치에<br>force-with-lease push"]
    end
    R3 -->|"db 작업, workflow_call"| D0
    CRON["수·토 예약 / 수동 실행"] --> D0

    subgraph EXT["확장 배경 스크립트"]
        E1["설치·업데이트<br>onInstalled"] --> U["updateDatabase"]
        E2["하루 한 번 알람"] --> E3{"7일 지남 또는<br>저장 형식 다름?"}
        E3 -->|"예"| U
        U --> V{"version 파일이 같고<br>형식도 같음?"}
        V -->|"예"| T["확인 시각만 갱신"]
        V -->|"아니오"| G["ip.json·ban.json 받아<br>검사 후 저장소에 저장"]
    end
    D3 -.->|"Cloudflare Pages<br>dcrefresher.green1052.com"| U
```

`.github/workflows/db.yml`이 매주 수·토요일과 릴리즈 때 `scripts/build-db.ts`로 만들어 `data` 브랜치에 올립니다. 수동으로도 돌릴 수 있습니다(Actions → DB → Run workflow).

- 예약·수동 실행은 release 브랜치(배포된 코드)로, 릴리즈 때는 그 태그로 만듭니다. develop으로 만들지 않는 것은 형식을 바꾼 코드가 릴리즈 전에 올라가지 않게 하려는 것입니다.
- `ip.json`은 확장이 저장하는 형식(`core/ipdb.ts`의 `CompactIpData`) 그대로이고 버전(UTC, 분까지)을 담고 있습니다. `ban.json`은 `data` 브랜치에서 손으로 관리하며, 워크플로가 가져와 검사·정리합니다.
- Cloudflare Pages가 `data` 브랜치를 `dcrefresher.green1052.com`으로 배포합니다(빌드 명령 없음, 출력 `/`). push할 때마다 자동으로 다시 배포됩니다. 6.0.3 이하는 `raw.githubusercontent.com`에서 받으므로 GitHub `data` 브랜치 게시는 계속 유지합니다.
- CORS와 캐시 헤더는 `data` 브랜치의 `_headers` 파일로 줍니다. `ban.json`처럼 손으로 관리하고, 워크플로가 가져와 그대로 다시 올립니다. 확장은 호스트 권한 없이 받으므로 CORS를 열고, `version`은 새 DB를 빨리 알아채게 짧게(5분), `ip.json`·`ban.json`은 버전이 바뀔 때만 받으니 길게(1시간) 캐시합니다. 둘이 잠깐 어긋나도 `core/database.ts`가 처리합니다.
- `data` 브랜치는 커밋 하나로 유지합니다. 빌드가 도는 사이 `data`가 바뀌었으면(ban.json 수정 등) 덮어쓰지 않고 실패합니다.
- 확장은 설치·업데이트 때 받고, 이후에는 하루 한 번 울리는 알람에서 마지막 확인이 7일을 넘었거나 저장 형식이 다를 때 확인합니다(`entrypoints/background/index.ts`). 확인할 때는 `data` 브랜치의 `version` 파일을 먼저 받아 저장된 버전과 비교하고, 다를 때만 `ip.json`·`ban.json`을 받습니다(`core/database.ts`의 `updateDatabase`). 옵션 데이터 탭의 '지금 갱신'은 같은 버전이어도 다시 받습니다. 받은 파일이 깨졌거나 형식이 다르면 저장하지 않고 갖고 있던 DB를 씁니다.

IP DB 형식(`IP_FORMAT`)을 바꾸면 옛 확장은 새 `ip.json`을 읽지 못하고, 새 확장은 옛 `ip.json`을 받지 않습니다. 릴리즈가 제출 직후 새 형식으로 DB를 만들므로, 심사를 거쳐 새 확장이 설치될 때는 `data` 브랜치가 이미 새 형식입니다. 대신 심사 중에는 옛 확장이 새 파일을 읽지 못해 갖고 있던 DB를 그대로 씁니다. 두 스토어의 심사 시점이 달라 한동안 옛 버전과 새 버전이 섞이므로, 형식은 꼭 필요할 때만 바꿉니다. 형식을 바꾼 릴리즈에서 DB 작업이 돌지 않았다면(6.0.2처럼) 새 버전 사용자는 IP 정보를 받지 못하니, 바로 DB 워크플로를 수동으로 돌립니다.
