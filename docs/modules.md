# 모듈

기능 모듈을 만들고 설정·단축키·팝업 토글을 붙이는 방법입니다.

## 새 기능 추가하기

기능은 모듈 폴더 하나에 모으고 다른 곳의 목록에는 등록하지 않습니다.

| 하려는 것 | 고치는 곳 |
|---|---|
| 새 모듈 | `features/<id>/meta.ts`, `index.ts` |
| 설정 | `meta.ts`의 `settings`. 페이지 코드는 `ctx.settings`, React는 `useModuleSettings(id)`로 읽는다. 바뀔 때 할 일은 setup의 `ctx.onSettingsChanged` |
| 단축키 | `meta.ts`의 `commands`와 `index.ts`의 `shortcuts` |
| 팝업 '현재 페이지' 토글 | `meta.ts`의 `toggles`와 `index.ts`의 `pageToggles` |
| 디시 페이지 CSS | `features/<id>/page.css` |
| 오버레이 UI | 컴포넌트와 그 스토어. 스토어에 `needOverlayWhen(store, (state) => …)`로 띄울 조건을 등록한다. CSS는 `features/<id>/overlay.css` |
| 배경에서 할 일 | `features/<id>/background.ts` ([배경 모듈](#배경-모듈)) |
| 다른 모듈에 줄 api | setup의 반환값. 받는 쪽은 `getModuleApi(id)` |

## 모듈 정의

옵션·팝업이 그리는 데 필요한 정보는 `features/<id>/meta.ts`에서 `defineModuleMeta`로, 페이지에서 하는 일은 `features/<id>/index.ts`에서 메타를 펼쳐 `defineModule`로 정의해 각각 default로 내보냅니다. 가장 작은 예는 `features/requests`입니다.

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

    setup(ctx) {
        setRequestConcurrency(ctx.settings.concurrency);
        ctx.onSettingsChanged(() => setRequestConcurrency(ctx.settings.concurrency));
    },
    revoke() { setRequestConcurrency(Number.POSITIVE_INFINITY); }
});
```

- **setup(ctx)**: 모듈이 켜진 페이지에서 실행됩니다. 돌려준 값은 모듈의 api가 되어 단축키·팝업 토글·다른 모듈이 받습니다. setup이 던지면 실패로 표시하고 모듈을 껐다 켤 때까지 그 페이지에서는 다시 시작하지 않습니다.
- **revoke()**: 모듈을 끄면 signal을 abort한 뒤 실행됩니다. 페이지에 넣은 DOM·클래스·스타일을 되돌립니다. 컨텍스트가 무효가 됐을 때(확장 업데이트 등)는 abort만 하고 revoke는 부르지 않아 페이지를 그대로 둡니다.
- **ctx.onSettingsChanged(listener)**: 켜져 있는 동안 설정이 바뀌면 바뀐 키들(Set)로 한 번 부릅니다. 여러 키가 한꺼번에 바뀌어도 한 번입니다. `ctx.settings`는 늘 최신 값이므로, 설정을 쓸 때마다 읽는 모듈은 등록하지 않아도 됩니다.
- 객체를 쓸 때 `setup`을 `shortcuts`, `pageToggles`보다 앞에 둡니다. TypeScript가 api 타입을 `setup`의 반환값에서 추론하기 때문입니다.

## 컨텍스트 (ctx)

| 멤버 | 용도 |
|------|------|
| `settings` | 현재 설정값. 스키마에서 타입이 나온다 (check → boolean, range → number, option → 항목 키, order → 항목 키 배열) |
| `signal` | 이 실행의 AbortSignal. 모듈이 꺼지면 abort된다. `addEventListener`에 `{signal}`로 넘긴다 |
| `addFilter(selector, fn)` | 지금 있는 요소와 이후 추가되는 요소마다 `fn`을 실행한다 |
| `addCleanup(fn)` | signal을 받지 못하는 것(storage watch, zustand subscribe, 타이머)의 해제 함수를 등록한다 |
| `onSettingsChanged(fn)` | 위 설명 참고. setup 안에서 등록한다 |

React UI는 설정을 `useModuleSettings("모듈 id")`로 직접 읽습니다. 설정을 UI 스토어로 옮겨 적지 마세요. `useModuleSettings`는 꺼진 모듈의 설정도 주므로, 다른 모듈이 이 페이지에서 돌 때만 그 설정을 따르는 UI(미리보기의 차단·배지)는 `useRunningModuleSettings("모듈 id")`로 읽습니다. 모듈이 돌지 않으면 undefined입니다. React 밖에서는 `core/module/registry.ts`의 `runningModuleSettings(id)`를 씁니다.

`addFilter`의 `fn`은 같은 요소에 여러 번 불릴 수 있습니다. 넣은 요소가 이미 있는지 보고 건너뛰게 만드세요. 예로는 글 목록 새로고침의 버튼이 있습니다.

모듈 안의 도우미 함수가 ctx를 받을 때는 `meta.ts`에서 설정 스키마를 상수로 빼서 `Ctx` 타입을 내보냅니다(`features/fonts`). 설정 스키마가 쓰는 상수도 `meta.ts`에 두고 `index.ts`가 가져다 씁니다.

```ts
// meta.ts
const settings = { … } satisfies SettingsSchema;
export type Ctx = ModuleContext<typeof settings>;

// index.ts
const apply = (ctx: Ctx): void => { … ctx.settings.bodyFontSize … }; // number
```

## 설정 스키마

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

저장된 값은 읽을 때 스키마에 맞게 정리됩니다(`core/module/settings.ts`의 `normalizeSettings`). 타입이 틀리면 기본값을 쓰고, `range`는 `step` 단위로 맞춰 `min`~`max`로 자릅니다. 그래서 `range`의 기본값과 `max`는 `min`에서 `step`의 배수만큼 떨어진 값이어야 합니다. 설정을 없애거나 이름을 바꿀 때는 [저장소](architecture.md#저장소)의 규칙을 따릅니다.

## 단축키와 팝업 토글

- **commands** (meta.ts): `{명령 이름: {description, key?}}`. 빌드할 때 `modules/commands.ts`가 모든 모듈의 것을 모아 manifest `commands`로 넣습니다. `key`는 처음 설치할 때의 기본 키입니다.
- **shortcuts** (index.ts): `{명령 이름: (ctx, api) => …}`. 메타의 `commands`와 이름이 같아야 합니다(`tests/unit/features/meta.test.ts`가 확인합니다). setup이 끝난 모듈에만 전달됩니다.
- **pageToggles**: 팝업의 "현재 페이지"에 나오는 이 페이지 한정 토글입니다. 표시 정보(`id`, `label`, `icon`)는 `meta.ts`의 `toggles`에 두고(팝업이 아이콘을 여기서 찾습니다), `index.ts`의 `pageToggles`가 같은 객체를 펼쳐 `desc`(문자열 또는 `(api) => string`), `isOn(api)`, `toggle(api)`를 붙입니다. setup이 끝난 모듈의 토글만 보입니다.

## 모듈 간 api

다른 모듈의 api는 `core/module/registry.ts`의 `getModuleApi(id)`로 받습니다. 그 모듈이 이 페이지에서 켜져 있고 setup이 끝났을 때만 값이 있습니다.

`modules/module-types.ts`가 `features/*/index.ts`의 id와 `setup` 리턴 타입을 모아 `.wxt/types/modules.d.ts`의 `ModuleApis`를 채우므로(`wxt prepare`) id와 api 타입은 따로 등록하지 않습니다. 없는 id나 api가 없는 모듈을 넣으면 타입 오류가 납니다. 새 모듈을 만든 직후 자동완성에 안 나오면 `bunx wxt prepare`를 한 번 실행합니다.

```ts
// features/preview/index.ts — setup이 돌려주는 객체가 곧 api 타입이다
setup: (ctx): PreviewApi => { …; return {archiveArticle: () => ctx.settings.archiveArticle}; }

// features/refresh/index.ts — 받는 모듈이 꺼져 있으면 ?.에서 끝난다
getModuleApi("preview")?.archiveArticle() === true
```

## 확장 페이지 CSS 변수

모듈 설정이 옵션·팝업 화면에도 반영돼야 하면 `extensionPageVars(settings)`로 CSS 변수를 돌려줍니다. 모듈이 켜져 있을 때 옵션·팝업의 `<html>`에 들어가므로(폰트 교체의 `--refresher-font`) 옵션·팝업 코드에는 특정 모듈 이름을 적지 않습니다.

## 배경 모듈

배경 스크립트에서 할 일(컨텍스트 메뉴 등)이 있으면 `features/<id>/background.ts`에서 `defineBackgroundModule`로 default 내보냅니다. `entrypoints/background/index.ts`가 glob으로 모아 실행합니다.

- `listen()`: 배경이 뜰 때마다 동기로 실행됩니다. 서비스 워커를 깨울 이벤트 리스너는 여기서 겁니다.
- `apply({enabled, settings})`: 모듈을 켜고 끄거나 설정이 바뀔 때, 설치·브라우저 시작 때(Firefox는 배경이 뜰 때마다) 실행됩니다. 맞출 상태 없이 리스너만 거는 모듈은 두지 않습니다(`features/write/background.ts`).
- 탭이 메시지로 요청한 일을 그 페이지(MAIN world)에서 할 때는 `hasTab`으로 탭에서 온 것인지 보고 `runInPage`로 실행합니다.

배경 번들에는 React가 들어가면 안 됩니다. `background.ts`는 `index.ts`·`meta.ts`(아이콘·React import)를 불러오지 않고, `id`·`settings`·`defaultEnable`처럼 양쪽이 같아야 하는 값은 React 없는 파일로 빼서 같이 씁니다(`features/imagesearch/engines.ts`). `defaultEnable`이 다르면 옵션에서는 꺼져 있는데 배경은 켜진 것으로 봅니다. 페이지에서 할 일이 없는 모듈은 `index.ts`를 두지 않습니다.

배경·옵션·팝업과 콘텐츠 스크립트가 같이 불러오는 파일(`core/`, `stores/` 등)은 모듈 최상위에서 던지면 안 됩니다. 한 곳에서 던지면 번들 전체가 멈춥니다([Firefox](firefox.md) 참고).
