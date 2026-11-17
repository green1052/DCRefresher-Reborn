# UI

## 오버레이와 CSS

- 콘텐츠 스크립트는 디시 CSS와 섞이지 않게 `refresher-root` shadow DOM 안에 React 루트(`components/overlay/ContentRoot.tsx`)를 띄웁니다. 포털은 `overlay.portal`입니다.
- 오버레이는 그릴 것이 처음 생길 때 띄우고 조건은 `needOverlayWhen(store, (state) => ...)`로 등록합니다(`components/overlay/demands.ts`). 새 UI는 자기 스토어의 조건에 상태를 더하면 됩니다.
- 디시 페이지 자체를 바꾸는 CSS는 기능 폴더의 `page.css`입니다(`modules/feature-styles.ts`가 모아 `entrypoints/page.content.css`가 주입). 여러 모듈이 같이 쓰는 가림 규칙만 `assets/styles/content.css`에 있고, dev 중 `page.css`를 새로 만들면 dev를 다시 띄웁니다.
- 콘텐츠 스크립트에서 import한 CSS는 오버레이를 처음 띄울 때 shadow에 들어갑니다(`cssInjectionMode: "manual"`, `entrypoints/content/overlay.tsx`가 `:root`를 `:host`로 바꿈). 오버레이 안 CSS는 `assets/styles/overlay.css`와 기능 폴더의 `overlay.css`입니다.
- 오버레이의 Tailwind는 `overlay.css`가 `tailwind.css`를 불러 만드는데 옵션, 팝업 전용 부품(`@source not` 목록)은 스캔하지 않습니다. 오버레이에서 쓰게 되면 목록에서 빼지 않으면 `tests/unit/assets/styles/overlay.test.ts`가 실패합니다.
- 페이지, 오버레이는 다른 문서라 같은 규칙은 `assets/styles/shared.css`의 `@utility`로 맞춥니다(`@reference` + `@apply`). `:is()`로 감싸져 명시도가 달라지므로 명시도가 중요한 곳은 규칙을 나눠 씁니다.
- UI는 Tailwind 클래스로 꾸미고 CSS 파일에는 디시 HTML(미리보기 본문, `.refresher-html`)처럼 클래스를 못 다는 곳만 남깁니다. Tailwind는 적힌 클래스만 만들므로 이어 붙여 만들지 않습니다. Tailwind 리셋이 들어가고 `.refresher-html`만 `all: revert-layer`로 되돌립니다.
- 다크모드는 `dark` 클래스로 바꿉니다(`utils/appearance.ts`). 옵션, 팝업은 시스템 설정을, 오버레이는 디시 다크모드를 최상위에 옮기고 `color-scheme`도 정합니다. 강조색 글자는 `text-link`(`--link`)로 칠합니다(다크모드 `--primary`는 글자에 쓰면 묻힘). 설정값은 `<html>`의 CSS 변수로 넘깁니다(커스텀 속성은 shadow를 넘어 상속, `--refresher-preview-font-size`).

## 부품

- React 19, 타입은 `@types/react` 그대로. 부품은 shadcn(`components/ui`, Base UI)을 `bunx shadcn add <이름>`으로 추가하고 `components/ui`는 순정 레지스트리 코드만 둡니다.
- 새 창은 연 직후 DOM에 있다고 기대하지 않습니다(E2E는 `getByRole("dialog")`, shadow 안 `[data-slot=dialog-content]`로 찾음). 다이얼로그 첫 포커스는 `ModalDialog`의 `focusOnOpen`, 나중에 나타나는 입력칸은 `utils/focus.ts`의 `focusOnMount`로 옮깁니다.
- 닫히는 애니메이션 동안 Base UI 문서 리스너(Esc, 바깥 클릭)가 살아 있어 `open`을 고정하고 언마운트로 닫는 창은 `onOpenChange`에서 이미 닫혔으면 `details.cancel()`, `details.allowPropagation()`으로 흘려보냅니다.
- 오버레이 안 부품(dialog, alert-dialog, popover, tooltip)과 `overlayProps`, popover `anchor`, slider `thumbProps`는 props로 못 넘겨 쓰는 곳에서 Base UI 프리미티브로 직접 조립합니다(`components/dialogs.tsx`, `components/WithTooltip.tsx`, `components/overlay/UserBubble.tsx`, `entrypoints/options/tabs/SettingItem.tsx`). 모양 className은 복사한 것이므로 다시 받을 때 맞추고 E2E가 찾는 `data-slot`은 유지합니다.
- 다이얼로그는 `components/dialogs.tsx`의 `ModalDialog`, `ConfirmDialog`, `Notice`, `DialogActions`, `SubmitForm`을 쓰고 스스로 닫을 때는 `actionsRef.current.close()`를 씁니다. 트리거 없이 여는 창은 `useReturnFocus`가 포커스를 돌려주고, shadow 안 모달은 `keepTabInside`로 Tab을 직접 돌립니다.
- 툴팁은 `components/WithTooltip.tsx`. 수천 줄 목록에는 브라우저 기본 `title`을, 수천 번 그리는 자리(목록 줄, 댓글, 디시콘 칸)는 Base UI `Button` 대신 `<button>` + `FOCUS_RING`(`components/focusRing.ts`, `buttonVariants`에서 떼어 옴)을 씁니다.
- 오버레이 없이 페이지에 직접 두는 단추는 react-dom을 피하려고 React 없이 그립니다(`features/stealth/index.ts`). 옵션 설정 검색은 CSS Custom Highlight API(`::highlight(refresher-search)`)로 칠합니다(`<mark>` 넣지 않음).
- 단축키는 `utils/event.ts`의 `isTyping`이 모달 배경(`[data-slot=dialog-overlay]` 등)이 떠 있으면 막고, 미리보기 창의 Esc 전달은 popover 선택자를 더해 알아봅니다(`features/preview/ui/Frame.tsx`, `useModal`의 `forceRender`). 배경을 바꾸면 선택자도 맞춥니다.

## 옵션 페이지

- `Layout.tsx`: `SearchInput`, `EmptyList`, `ImportDialog`, `downloadJson`, 읽기만 하는 `useStorageItem`.
- `ListTabs.tsx`: 차단 목록, 메모가 같이 쓰는 목록 탭(검색, 거르기, 더 보기, 되돌리기). 목록 화면은 이것을 씁니다.
- `optionsStore.ts`: 알림은 `notify`, `notifyDone`, `copyText`로. `SettingItem.tsx`: 설정 한 줄을 스키마 타입별로 그림. `RefresherSelect.tsx`: 값→문구 선택 상자(`aria-label` 필수).

## 접근성

- 오류 문구는 `role="alert"`, 진행 상황은 `role="status"` 영역에 글로(검색 모듈의 "다음 검색 중..."). 토스트는 `error`만 `priority: high`입니다(`components/overlay/Toasts.tsx`).
- `<h1>`은 페이지에 하나(옵션은 본문 탭 제목). 사이드바 현재 탭은 `aria-current="page"`입니다. 아이콘만 있는 버튼, 선택 상자, 검색칸에는 `aria-label`이나 `WithTooltip`의 `tip`으로 이름을 줍니다.
- 움직임은 `prefers-reduced-motion: reduce`를 따릅니다(`assets/styles/pages.css` 등). 새 애니메이션도 같이 막습니다.
