# 모듈

기능은 모듈 폴더 하나에 모으고 다른 곳 목록에는 등록하지 않습니다.

| 하려는 것 | 고치는 곳 |
|---|---|
| 새 모듈 | `features/<id>/meta.ts`, `labels.ts`, `icons.ts`, `index.ts` |
| 설정 | `meta.ts`의 `settings`, `labels.ts`의 `settings`. 페이지는 `ctx.settings`, 오버레이는 `useContentModuleSettings(id)`(옵션, 팝업과 같이 쓰면 `useModuleSettings(id)`). 바뀔 때 할 일은 setup의 `ctx.onSettingsChanged`. 옵션, 팝업 화면에도 반영하려면 `extensionPageVars(settings)`로 CSS 변수를 돌려줍니다 |
| 단축키 | `meta.ts`의 `commands`, `labels.ts`의 `commands`, `index.ts`의 `shortcuts` |
| 팝업 '현재 페이지' 토글 | `meta.ts`의 `toggles`, `labels.ts`, `icons.ts`의 `toggles`, `index.ts`의 `pageToggles` |
| 디시 페이지 CSS | `features/<id>/page.css` |
| 페이지(MAIN world) 스크립트 | `features/<id>/page.ts`. `defineUnlistedScript`로 내보내면 `modules/page-scripts.ts`가 `<id>-page.js`로 등록한다. 배경이 `runFileInPage`로 넣는다 |
| 오버레이 UI | `features/<id>/overlay.tsx`의 default를 `components/overlay/ContentRoot.tsx`가 모아 그린다. `needOverlayWhen(store, (state) => ...)`로 띄울 조건을 등록하고 CSS는 `overlay.css` |
| 배경에서 할 일 | `features/<id>/background.ts` ([배경 모듈](#배경-모듈)) |
| 다른 모듈에 준 api | setup의 반환값. 받는 쪽은 `getModuleApi(id)` |

### 새 모듈 만들기 (차례대로)

1. `features/<id>/`에 `meta.ts`, `labels.ts`, `icons.ts`, `index.ts`를 만듭니다. glob이 모으므로 등록하지 않습니다.
2. `bunx wxt prepare` - `modules/module-types.ts`가 모듈 id와 설정 타입을 다시 만듭니다(건너뛰면 `ctx.settings` 타입이 비음). 그리고 `bun run test` - `tests/unit/features/meta.test.ts`가 스키마↔`labels.ts` 짝, 아이콘, 토글 id, 단축키 설명을 확인합니다. `page.css`를 새로 만들었으면 `bun run dev`를 다시 띄웁니다([UI](ui.md#오버레이와-css)).
3. 루트 `README.md` 모듈 표에 줄을 더하고 [위키](https://github.com/green1052/DCRefresher-Reborn/wiki)에 모듈 페이지를 만들어 `Home.md`, `_Sidebar.md`에 넣습니다(문구는 `labels.ts`와 맞춤).

## 모듈 정의

옵션, 팝업 정보는 `meta.ts`의 `defineModuleMeta`, 페이지에서 하는 일은 `index.ts`의 `defineModule(meta, {setup, ...})`로 default 내보냅니다. 설정만 있으면 `index.ts`를 두지 않습니다(`features/fonts`).

```ts
// meta.ts - 모든 번들이 불러오므로 가벼운 것만. UI(lucide, preact)는 불러오지 않는다 (단위 테스트가 확인)
export default defineModuleMeta({
    id: "fonts",               // 저장소 키. 바꾸면 사용자 설정이 끊긴다
    // urls: [BOARD_PAGE],     // 이 주소에서만 실행. 없으면 모든 디시 페이지
    // defaultEnable: false,   // 저장된 on/off가 없을 때 꺼 둠
    settings: {
        bodyFontSize: {type: "range", default: 13, min: 5, max: 30, step: 1, unit: "px"}
    }
});

// labels.ts - 옵션, 팝업, 단축키 설정에 보이는 글. 설정, 토글, 명령마다 하나씩
export default {name: "폰트 교체", settings: {bodyFontSize: {name: "글자 폰트 크기", desc: "..."}}} satisfies LabelsOf<typeof meta>;
// icons.ts - lucide 아이콘. 토글이 있으면 {module: Ban, toggles: {reveal: Eye}}
export default {module: Gauge} satisfies IconsOf<typeof meta>;

// index.ts - 콘텐츠 스크립트만 불러온다. setup 맨 앞에서 onRevoke를 등록한다
export default defineModule(meta, {
    setup(ctx) {
        ctx.onRevoke(apply(ctx));
        ctx.onSettingsChanged(() => apply(ctx));
    }
});
```

- **setup(ctx)**: 모듈이 켜진 페이지에서 실행됩니다. 반환값이 모듈 api가 되어 단축키, 팝업 토글, 다른 모듈이 받습니다. 던지면 실패로 표시되어 다시 켤 때까지 시작하지 않습니다(팝업 "현재 페이지"에 표시). 객체에서 `setup`은 `shortcuts`, `pageToggles`보다 앞에 둡니다(api 타입 추론).
- **ctx.onRevoke(fn)**: 모듈을 끄면 signal을 abort한 뒤 실행됩니다. 넣은 DOM, 클래스, 스타일을 되돌립니다. setup 맨 앞에서 등록하고 실행 상태는 setup 안의 변수에 둡니다. 컨텍스트가 무효가 되면(확장 업데이트 등) abort만 하고 부르지 않습니다. **ctx.onSettingsChanged(listener)**: 설정이 바뀌면 바뀐 키들(Set)로 한 번 부릅니다. `ctx.settings`는 늘 최신이라 매번 읽는 모듈은 필요 없습니다.

## 컨텍스트 (ctx)

| 멤버 | 용도 |
|------|------|
| `settings` | 현재 설정값. 타입은 스키마에서 (check → boolean, range → number, option → 항목 키, order → 항목 키 배열) |
| `signal` | 이 실행의 AbortSignal. `addEventListener`에 `{signal}`로 넘긴다 |
| `addFilter(selector, fn)` | 지금, 이후 추가되는 요소마다 `fn` 실행 |
| `addCleanup(fn)` | signal을 받지 못하는 것(storage watch, zustand subscribe, 타이머)의 해제 등록 |
| `onSettingsChanged(fn)` | 위 참고 |
| `onRevoke(fn)` | 위 참고 |

오버레이 컴포넌트는 `useContentModuleSettings("모듈 id")`로 직접 읽고, 옵션, 팝업과 같이 쓰는 컴포넌트는 `useModuleSettings`로 읽으며 undefined 기본값을 정합니다(`components/dialogs.tsx`). 두 훅 모두 꺼진 모듈 설정도 주므로 이 페이지에서 돌 때만 따르는 UI는 `useRunningModuleSettings("모듈 id")`, 컴포넌트 밖에서는 `runningModuleSettings(id)`를 씁니다.

`addFilter`의 `fn`은 같은 요소에 여러 번 불리므로 이미 있는지 보고 건너뛰게 만듭니다. 행마다 장식을 넣는 모듈은 `FILTER_SKIP_ATTR`을 답니다(안 그러면 행마다 모든 필터가 다시 돕니다).

도우미 함수가 ctx를 받을 때는 `meta.ts`에 스키마 상수를 빼 `export type Ctx = ModuleContext<typeof settings>`를 내보냅니다(`features/fonts`).

## 설정 스키마

`core/module/types.ts`의 `SettingSchema`. 옵션이 스키마와 `labels.ts` 문구(`SettingLabel`: `name`, `desc`, `group`, `placeholder`)를 합쳐 그립니다. 같은 `group`의 설정은 한 칸에 묶입니다.

| type | 값 | 추가 필드 |
|------|----|-----------|
| `check` | boolean | |
| `text` | string | `maxLength`(저장, 가져온 값도 자름). 안내는 `placeholder` |
| `range` | number | `min`, `max`, `step`, `unit` |
| `option` | 항목 키 | `items: {키: 이름}` |
| `order` | 항목 키 배열 | `items`. 순서를 끌어서 바꾼다 |
| `color` | `#rrggbb` | |
| `key` | 키 하나 | 소문자 영문, 숫자 |

저장된 값은 읽을 때 정리됩니다(`settingsOf`, `normalizeSetting`): 타입이 틀리면 기본값, `range`는 `step` 단위로 `min`~`max`. 그래서 `range` 기본값과 `max`는 `min`에서 `step` 배수만큼 떨어진 값이어야 합니다. 설정 제거, 이름 변경은 [저장소](architecture.md#저장소) 규칙을 따릅니다.

## 단축키와 팝업 토글

- **commands** (meta.ts): `{명령 이름: {key?}}`, 설명은 labels.ts의 `commands`. `modules/commands.ts`가 모아 manifest에 넣습니다. 크롬은 기본 키 있는 명령을 4개까지만 받고 dev 빌드가 한 자리를 쓰므로 모듈 기본 키는 합쳐 3개까지(넘으면 단위 테스트, dev 빌드 실패).
- **shortcuts** (index.ts): `{명령 이름: (api) => ...}`. `commands`마다 하나씩(빠지면 타입 오류)이고 setup이 끝난 모듈에만 전달됩니다.
- **pageToggles**: 팝업 "현재 페이지" 토글. 토글 id는 `meta.ts`의 `toggles`, 이름, 아이콘은 `labels.ts`, `icons.ts`의 `toggles`, 동작은 `index.ts`의 `{토글 id: {desc, isOn, toggle}}`.

## 모듈 간 api

`core/module/registry.ts`의 `getModuleApi(id)`로 받습니다. 모듈이 켜져 있고 setup이 끝났을 때만 값이 있습니다. `modules/module-types.ts`가 id와 api 타입을 `.wxt/types/modules.d.ts`의 `ModuleApis`에 모으므로 따로 등록하지 않습니다(자동완성에 안 나오면 `bunx wxt prepare`). setup의 반환 객체가 곧 api 타입입니다: `getModuleApi("preview")?.archiveArticle()`처럼 받는 모듈이 꺼져 있으면 `?.`로 끝납니다.

## 배경 모듈

`features/<id>/background.ts`의 `defineBackgroundModule(meta, {listen, apply})`를 default 내보냅니다. `entrypoints/background/index.ts`가 glob으로 모아 실행합니다.

- `listen()`: 배경이 뜰 때마다 동기 실행. 깨울 이벤트 리스너를 여기서 겁니다. 메시지 이름은 배경 전체에서 한 번만(겹치면 단위 테스트가 잡음). 설치, 업데이트 때 할 일은 `browser.runtime.onInstalled`에 겹니다(`features/preview/background.ts`).
- `apply({enabled, settings})`: 모듈 on/off, 설정 변경, 설치, 브라우저 시작 때 실행(Firefox는 배경이 뜰 때마다). 리스너만 거는 모듈은 두지 않습니다(`features/write/background.ts`). 탭이 요청한 일을 페이지(MAIN world)에서 할 때는 `runInPage`로 실행하고, import가 필요하면 `features/<id>/page.ts`에 `defineUnlistedScript`로 두면 `modules/page-scripts.ts`가 엔트리포인트로 등록해 `runFileInPage(sender, "/<id>-page.js")`로 넣습니다.

- 배경 번들에 preact가 들어가면 안 됩니다. `background.ts`는 `index.ts`, `icons.ts`, `labels.ts`를 불러오지 않고, 같이 쓰는 값(`features/imagesearch`의 엔진 목록 등)은 `meta.ts`에 둡니다. 배경, 옵션, 팝업, 콘텐츠가 같이 불러오는 파일(`core/`, `stores/`)은 모듈 최상위에서 던지면 안 됩니다([Firefox](firefox.md)).
