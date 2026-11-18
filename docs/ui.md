# UI

## 오버레이와 CSS

- 콘텐츠 스크립트는 디시 CSS와 섞이지 않게 `refresher-root` shadow DOM 안에 Preact 루트(`components/overlay/ContentRoot.tsx`)를 띄웁니다. 포털은 `overlay.portal`입니다.
- 오버레이는 그릴 것이 처음 생길 때 띄우고 조건은 `needOverlayWhen(store, (state) => ...)`로 등록합니다(`components/overlay/demands.ts`). 새 UI는 자기 스토어의 조건에 상태를 더하면 됩니다.
- 디시 페이지 자체를 바꾸는 CSS는 기능 폴더의 `page.css`입니다(`modules/feature-styles.ts`가 모아 `entrypoints/page.content.css`가 주입). 여러 모듈이 같이 쓰는 가림 규칙만 `assets/styles/content.css`에 있고, dev 중 `page.css`를 새로 만들면 dev를 다시 띄웁니다.
- 콘텐츠 스크립트에서 import한 CSS는 오버레이를 처음 띄울 때 shadow에 들어갑니다(`cssInjectionMode: "manual"`, `entrypoints/content/overlay.tsx`가 `:root`를 `:host`로 바꿈). 오버레이 안 CSS는 `assets/styles/overlay.css`와 기능 폴더의 `overlay.css`입니다.
- 오버레이의 Tailwind는 `overlay.css`가 `tailwind.css`를 불러 만드는데 옵션, 팝업 전용 부품(`@source not` 목록)은 스캔하지 않습니다. 오버레이에서 쓰게 되면 목록에서 빼지 않으면 `tests/unit/assets/styles/overlay.test.ts`가 실패합니다.
- 페이지, 오버레이는 다른 문서라 같은 규칙은 `assets/styles/shared.css`의 `@utility`로 맞춥니다(`@reference` + `@apply`). `:is()`로 감싸져 명시도가 달라지므로 명시도가 중요한 곳은 규칙을 나눠 씁니다.
- UI는 Tailwind 클래스로 꾸미고 CSS 파일에는 디시 HTML(미리보기 본문, `.refresher-html`)처럼 클래스를 못 다는 곳만 남깁니다. Tailwind는 적힌 클래스만 만들므로 이어 붙여 만들지 않습니다. Tailwind 리셋이 들어가고 `.refresher-html`만 `all: revert-layer`로 되돌립니다.
- 다크모드는 `dark` 클래스로 바꿉니다(`utils/appearance.ts`). 옵션, 팝업은 시스템 설정을, 오버레이는 디시 다크모드를 최상위에 옮기고 `color-scheme`도 정합니다. 강조색 글자는 `text-link`(`--link`)로 칠합니다(다크모드 `--primary`는 글자에 쓰면 묻힘). 설정값은 `<html>`의 CSS 변수로 넘깁니다(커스텀 속성은 shadow를 넘어 상속, `--refresher-preview-font-size`).

## 부품

- UI는 Preact 11로 돌고 `wxt.config.ts`의 preact 플러그인이 `react`, `react-dom` import를 `preact/compat`으로 연결합니다. 타입은 `@types/react` 그대로. 부품 라이브러리는 daisyUI 5(Tailwind 플러그인, 순수 CSS 클래스)이고 별도 `components/ui` 폴더 없이 쓰는 자리에서 클래스(`btn`, `input`, `toggle`, `checkbox`, `radio`, `select`, `tabs`, `badge`, `kbd`, `loading`, `card`, `table`, `join`, `tooltip`+`data-tip`)로 인라인합니다. 색은 `tailwind.css`의 커스텀 테마 `refresher`가 기존 토큰(`--primary` 등)을 `var()`로 간접 참조하므로 `dark` 클래스 체계가 그대로 작동합니다.
- 새 창은 연 직후 DOM에 있다고 기대하지 않습니다(E2E는 `getByRole("dialog")`/`getByRole("alertdialog")`, shadow 안 `[data-slot=dialog-content]`/`[data-slot=alert-dialog-content]`로 찾음). 다이얼로그 첫 포커스는 `ModalDialog`의 `focusOnOpen`, 나중에 나타나는 입력칸은 `utils/focus.ts`의 `focusOnMount`로 옮깁니다.
- 다이얼로그는 `components/dialogs.tsx`가 native `<dialog>`+`showModal`로 직접 관리합니다(top-layer, `::backdrop`, Esc(cancel), 포커스 가두기를 브라우저가 맡음). 닫힘은 `data-closing` → 닫힘 전용 keyframes(`dialog-pop-out`) 재생 → `close` 이벤트 → `useReturnFocus` 포커스 반환 → `onClose`. 같은 keyframes 이름을 뒤집는 것만으로는 끝난 애니메이션이 재시작하지 않으므로 닫힘은 따른 이름을 씁니다. 확인 창은 `ConfirmDialog`(`role="alertdialog"`, `data-slot=alert-dialog-content`), 스스로 닫을 때는 `actionsRef.current.close()`를 씁니다.
- native 모달의 shadow DOM 주의점: 오버레이 shadow host가 `pointer-events: none`이라 dialog 리셋이 `pointer-events: auto`를 지정하지 않으면 창 안 버튼이 죽습니다(`tailwind.css`). Chromium의 모달 Tab 순환은 창 요소를 거치는 빈 돌점에서 포커스가 shadow 밖으로 새므로 `keepTabInside`로 가장자리를 직접 돌리고, 모달이 살아 있는 동안 브라우저는 창 밖 포커스 이동을 막으므로 삭제로 줄이 사라질 때는 줄 언마운트 시점에 포커스를 돌립니다(`ListTabs.tsx`의 `ListRow`).
- 한 묶음에서 Tab 정지점을 하나로 묶는(roving tabindex) 단추 무리(디시콘 패키지 줄, 글자콘 색)는 `components/roving.ts`의 `rovingKeyDown`을 묶음에 걸고 단추마다 `tabIndex={선택됨 ? 0 : -1}`을 붙입니다. 접기/펼치기는 `components/useCollapse.ts`.
- 버블(`components/overlay/UserBubble.tsx`)은 popover 부품 없이 `overlay.portal`에 fixed div(`data-slot=popover-content`)로 직접 그리고 바깥 누름/Esc을 스스로 처리합니다. 콘텐츠 스크립트의 window 리스너에서 shadow 안 요소는 호스트로 재지정되므로 `ev.composedPath()`로 판정합니다(`utils/event.ts`의 `eventTarget`). 슬라이더는 native `<input type="range">`(`SettingItem.tsx`).
- 툴팁은 `components/WithTooltip.tsx`(daisyUI `tooltip`+`data-tip`). 수천 줄 목록에는 브라우저 기본 `title`을, 수천 번 그리는 자리(목록 줄, 댓글, 디시콘 칸)는 부품 대신 `<button>` + `FOCUS_RING`(`components/focusRing.ts`)을 씁니다.
- 오버레이 없이 페이지에 직접 두는 단추는 페이지에 컴포넌트 트리를 올리지 않으려고 React 없이 그립니다(`features/stealth/index.ts`). 옵션 설정 검색은 CSS Custom Highlight API(`::highlight(refresher-search)`)로 칠합니다(`<mark>` 넣지 않음).
- 단축키는 `utils/event.ts`의 `isTyping`이 모달(`overlay.portal`의 오버레이 선택자 + 이벤트 경로의 열린 `<dialog>`)이 떠 있으면 막고, 미리보기 창의 Esc 전달은 `PreviewDialogRoot`가 열린 모달/버블을 보고 흘려보냅니다. 배경 요소를 바꾸면 선택자도 맞춥니다.

## 옵션 페이지

- `Layout.tsx`: `SearchInput`, `EmptyList`, `ImportDialog`, `downloadJson`, 읽기만 하는 `useStorageItem`.
- `ListTabs.tsx`: 차단 목록, 메모가 같이 쓰는 목록 탭(검색, 거르기, 더 보기, 되돌리기). 목록 화면은 이것을 씁니다.
- `optionsStore.ts`: 알림은 `notify`, `notifyDone`, `copyText`로. `SettingItem.tsx`: 설정 한 줄을 스키마 타입별로 그림. `RefresherSelect.tsx`: 값→문구 선택 상자(`aria-label` 필수).

## 접근성

- 오류 문구는 `role="alert"`, 진행 상황은 `role="status"` 영역에 글로(검색 모듈의 "다음 검색 중..."). 토스트는 오류일 때만 하던 말을 끊고 `role="alert"`로 바꿉니다(`components/overlay/Toasts.tsx`, 뷰포트는 `aria-live="polite"` region).
- `<h1>`은 페이지에 하나(옵션은 본문 탭 제목). 사이드바 현재 탭은 `aria-current="page"`입니다. 아이콘만 있는 버튼, 선택 상자, 검색칸에는 `aria-label`이나 `WithTooltip`의 `tip`으로 이름을 줍니다.
- 움직임은 `prefers-reduced-motion: reduce`를 따릅니다(`assets/styles/pages.css` 등). 새 애니메이션도 같이 막습니다.
