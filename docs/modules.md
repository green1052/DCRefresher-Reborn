# 모듈

기능 모듈을 만들고 설정·단축키·팝업 토글을 붙이는 방법입니다.

## 새 기능 추가하기

기능은 모듈 폴더 하나에 모으고 다른 곳의 목록에는 등록하지 않습니다.

| 하려는 것 | 고치는 곳 |
|---|---|
| 새 모듈 | `features/<id>/meta.ts`, `labels.ts`, `icons.ts`, `index.ts` |
| 설정 | `meta.ts`의 `settings`와 `labels.ts`의 `settings`(이름·설명). 페이지 코드는 `ctx.settings`, 오버레이 컴포넌트는 `useContentModuleSettings(id)`로 읽는다(옵션·팝업과 같이 쓰는 컴포넌트는 `useModuleSettings(id)`). 바뀔 때 할 일은 setup의 `ctx.onSettingsChanged` |
| 단축키 | `meta.ts`의 `commands`, `labels.ts`의 `commands`(설명)와 `index.ts`의 `shortcuts` |
| 팝업 '현재 페이지' 토글 | `meta.ts`의 `toggles`, `labels.ts`·`icons.ts`의 `toggles`와 `index.ts`의 `pageToggles` |
| 디시 페이지 CSS | `features/<id>/page.css` |
| 오버레이 UI | 컴포넌트와 그 스토어. 호스트 컴포넌트는 `features/<id>/overlay.tsx`의 default로 내보내면 `components/overlay/ContentRoot.tsx`가 모아 그린다. 스토어에 `needOverlayWhen(store, (state) => …)`로 띄울 조건을 등록한다. CSS는 `features/<id>/overlay.css` |
| 배경에서 할 일 | `features/<id>/background.ts` ([배경 모듈](#배경-모듈)) |
| 다른 모듈에 줄 api | setup의 반환값. 받는 쪽은 `getModuleApi(id)` |

### 새 모듈 만들기 (차례대로)

1. `features/<id>/`에 `meta.ts`·`labels.ts`·`icons.ts`·`index.ts`를 만듭니다. glob으로 모으므로 어디에도 등록하지 않습니다.
2. `bunx wxt prepare` — `modules/module-types.ts`가 `.wxt/`에 모듈 id와 설정 타입을 다시 만듭니다. 이걸 건너뛰면 `ctx.settings` 타입이 비어 있습니다.
3. `bun run test` — `tests/unit/features/meta.test.ts`가 모든 모듈에 대해 설정 스키마↔`labels.ts` 짝, 아이콘, 토글 id, 단축키 설명이 맞는지 확인합니다. 빠진 것이 있으면 여기서 걸립니다.
4. `page.css`를 새로 만들었으면 `bun run dev`를 다시 띄웁니다(빌드 모듈이 manifest를 다시 만듭니다, [UI](ui.md#오버레이와-css)).
5. 루트 `README.md`의 모듈 표에 줄을 더합니다.
6. [위키](https://github.com/green1052/DCRefresher-Reborn/wiki)에 그 모듈 페이지를 만들고 `Home.md`·`_Sidebar.md`에 넣습니다. 설정 이름·설명은 `labels.ts`와 글자까지 맞춥니다.

## 모듈 정의

옵션·팝업이 그리는 데 필요한 정보는 `features/<id>/meta.ts`에서 `defineModuleMeta`로, 페이지에서 하는 일은 `features/<id>/index.ts`에서 `defineModule(meta, {setup, …})`으로 정의해 각각 default로 내보냅니다. 가장 작은 예는 `features/requests`입니다.

```ts
// meta.ts — 옵션·팝업·콘텐츠·배경이 모두 불러오므로 가벼운 것만 둔다. UI(lucide·Preact)는 불러오지 않는다 (단위 테스트가 확인한다)
export default defineModuleMeta({
    id: "requests",            // 저장소 키에 쓰인다. 바꾸면 사용자 설정이 끊긴다
    // urls: [BOARD_PAGE],     // 이 주소에서만 실행 (core/pages.ts). 없으면 모든 디시 페이지, []면 어디서도 실행하지 않음
    // defaultEnable: false,   // 저장된 on/off가 없을 때(새로 설치했거나 업데이트로 새로 생긴 모듈) 꺼 둘 모듈

    settings: {
        concurrency: {type: "range", default: 4, min: 1, max: 10, step: 1, unit: "개"}
    }
});

// labels.ts — 옵션·팝업·단축키 설정에 보이는 글. 배경·콘텐츠 번들에 들어가지 않게 meta.ts와 따로 둔다
// 설정·토글·명령마다 하나씩 있어야 하고 없는 키를 넣으면 타입 오류가 난다
export default {
    name: "요청 제한",
    description: "…",
    settings: {
        concurrency: {name: "동시 요청 수", desc: "…"}
    }
} satisfies LabelsOf<typeof meta>;

// icons.ts — 옵션·팝업이 그리는 lucide 아이콘. meta.ts는 배경·콘텐츠 번들에도 들어가므로 따로 둔다
// 토글이 있으면 토글 id마다 하나씩: {module: Ban, toggles: {reveal: Eye}}
export default {module: Gauge} satisfies IconsOf<typeof meta>;

// index.ts — 콘텐츠 스크립트만 불러온다
export default defineModule(meta, {
    setup(ctx) {
        ctx.onRevoke(() => setRequestConcurrency(Number.POSITIVE_INFINITY));

        setRequestConcurrency(ctx.settings.concurrency);
        ctx.onSettingsChanged(() => setRequestConcurrency(ctx.settings.concurrency));
    }
});
```

- **setup(ctx)**: 모듈이 켜진 페이지에서 실행됩니다. 돌려준 값은 모듈의 api가 되어 단축키·팝업 토글·다른 모듈이 받습니다. setup이 던지면 실패로 표시하고 모듈을 껐다 켤 때까지 그 페이지에서는 다시 시작하지 않습니다. 실패한 모듈은 팝업의 "현재 페이지"에 시작하지 못한 모듈로 나옵니다.
- **ctx.onRevoke(fn)**: 모듈을 끄면 signal을 abort한 뒤 실행됩니다. 페이지에 넣은 DOM·클래스·스타일을 되돌립니다. setup 맨 앞에서 등록하고, 실행 상태(캐시·감시 등)는 setup 안의 변수에 두어 다시 켤 때 새로 만들어지게 합니다. 던져도 오류만 남기고 다른 모듈의 켜기·끄기는 이어집니다. 컨텍스트가 무효가 됐을 때(확장 업데이트 등)는 abort만 하고 부르지 않아 페이지를 그대로 둡니다. setup이 await하는 사이 꺼진 뒤에 등록하면 바로 부릅니다.
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
| `onRevoke(fn)` | 위 설명 참고. 모듈을 끌 때 페이지를 되돌린다 |

오버레이 컴포넌트(Preact)는 설정을 `useContentModuleSettings("모듈 id")`로 직접 읽습니다. 설정을 UI 스토어로 옮겨 적지 마세요. 설정 스토어는 콘텐츠 스크립트만 채우므로, 옵션·팝업과 같이 쓰는 컴포넌트는 `useModuleSettings`로 읽고 undefined일 때의 기본값을 정합니다(`components/dialogs.tsx`). 두 훅 모두 꺼진 모듈의 설정도 주므로, 다른 모듈이 이 페이지에서 돌 때만 그 설정을 따르는 UI(미리보기의 차단·배지)는 `useRunningModuleSettings("모듈 id")`로 읽습니다. 모듈이 돌지 않으면 undefined입니다. 컴포넌트 밖에서는 `core/module/registry.ts`의 `runningModuleSettings(id)`를 씁니다.

`addFilter`의 `fn`은 같은 요소에 여러 번 불릴 수 있습니다. 넣은 요소가 이미 있는지 보고 건너뛰게 만드세요. 예로는 글 목록 새로고침의 버튼이 있습니다.

목록 행마다 장식 요소를 넣는 모듈은 그 요소에 `FILTER_SKIP_ATTR`(`core/filtering.ts`) 속성을 붙입니다. 붙이지 않으면 추가된 요소를 감싼 작성자 칸이 다시 잡혀 행마다 모든 필터(차단 정규식 등)가 한 번 더 돕니다. 예로는 유저 정보의 배지 묶음이 있습니다. 필터 코드에는 특정 모듈의 클래스 이름을 적지 않습니다.

모듈 안의 도우미 함수가 ctx를 받을 때는 `meta.ts`에서 설정 스키마를 상수로 빼서 `Ctx` 타입을 내보냅니다(`features/fonts`). 설정 스키마가 쓰는 상수도 `meta.ts`에 두고 `index.ts`가 가져다 씁니다.

```ts
// meta.ts
const settings = { … } satisfies SettingsSchema;
export type Ctx = ModuleContext<typeof settings>;

// index.ts
const apply = (ctx: Ctx): void => { … ctx.settings.bodyFontSize … }; // number
```

## 설정 스키마

`core/module/types.ts`의 `SettingSchema`입니다. 옵션 페이지가 스키마와 `labels.ts`의 표시 문구(`SettingLabel`: `name`, `desc`, `group`, `placeholder`)를 합쳐 화면을 그립니다.

| type | 값 | 추가 필드 |
|------|----|-----------|
| `check` | boolean | |
| `text` | string | `maxLength`. 입력칸이 글자 수를 막고, 저장된 값·가져온 값도 그 길이로 자른다. 안내 문구는 labels.ts의 `placeholder` |
| `range` | number | `min`, `max`, `step`, `unit` |
| `option` | 항목 키 | `items: {키: 이름}` |
| `order` | 항목 키 배열 | `items`. 순서를 끌어서 바꾼다 |
| `color` | `#rrggbb` | |
| `key` | 키 하나 | 소문자 영문·숫자 |

labels.ts에서 같은 `group` 객체를 가진 설정은 옵션 화면에서 한 칸에 묶여 보입니다.

저장된 값은 읽을 때 스키마에 맞게 정리됩니다(`core/module/settings.ts`의 `settingsOf`·`normalizeSetting`). 타입이 틀리면 기본값을 쓰고, `range`는 `step` 단위로 맞춰 `min`~`max`로 자릅니다. 그래서 `range`의 기본값과 `max`는 `min`에서 `step`의 배수만큼 떨어진 값이어야 합니다. 설정을 없애거나 이름을 바꿀 때는 [저장소](architecture.md#저장소)의 규칙을 따릅니다.

## 단축키와 팝업 토글

- **commands** (meta.ts): `{명령 이름: {key?}}`. 설명은 labels.ts의 `commands`(`{명령 이름: 설명}`)에 둡니다. 빌드할 때 `modules/commands.ts`가 모든 모듈의 것을 모아 manifest `commands`로 넣습니다(설명은 "모듈 이름: 설명"). `key`는 처음 설치할 때의 기본 키입니다. 크롬은 기본 키가 있는 명령을 4개까지만 받고 dev 빌드의 다시 불러오기(Alt+Shift+R)가 한 자리를 쓰므로, 모듈의 기본 키는 모두 합쳐 3개까지입니다. 넘으면 단위 테스트(`tests/unit/features/meta.test.ts`)와 dev 빌드가 실패합니다.
- **shortcuts** (index.ts): `{명령 이름: (api) => …}`. 메타의 `commands`에 있는 이름마다 하나씩 있어야 하고, 빠지거나 없는 이름을 넣으면 타입 오류가 납니다. 메타에 명령이 없으면 두지 않습니다. setup이 끝난 모듈에만 전달됩니다.
- **pageToggles**: 팝업의 "현재 페이지"에 나오는 이 페이지 한정 토글입니다. 토글 id는 `meta.ts`의 `toggles`에 두고(팝업은 같은 id로 `labels.ts`·`icons.ts`의 `toggles`에서 이름·아이콘을 찾습니다), `index.ts`의 `pageToggles`가 `{토글 id: {desc, isOn, toggle}}`로 동작을 붙입니다. `desc`는 문자열 또는 `(api) => string`, `isOn(api)`, `toggle(api)`입니다. 토글 id마다 하나씩 있어야 합니다(타입이 확인합니다). setup이 끝난 모듈의 토글만 보입니다.

## 모듈 간 api

다른 모듈의 api는 `core/module/registry.ts`의 `getModuleApi(id)`로 받습니다. 그 모듈이 이 페이지에서 켜져 있고 setup이 끝났을 때만 값이 있습니다.

`modules/module-types.ts`가 `features/*/index.ts`의 id와 `setup` 리턴 타입을 모아 `.wxt/types/modules.d.ts`의 `ModuleApis`를 채우므로(`wxt prepare`, 설정 훅이 쓰는 `ModuleSettings`는 `meta.ts`에서 채웁니다) id와 api 타입은 따로 등록하지 않습니다. 없는 id나 api가 없는 모듈을 넣으면 타입 오류가 납니다. 새 모듈을 만든 직후 자동완성에 안 나오면 `bunx wxt prepare`를 한 번 실행합니다.

```ts
// features/preview/index.ts — setup이 돌려주는 객체가 곧 api 타입이다
setup: (ctx): PreviewApi => { …; return {archiveArticle: () => ctx.settings.archiveArticle}; }

// features/refresh/index.ts — 받는 모듈이 꺼져 있으면 ?.에서 끝난다
getModuleApi("preview")?.archiveArticle() === true
```

## 확장 페이지 CSS 변수

모듈 설정이 옵션·팝업 화면에도 반영돼야 하면 `meta.ts`의 `extensionPageVars(settings)`로 CSS 변수를 돌려줍니다. 모듈이 켜져 있을 때 옵션·팝업의 `<html>`에 들어가므로(폰트 교체의 `--refresher-font`) 옵션·팝업 코드에는 특정 모듈 이름을 적지 않습니다.

## 배경 모듈

배경 스크립트에서 할 일(컨텍스트 메뉴 등)이 있으면 `features/<id>/background.ts`에서 `defineBackgroundModule(meta, {listen, apply})`로 default 내보냅니다. id·`settings`·`defaultEnable`은 메타에서 읽습니다. `entrypoints/background/index.ts`가 glob으로 모아 실행합니다.

- `listen()`: 배경이 뜰 때마다 동기로 실행됩니다. 서비스 워커를 깨울 이벤트 리스너는 여기서 겁니다. 던지면 오류만 남기고 그 모듈은 `apply`하지 않습니다. 메시지 이름은 배경 전체에서 한 번만 걸 수 있으며, 겹치면 단위 테스트(`tests/unit/entrypoints/background/messages.test.ts`)가 잡습니다.
- `apply({enabled, settings})`: `settings`는 메타의 스키마대로 키마다 타입이 붙습니다. 모듈을 켜고 끄거나 설정이 바뀔 때, 설치·브라우저 시작 때(Firefox는 배경이 뜰 때마다) 실행됩니다. 맞출 상태 없이 리스너만 거는 모듈은 `apply`를 두지 않습니다(`features/write/background.ts`).
- 설치·업데이트 때 한 번만 할 일(옛 모듈 데이터 지우기 등)은 `listen()`에서 `browser.runtime.onInstalled`에 겁니다(`features/preview/background.ts`). `entrypoints/background/index.ts`에 모듈 코드를 넣지 않습니다.
- 탭이 메시지로 요청한 일을 그 페이지(MAIN world)에서 할 때는 `hasTab`으로 탭에서 온 것인지 보고 `runInPage`로 실행합니다. 함수는 직렬화되어 import를 쓸 수 없으므로, 라이브러리가 필요하면 `entrypoints/<이름>.ts`에 `defineUnlistedScript`로 번들하고 `runFileInPage(sender, "/<이름>.js")`로 넣습니다(`entrypoints/upload-hook.ts`). unlisted script는 `web_accessible_resources`에 넣지 않아 디시 페이지가 불러올 수 없습니다.

배경 번들에는 Preact가 들어가면 안 됩니다. `background.ts`는 `index.ts`·`icons.ts`·`labels.ts`를 불러오지 않습니다. `meta.ts`는 UI를 불러오지 않으므로(단위 테스트가 확인합니다) 그대로 불러오고, 배경과 같이 쓰는 값(`features/imagesearch`의 엔진 목록 등)도 `meta.ts`에 둡니다. 페이지에서 할 일이 없는 모듈은 `index.ts`를 두지 않습니다.

배경·옵션·팝업과 콘텐츠 스크립트가 같이 불러오는 파일(`core/`, `stores/` 등)은 모듈 최상위에서 던지면 안 됩니다. 한 곳에서 던지면 번들 전체가 멈춥니다([Firefox](firefox.md) 참고).
