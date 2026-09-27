# 개발 문서

DCRefresher Reborn v6의 구조와 기능을 더하는 방법을 정리한 문서입니다. 사용법은 [위키](https://github.com/green1052/DCRefresher-Reborn/wiki)를 보세요.

## 스택

| 항목 | 사용 |
|------|------|
| 확장 프레임워크 | [WXT](https://wxt.dev) — Chrome은 MV3, Firefox는 MV2 |
| UI | React 19 + React Compiler, [Radix Themes](https://www.radix-ui.com/themes) |
| 상태 | zustand |
| 저장소 | WXT storage (`wxt/utils/storage`) |
| HTTP | ky + p-limit |
| 모듈 간 이벤트 | emittery |
| 메시징 | @webext-core/messaging |
| 타입 도우미 | ts-extras (`objectKeys`, `objectEntries`, `arrayIncludes`) |
| 패키지 관리·실행 | Bun 1.4 이상 |

## 명령

```sh
bun install            # 의존성 설치 (postinstall이 wxt prepare로 .wxt 타입을 만든다)
bun run dev            # Chrome 개발 모드 (자동 새로고침)
bun run dev:firefox    # Firefox 개발 모드
bun run compile        # 타입 검사 (tsc --noEmit)
bun run build          # .output/chrome-mv3
bun run build:firefox  # .output/firefox-mv2
bun run zip            # 배포용 zip
bun run zip:firefox    # Firefox zip + 소스 zip
```

`tsconfig.json`은 `noUnusedLocals`, `noUnusedParameters`를 켜 둡니다. 커밋 전에 `bun run compile`과 `bun run build`가 통과해야 합니다.

## 디렉터리

```
entrypoints/
  background/     배경 스크립트 — 단축키 전달, DB 갱신 알람, 배경 모듈 실행
  content/        콘텐츠 스크립트 — 모듈 레지스트리 시작, 오버레이(shadow DOM) 마운트
  options/        옵션 페이지 (설정·차단·메모·단축키·데이터·정보·개발자 탭)
  popup/          팝업 (모듈 켜고 끄기, 현재 페이지 토글)
features/<id>/    기능 모듈 하나 — index.ts(콘텐츠), background.ts(배경, 선택), ui/(React, 선택)
core/             모듈 시스템, 저장소 키, HTTP, 필터링, 차단 판정, 미리보기 요청·파싱, 백업, DB
stores/           여러 화면이 같이 쓰는 zustand 스토어 (모듈 on/off·설정, 차단, 메모, 오버레이 UI)
components/       공용 React 컴포넌트, 오버레이 루트(components/overlay)
utils/            DOM·이벤트·정화(DOMPurify) 등 작은 도우미
assets/styles/    페이지에 넣는 SCSS, 오버레이 CSS, Radix CSS 진입점
scripts/          IP DB 빌드 스크립트 (GitHub Actions의 DB 워크플로가 실행)
```

`features/index.ts`가 `import.meta.glob("./*/index.ts")`로 모듈을 모읍니다. 새 폴더를 만들면 목록에 따로 등록할 필요가 없습니다.

## 모듈 시스템

### 모듈 정의

모듈은 `defineModule`로 정의해 `features/<id>/index.ts`에서 default로 내보냅니다. 가장 작은 예는 `features/requests/index.ts`입니다.

```ts
export default defineModule({
    id: "requests",            // 저장소 키에 쓰인다. 바꾸면 사용자 설정이 끊긴다
    name: "요청 제한",          // 옵션·팝업에 보이는 이름
    description: "…",
    icon: Gauge,               // lucide 아이콘
    // urls: [BOARD_PAGE],     // 이 주소에서만 실행 (core/pages.ts). 없으면 모든 디시 페이지
    // defaultEnable: false,   // 처음 설치했을 때 꺼 둘 모듈

    settings: {
        concurrency: {type: "range", name: "동시 요청 수", desc: "…", default: 4, min: 1, max: 10, step: 1, unit: "개"}
    },

    setup(ctx) { setRequestConcurrency(ctx.settings.concurrency); },
    onChanged(ctx, key) { setRequestConcurrency(ctx.settings.concurrency); },
    revoke() { setRequestConcurrency(Number.POSITIVE_INFINITY); }
});
```

- **setup(ctx)**: 모듈이 켜진 페이지에서 실행됩니다. 돌려준 값은 그 모듈의 api가 되어 단축키·팝업 토글·다른 모듈이 받습니다.
- **revoke()**: 모듈을 끄면 실행됩니다. 페이지에 넣은 DOM·클래스·스타일을 되돌립니다.
- **onChanged(ctx, key)**: 켜져 있는 동안 설정이 바뀌면 바뀐 키마다 실행됩니다. `ctx.settings`는 늘 최신 값이므로, 설정을 쓸 때마다 읽는 모듈은 onChanged가 없어도 됩니다.
- 객체를 쓸 때 `setup`을 `shortcuts`, `pageToggles`보다 앞에 둡니다. TypeScript가 api 타입을 `setup`의 반환값에서 추론하기 때문입니다.

### 컨텍스트 (ctx)

| 멤버 | 용도 |
|------|------|
| `settings` | 현재 설정값. 스키마에서 타입이 나온다 (check → boolean, range → number, option → 항목 키, order → 항목 키 배열) |
| `signal` | 이 실행의 AbortSignal. 모듈이 꺼지면 abort된다. `addEventListener`, `eventBus.on`에 `{signal}`로 넘긴다 |
| `addFilter(selector, fn)` | 지금 있는 요소와 이후 추가되는 요소마다 `fn`을 실행한다 (core/filtering.ts의 MutationObserver 하나를 같이 쓴다) |
| `addCleanup(fn)` | signal을 받지 못하는 것(storage watch, zustand subscribe, 타이머)의 해제 함수를 등록한다 |

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
| `order` | 항목 키 배열 | `items` — 순서를 끌어서 바꾼다 |
| `color` | `#rrggbb` | |
| `key` | 키 하나 | 소문자 영문·숫자 |

같은 `group` 객체를 가진 설정은 옵션 화면에서 한 칸에 묶여 보입니다. 저장된 값은 읽을 때 스키마에 맞게 정리되고(`core/module/settings.ts`의 `normalizeSettings`), 스키마에서 사라진 설정과 없어진 모듈의 설정은 확장 페이지가 열릴 때 지워집니다(`stores/modules.ts`의 `pruneStaleSettings`).

### 단축키와 팝업 토글

- **shortcuts**: `{명령 이름: (ctx, api) => …}`. 명령 이름은 `wxt.config.ts`의 manifest `commands`에 있어야 합니다. 배경 스크립트가 명령을 받아 탭으로 보내고, 레지스트리가 setup이 끝난 모듈에만 전달합니다.
- **pageToggles**: 팝업의 "현재 페이지"에 나오는 이 페이지 한정 토글입니다. `isOn(api)`, `toggle(api)`, `desc`(문자열 또는 `(api) => string`)를 줍니다.

### 모듈 간 api

다른 모듈의 api는 `getModuleApi(id)`로 받습니다. 그 모듈이 이 페이지에서 켜져 있고 setup이 끝났을 때만 값이 있습니다. api를 내주는 모듈은 자기 파일에서 타입을 등록합니다.

```ts
// features/preview/index.ts
export interface PreviewApi { archiveArticle(): boolean }
declare module "@/core/module/types" {
    interface ModuleApis { preview: PreviewApi }
}

// features/refresh/index.ts
getModuleApi("preview")?.archiveArticle()
```

알림처럼 받는 쪽이 없어도 되는 신호는 `core/eventbus`의 `eventBus`(emittery)를 씁니다. 이벤트 이름과 데이터 타입은 `core/eventbus/types.ts`에 추가합니다.

### 확장 페이지 CSS 변수

모듈 설정이 옵션·팝업 화면에도 영향을 줘야 하면 `extensionPageVars(settings)`로 CSS 변수를 돌려줍니다. 모듈이 켜져 있을 때 옵션·팝업의 `<html>`에 들어갑니다. 폰트 교체 모듈이 `--refresher-font`를 이렇게 넘깁니다. 옵션·팝업 코드에 특정 모듈 이름을 적지 않기 위한 장치입니다.

### 배경 모듈

배경 스크립트에서 할 일(컨텍스트 메뉴 등)이 있으면 `features/<id>/background.ts`에서 `defineBackgroundModule`로 내보냅니다. `entrypoints/background/index.ts`가 glob으로 모아 실행합니다.

- `listen()`: 배경이 뜰 때마다 동기로 실행됩니다. 서비스 워커를 깨울 이벤트 리스너는 여기서 겁니다.
- `apply({enabled, settings})`: 모듈을 켜고 끄거나 설정이 바뀔 때, 설치·브라우저 시작 때 실행됩니다. 호출은 모듈마다 순서대로 한 번에 하나씩입니다.

배경 번들에는 React가 들어가면 안 됩니다. `background.ts`는 `index.ts`(아이콘·React import)를 불러오지 않고, 같이 쓰는 값은 React 없는 파일로 뺍니다. `features/imagesearch`가 예입니다.

## 저장소

- 모든 키는 `core/storage/items.ts`에 모읍니다. `storage.defineItem`을 쓰고 직접 만든 저장소 래퍼는 두지 않습니다.
- 예외: IP·밴 DB(`DB_KEYS`)는 수백 KB라 `defineItem`으로 만들지 않습니다. `defineItem`은 만드는 순간 값을 읽기 때문에, 파일을 import한 모든 페이지가 쓰지 않는 DB를 읽게 됩니다. 이 키는 쓰는 곳에서 `storage.getItem`·`storage.watch`로 다룹니다.
- 모듈 캐시(계속 불어나는 데이터)는 `moduleDataStorage(id, fallback)`로 만듭니다. 이 키는 백업·내보내기에서 빠집니다. 개수 상한을 두세요 (글댓비 캐시는 500명).
- 백업 대상 판정은 `core/backup.ts`의 `isBackupTarget`입니다. 새 키가 백업되면 안 되는 성격(비밀번호, 다시 받을 수 있는 큰 데이터)이면 여기에 추가합니다.
- v5 사용자의 데이터는 업데이트 때 `core/migrate-v5.ts`가 옮깁니다. v5와 같은 키를 쓰는 설정은 주석으로 표시해 두었으니 이름을 바꾸지 마세요. v6 안에서 바뀐 설정(6.0.x의 `showIpInfo` 등)은 `core/migrate-settings.ts`가 옮깁니다.

## HTTP

`core/http/client.ts`의 `http`(일반 요청)와 `ajax`(`X-Requested-With` 헤더를 붙인 디시 ajax 요청)를 씁니다.

- 두 클라이언트 모두 p-limit으로 동시 요청 수를 제한합니다. 제한 값은 "요청 제한" 모듈 설정이고, 모듈이 꺼져 있거나 옵션·배경 페이지면 제한하지 않습니다.
- Firefox 콘텐츠 스크립트에서는 두 클라이언트 모두 `content.fetch`로 보냅니다. 페이지가 보낸 요청처럼 나가야 디시 ajax가 받아 줍니다.
- 시간 제한(15초)은 동시 요청 수 제한의 차례를 받은 뒤부터 잽니다. 더 짧게 끊을 요청(자동 새로고침)은 호출할 때 `timeout`을 줍니다.
- 재시도는 지터를 주고, `Retry-After`는 최대 10초까지만 기다립니다. 시간 초과는 재시도하지 않습니다.
- 폼 본문은 `formBody({...})`로 만듭니다. 값이 `null`·`undefined`·`false`인 필드는 빠지고, 빈 문자열은 들어갑니다. 끊은 요청인지는 `isAbortError(e)`로 봅니다.

## 오버레이와 CSS

- 콘텐츠 스크립트는 `refresher-root` shadow DOM 안에 React 루트(`components/overlay/ContentRoot.tsx`)를 띄웁니다. 디시 CSS와 Radix CSS가 서로 섞이지 않게 하기 위해서입니다. 포털은 `overlay.portal`입니다.
- 디시 페이지 자체를 바꾸는 CSS는 `assets/styles/content.scss`, `layout.scss`, `stealth.scss`이고 manifest로 주입됩니다.
- 오버레이용 Radix CSS(`radix-themes.css?inline`)는 `wxt.config.ts`의 PostCSS 플러그인이 줄입니다. 반응형 미디어 블록과 오버레이가 쓰지 않는 컴포넌트 규칙을 빼고 `:root`를 `:host`로 바꿉니다. 오버레이에서 새 Radix 컴포넌트를 쓰면 `UNUSED_OVERLAY_COMPONENT`에서 빼야 스타일이 들어갑니다.
- `radix-themes.css`는 색 파일을 `base.css`보다 먼저 불러옵니다. 순서가 바뀌면 gray가 slate가 아닌 순수 회색이 됩니다.

## 미리보기

`features/preview`가 가장 큰 모듈입니다.

| 파일 | 역할 |
|------|------|
| `index.ts` | 모듈 정의, 목록 클릭·우클릭·미니 미리보기 처리, 글·댓글 요청 흐름 |
| `rows.ts` | 목록 행 → 미리보기 대상(`GalleryPreData`), 앞·뒤 글 찾기 |
| `ui/previewStore.ts` | 미리보기 창 상태 (zustand) |
| `settings.ts` | 설정 스키마 |
| `ui/Frame.tsx` | 창 (머리, 본문, 댓글 칸, 휠로 넘기기) |
| `ui/Votes.tsx`, `ErrorBlock.tsx`, `CountDown.tsx`, `fitMovies.ts` | 추천 버튼, 오류 안내, 자동 삭제 카운트다운, 디시 동영상 iframe 크기 맞추기 |
| `ui/CommentList.tsx`, `Comment.tsx`, `WriteComment.tsx` | 댓글 목록(답글 접기), 댓글 하나, 댓글 쓰기 |
| `ui/Popups.tsx`, `Mini.tsx`, `DcconPopup.tsx` | 관리 패널·차단 팝업, 미니 미리보기, 디시콘 고르기 |
| `nonmember.ts` | 비회원 닉네임·비밀번호 (디시 localStorage를 같이 씀) |
| `core/preview/request.ts` | 글·댓글 요청, 댓글 쓰기, 관리 요청 |
| `core/preview/parser.ts` | 글 HTML 파싱 (DOMParser) |
| `core/preview/comments.ts` | 댓글 정리, 차단·같은 댓글 접기, 삭제된 댓글 보존 |
| `core/preview/cache.ts` | 글·댓글 캐시 |

본문 HTML은 `utils/sanitize.ts`에서 DOMPurify로 정화합니다. 재사용하는 `<template>`에서 `IN_PLACE`로 정화하는데, `<video>`가 든 DOMParser 문서는 Chrome에서 해제되지 않기 때문입니다. 파서도 같은 이유로 문서의 video·audio를 지우고 문서를 들고 있지 않습니다.

## 코드 규칙

- 반복은 `for...of`를 씁니다 (`forEach` 대신). catch 변수는 `e`, 이벤트 매개변수는 `ev`입니다.
- 브라우저 기본 기능, WXT 기능, 널리 쓰이고 관리가 잘 되는 라이브러리로 되면 직접 구현하지 않습니다. 라이브러리 코드는 패치하지 않습니다.
- 기능 하나를 고칠 때 여러 화면을 건드리지 않도록 모듈 구조를 따릅니다. 옵션·팝업은 모듈 정의(스키마, `extensionPageVars`, `pageToggles`)만 보고 그립니다.
- 주석은 한국어로, 코드만 봐서는 알 수 없는 이유(디시·브라우저 동작, 순서 제약, 성능 이유)를 적습니다.
- 커밋 메시지는 conventional commits(`feat`, `fix`, `perf`, `refactor`, `docs`, `chore` …)를 따릅니다. 이슈 번호는 GitHub 이슈일 때만 적습니다.

## 테스트할 때 주의

디시에 쓰기 요청(댓글·디시콘·추천·관리)을 보내는 기능은 실제로 반영됩니다. 자동화 테스트에서는 이런 POST를 막고, 읽기 요청(글·댓글 목록)만 보내세요.

## 릴리즈

1. develop에서 `package.json`의 `version`을 올리고 `chore(release): X.Y.Z`로 커밋합니다.
2. release 브랜치에 develop을 머지 커밋으로 합칩니다.
3. `X.Y.Z` 태그를 만들어 push합니다. `.github/workflows/release.yml`이 태그와 `package.json` 버전이 같은지 확인하고, 타입 검사를 하고 zip을 만들어 GitHub 릴리즈에 올리고 Chrome 웹 스토어·Firefox Add-ons에 제출합니다. 그다음 DB 워크플로가 이 태그의 코드로 DB를 새로 만듭니다.

IP·밴 DB는 `.github/workflows/db.yml`이 매주 수·토요일과 릴리즈 때 `scripts/build-db.ts`로 만들어 `data` 브랜치에 올립니다. 예약·수동 실행은 release 브랜치(배포된 코드)로, 릴리즈 때는 그 태그로 만듭니다. develop으로 만들지 않는 것은 형식을 바꾼 코드가 릴리즈 전에 올라가지 않게 하려는 것입니다. `ip.json`은 확장이 저장하는 형식(`core/ipdb.ts`의 `CompactIpData`) 그대로이고 버전을 담고 있습니다. `ban.json`은 손으로 관리하며 워크플로가 검사·정리합니다. 확장은 설치된 뒤 알람으로 새 버전을 확인해 받습니다 (`core/database.ts`).

IP DB 형식(`IP_FORMAT`)을 바꾸면 옛 확장은 새 `ip.json`을 읽지 못하고, 새 확장은 옛 `ip.json`을 받지 않습니다. 릴리즈가 제출 직후 새 형식으로 DB를 만들므로, 스토어 심사를 거쳐 새 확장이 설치될 때는 `data` 브랜치가 이미 새 형식입니다. 확장은 업데이트될 때 DB를 다시 받습니다. 심사 중에는 옛 확장이 새 `ip.json`을 읽지 못해 갖고 있던 DB를 그대로 씁니다.
