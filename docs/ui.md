# UI

오버레이(shadow DOM)와 CSS, React·shadcn(Base UI) 부품을 쓸 때 알아 둘 점입니다.

## 오버레이와 CSS

- 콘텐츠 스크립트는 디시 CSS와 오버레이 CSS(Tailwind)가 서로 섞이지 않게 `refresher-root` shadow DOM 안에 React 루트(`components/overlay/ContentRoot.tsx`)를 띄웁니다. 포털은 `overlay.portal`입니다.
- 오버레이는 그릴 것이 처음 생길 때 띄웁니다. UI를 그리는 스토어가 그 조건을 `needOverlayWhen(store, (state) => …)`로 등록합니다(`components/overlay/demands.ts`). 새 오버레이 UI는 자기 스토어의 조건에 상태를 더하면 됩니다(미리보기 UI는 `previewStore.ts`, 토스트·버블·메모는 `stores/ui.ts` 끝). react-dom·Base UI는 본문 청크에 정적으로 들어 와 있고 첫 렌더만 이때 일어납니다.
- 디시 페이지 자체를 바꾸는 CSS는 기능 폴더의 `page.css`에 둡니다. `modules/feature-styles.ts`가 모아 `.wxt/page-styles.css`를 만들고 `entrypoints/page.content.css`(manifest로 따로 주입)가 불러옵니다. 여러 모듈이 같이 쓰는 가림 규칙(차단·깡계)만 `assets/styles/content.css`에 있습니다. dev 중에 `page.css`를 새로 만들었으면 dev를 다시 띄웁니다.
- 콘텐츠 스크립트에서 import한 CSS는 manifest가 아니라 오버레이를 처음 띄울 때 shadow에 들어갑니다(`cssInjectionMode: "manual"`. `entrypoints/content/overlay.tsx`가 `content-scripts/content.css`를 읽어 `:root`를 `:host`로 바꿔 `createShadowRootUi`의 `css`로 넘긴다). 오버레이 안의 CSS는 `assets/styles/overlay.css`와 기능 폴더의 `overlay.css`입니다.
- 오버레이의 Tailwind는 `overlay.css`가 `tailwind.css`를 불러와 만듭니다. 이때 옵션·팝업 폴더와 옵션·팝업만 쓰는 부품(`@source not` 목록)은 스캔하지 않아 오버레이 CSS가 작아집니다. 오버레이에서 그 부품을 쓰게 되면 목록에서 뺍니다. 빼지 않으면 `tests/unit/assets/styles/overlay.test.ts`가 실패합니다.
- 페이지·오버레이는 서로 다른 문서라 같은 규칙(차단 흐림, 스텔스 디시콘 가림)을 `assets/styles/shared.css`의 Tailwind 유틸리티(`@utility`)로 맞춥니다. 쓰는 CSS가 `@reference`로 가져와 `@apply`합니다. 부모 선택자 목록에 중첩하면 `:is()`로 감싸져 명시도가 달라집니다. 명시도가 중요한 곳은 규칙을 나눠 씁니다.
- 우리가 그리는 UI는 Tailwind 클래스로 꾸밉니다. CSS 파일에 남는 것은 디시 HTML(미리보기 본문·댓글의 `.refresher-html`, 디시 페이지)처럼 클래스를 달 수 없는 곳의 규칙뿐입니다. Tailwind는 소스에 적힌 클래스 이름만 만들므로 클래스 이름을 이어 붙여 만들지 않습니다.
- 오버레이에는 Tailwind 리셋(preflight)이 들어갑니다. 디시 본문·댓글 HTML(`.refresher-html`)만은 `overlay.css`가 `all: revert-layer`로 리셋을 되돌립니다.
- 다크모드는 조상의 `dark` 클래스로 바꿉니다(`utils/appearance.ts`). 옵션·팝업은 시스템 설정을, 오버레이는 디시 다크모드를 오버레이 최상위 요소(shadow 안의 컨테이너)에 옮기고 `color-scheme`도 같이 정합니다.
- 강조색 글자(링크 등)는 `text-link`(`--link`)로 칠합니다. 다크모드의 `--primary`는 흰 글자를 얹는 버튼 배경색이라 글자에 쓰면 어두운 배경에 묻힙니다.
- 설정값을 오버레이 CSS에 넘길 때는 `<html>`에 CSS 변수를 둡니다. 커스텀 속성은 shadow 경계를 넘어 상속됩니다. 폰트 교체의 `--refresher-preview-font-size`가 예입니다.

## 부품

- 화면은 React 19로 그립니다. 코드가 처음부터 `react` import로 되어 있어(Preact 호환 시절의 흔적) 프레임워크 교체가 설정만으로 끝났습니다. 타입은 `@types/react`를 그대로 씁니다.
- 새 창은 연 직후 바로 DOM에 있다고 기대하지 않습니다(E2E는 옵션·팝업이면 `getByRole("dialog")`, 오버레이면 shadow 안의 `[data-slot=dialog-content]`로 찾습니다. `e2e/pages/`를 보세요).
- 다이얼로그의 첫 포커스는 `ModalDialog`의 `focusOnOpen`으로 정하고, 나중에 나타나는 입력칸은 `utils/focus.ts`의 `focusOnMount`로 옮깁니다.
- 닫히는 애니메이션 동안에도 Base UI의 문서 리스너(Esc·바깥 클릭)가 살아 있습니다. 그래서 `open`을 고정해 두고 언마운트로 닫는 창은 방금 닫혔어도 다음 키·클릭을 받습니다. 그런 창의 `onOpenChange`는 이미 닫혔으면 `details.cancel()`·`details.allowPropagation()`으로 흘려보냅니다(유저 버블, 미리보기 창).
- 부품은 shadcn(`components/ui`, Base UI)입니다. 손으로 만들지 않고 `bunx shadcn add <이름>`으로 추가합니다. shadcn CLI가 `.wxt/tsconfig.json`의 경로를 잘못 풀어 루트 `tsconfig.json`에 `@/*` 경로를 다시 적어 두었습니다. DB 워크플로(`db.yml`)도 `wxt prepare` 없이 이 경로로 `@/`를 풀므로 지우지 않습니다. `tailwind.css`는 `shadcn/tailwind.css`(Base UI 데이터 속성용 variant)를 불러와야 합니다.
- `components/ui`에서 우리가 고친 곳: 포털을 쓰는 부품(dialog·alert-dialog·popover·select·tooltip)은 `container={overlay.portal}`로 오버레이 안에 그립니다. dialog·alert-dialog의 내용은 배경에 넘길 `overlayProps`를 받습니다(`useModal`이 `forceRender`와 흐림 끄기에 씁니다). popover의 내용은 `anchor`를 받아 Positioner에 넘깁니다(유저·디시콘 버블을 우클릭한 자리에 띄웁니다). slider는 손잡이에 이름을 달 `thumbProps`를 받습니다. spinner의 이름은 `aria-label="불러오는 중"`입니다. switch 트랙은 루트 글자 크기가 커져도 손잡이가 들어가게 px 대신 rem으로 잽니다. 부품을 다시 받을 때(`--overwrite`) 이 부분을 다시 넣습니다.
- 다이얼로그는 `components/dialogs.tsx`의 `ModalDialog`(열 때만 마운트), `ConfirmDialog`, `Notice`, `DialogActions`, `SubmitForm`을 씁니다. `onClose`는 닫힘 애니메이션이 끝나 포커스가 돌아간 뒤에 불립니다. 일을 마친 창이 스스로 닫을 때는 `actionsRef.current.close()`를 씁니다.
- 포커스: 트리거 없이 여는 창(다이얼로그·버블)은 `useReturnFocus`(`components/useReturnFocus.ts`)가 연 요소에 포커스를 돌려줍니다. 오버레이(shadow DOM) 안에서는 Base UI의 포커스 가두기가 끝을 알아보지 못해 모달 창(`ModalDialog`·`ConfirmDialog`·`Notice`, 이미지 크게 보기)이 `keepTabInside`로 Tab을 직접 돌립니다.
- 툴팁은 `components/WithTooltip.tsx`를 씁니다. 수천 줄을 그리는 목록(차단 목록 줄·댓글)에는 브라우저 기본(`title`)을 씁니다.
- 같은 이유로 수천 번 그리는 자리(목록 줄·댓글·디시콘 칸)에는 Base UI `Button` 대신 맨 `<button>`에 `components/focusRing.ts`의 `FOCUS_RING`만 붙입니다(버튼마다 리스너를 여럿 달지 않으면서 키보드 포커스 표시는 남깁니다). 값은 `components/ui/button.tsx`의 `buttonVariants`에서 떼어 온 것이라 그쪽이 바뀌면 같이 맞춥니다.
- 오버레이 없이 페이지에 직접 두는 단추(스텔스의 임시 보이기)는 react-dom을 끌어들이지 않게 `features/stealth/index.ts`에서 React 없이 그립니다.
- 옵션의 설정 검색은 맞는 글자를 CSS Custom Highlight API(`CSS.highlights`, `pages.css`의 `::highlight(refresher-search)`)로 칠합니다(`entrypoints/options/GeneralTab.tsx`). 그린 글자 위에 범위만 얹으므로 이름·설명에 `<mark>`를 넣지 않습니다.
- 단축키는 `utils/event.ts`의 `isTyping`이 모달 다이얼로그 배경(`[data-slot=dialog-overlay]`·`[data-slot=alert-dialog-overlay]`)이 떠 있으면 막습니다. 미리보기 창의 Esc 전달(`features/preview/ui/Frame.tsx`)은 같은 배경 선택자에 팝오버(`[data-slot=popover-content]`)를 더해 위에 뜬 창을 알아봅니다. 미리보기 안에서 연 창은 Base UI가 배경을 그리지 않으므로 `useModal`이 늘 `forceRender`로 그립니다. 배경을 바꾸면 이 선택자들도 맞춥니다.

## 옵션 페이지

새 탭이나 설정 화면을 만들기 전에 이미 있는 것을 보세요 (`entrypoints/options/`).

- `Layout.tsx`: 검색칸(`SearchInput`), 빈 목록(`EmptyList`), 가져오기 창(`ImportDialog`), JSON 내려받기(`downloadJson`), 저장소 항목을 읽기만 하는 `useStorageItem`(쓰기는 항목의 `setValue`를 직접 부릅니다).
- `ListTabs.tsx`: 차단 목록과 메모가 같이 쓰는 목록 탭입니다. 검색·갤러리 거르기·미사용 거르기·더 보기(200줄씩)·여러 개 삭제와 되돌리기가 모두 여기 있습니다. 목록 화면을 새로 만들 일이 있으면 이것을 씁니다.
- `optionsStore.ts`: 알림은 직접 띄우지 말고 `notify`(확인 창)·`notifyDone`(토스트)·`copyText`를 씁니다. `Notice` 하나를 `App`이 들고 있습니다.
- `SettingItem.tsx`: 모듈 설정 한 줄을 스키마 타입에 맞게 그립니다. 새 설정 타입을 더하면 여기도 고칩니다.
- `RefresherSelect.tsx`: 값→문구 객체를 받는 선택 상자. `aria-label`을 꼭 줍니다.

## 접근성

- 오류 문구에는 `role="alert"`를 답니다(`FieldError role="alert"`, 팝업의 `<p role="alert">`). 토스트는 수준이 Base UI `priority`로 가 `error`만 `high`(하던 말을 끊고 읽음)이고 나머지는 `low`입니다(`components/overlay/Toasts.tsx`).
- `<h1>`은 페이지에 하나만 둡니다. 옵션은 본문의 탭 제목이 `<h1>`이고 사이드바 로고는 모양만 제목입니다(`options/App.tsx`). 사이드바의 현재 탭은 `aria-current="page"`입니다.
- 아이콘만 있는 버튼에는 `aria-label`이나 `WithTooltip`의 `tip`으로 이름을 줍니다. 선택 상자·검색칸도 `aria-label`을 줍니다.
- 움직임은 `prefers-reduced-motion: reduce`를 따릅니다(`assets/styles/pages.css`, `features/refresh/page.css`, `features/stealth/page.css`, 디시콘 비의 `optionsStore.startRain`). 새 애니메이션을 더하면 같이 막습니다.
- 진행 상황을 글로 알릴 곳은 `role="status"` 영역을 씁니다(검색 모듈의 "다음 검색 중…", 컨텍스트 무효화 안내).
