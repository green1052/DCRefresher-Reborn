# UI

오버레이(shadow DOM)와 CSS, Preact·shadcn(Base UI) 부품을 쓸 때 알아 둘 점입니다.

## 오버레이와 CSS

- 콘텐츠 스크립트는 디시 CSS와 오버레이 CSS(Tailwind)가 서로 섞이지 않게 `refresher-root` shadow DOM 안에 Preact 루트(`components/overlay/ContentRoot.tsx`)를 띄웁니다. 포털은 `overlay.portal`입니다.
- 오버레이는 그릴 것이 처음 생길 때 띄웁니다. UI를 그리는 스토어가 그 조건을 `needOverlayWhen(store, (state) => …)`로 등록합니다(`components/overlay/demands.ts`). 새 오버레이 UI는 자기 스토어의 조건에 상태를 더하면 됩니다(미리보기 UI는 `previewStore.ts`, 토스트·버블·메모는 `stores/ui.ts` 끝).
- 디시 페이지 자체를 바꾸는 CSS는 기능 폴더의 `page.css`에 둡니다. `modules/feature-styles.ts`가 모아 `.wxt/page-styles.css`를 만들고 `entrypoints/page.content.css`(manifest로 따로 주입)가 불러옵니다. 여러 모듈이 같이 쓰는 가림 규칙(차단·깡계)만 `assets/styles/content.css`에 있습니다. dev 중에 `page.css`를 새로 만들었으면 dev를 다시 띄웁니다.
- 콘텐츠 스크립트에서 import한 CSS는 페이지가 아니라 오버레이(shadow)에 들어갑니다(`cssInjectionMode: "ui"`). 오버레이 안의 CSS는 `assets/styles/overlay.css`와 기능 폴더의 `overlay.css`입니다.
- 페이지·오버레이는 서로 다른 문서라 같은 규칙(차단 흐림, 스텔스 디시콘 가림)을 `assets/styles/shared.css`의 Tailwind 유틸리티(`@utility`)로 맞춥니다. 쓰는 CSS가 `@reference`로 가져와 `@apply`합니다. 부모 선택자 목록에 중첩하면 `:is()`로 감싸져 명시도가 달라집니다. 명시도가 중요한 곳은 규칙을 나눠 씁니다.
- 우리가 그리는 UI는 Tailwind 클래스로 꾸밉니다. CSS 파일에 남는 것은 디시 HTML(미리보기 본문·댓글의 `.refresher-html`, 디시 페이지)처럼 클래스를 달 수 없는 곳의 규칙뿐입니다. Tailwind는 소스에 적힌 클래스 이름만 만들므로 클래스 이름을 이어 붙여 만들지 않습니다.
- 오버레이에는 Tailwind 리셋(preflight)이 들어갑니다. 디시 본문·댓글 HTML(`.refresher-html`)만은 `tailwind.css`가 `all: revert-layer`로 리셋을 되돌립니다.
- 다크모드는 조상의 `dark` 클래스로 바꿉니다(`utils/appearance.ts`). 옵션·팝업은 시스템 설정을, 오버레이는 디시 다크모드를 오버레이 최상위 요소(shadow 안의 컨테이너)에 옮기고 `color-scheme`도 같이 정합니다.
- 강조색 글자(링크 등)는 `text-link`(`--link`)로 칠합니다. 다크모드의 `--primary`는 흰 글자를 얹는 버튼 배경색이라 글자에 쓰면 어두운 배경에 묻힙니다.
- 설정값을 오버레이 CSS에 넘길 때는 `<html>`에 CSS 변수를 둡니다. 커스텀 속성은 shadow 경계를 넘어 상속됩니다. 폰트 교체의 `--refresher-preview-font-size`가 예입니다.

## 부품

- 화면은 Preact로 그리지만 코드는 `react`에서 import합니다(`@preact/preset-vite`가 `preact/compat`으로 바꿉니다). 타입은 `@types/react`를 그대로 씁니다. tsconfig에서 `react` 타입을 `preact/compat`으로 바꾸면 Base UI와 ref·이벤트 타입이 맞지 않아 shadcn 부품마다 오류가 납니다.
- Preact는 상태 변경을 다음 마이크로태스크에 그립니다. 누른 직후 새 창이 바로 DOM에 있다고 기대하지 않습니다(E2E는 `getByRole("dialog")` 안에서 찾습니다).
- Preact는 `autoFocus`로 포커스를 옮기지 않으므로 다이얼로그는 `ModalDialog`의 `focusOnOpen`에 ref를, 나중에 나타나는 입력칸은 `utils/focus.ts`의 `focusOnMount`를 씁니다.
- Preact 11은 언마운트된 컴포넌트의 `useEffect` 정리를 다음 프레임으로 미룹니다. 그사이 Base UI의 문서 리스너(Esc·바깥 클릭)가 살아 있습니다. 그래서 `open`을 고정해 두고 언마운트로 닫는 창은 방금 닫혔어도 다음 키·클릭을 받습니다. 그런 창의 `onOpenChange`는 이미 닫혔으면 `details.cancel()`·`details.allowPropagation()`으로 흘려보냅니다(유저 버블, 미리보기 창).
- 부품은 shadcn(`components/ui`, Base UI)입니다. 손으로 만들지 않고 `bunx shadcn add <이름>`으로 추가합니다. shadcn CLI가 `.wxt/tsconfig.json`의 경로를 잘못 풀어 루트 `tsconfig.json`에 `@/*` 경로를 다시 적어 두었습니다. `tailwind.css`는 `shadcn/tailwind.css`(Base UI 데이터 속성용 variant)를 불러와야 합니다.
- `components/ui`에서 우리가 고친 곳: 포털을 쓰는 부품(dialog·alert-dialog·popover·select·tooltip)은 `container={overlay.portal}`로 오버레이 안에 그립니다. slider는 손잡이에 이름을 달 `thumbProps`를 받습니다. 부품을 다시 받을 때(`--overwrite`) 이 부분을 다시 넣습니다.
- 다이얼로그는 `components/dialogs.tsx`의 `ModalDialog`(열 때만 마운트), `ConfirmDialog`, `Notice`, `DialogActions`, `SubmitForm`을 씁니다. `onClose`는 닫힘 애니메이션이 끝나 포커스가 돌아간 뒤에 불립니다. 일을 마친 창이 스스로 닫을 때는 `actionsRef.current.close()`를 씁니다.
- 포커스: 트리거 없이 여는 창(다이얼로그·버블)은 `useReturnFocus`(`components/useReturnFocus.ts`)가 연 요소에 포커스를 돌려줍니다. 오버레이(shadow DOM) 안에서는 Base UI의 포커스 가두기가 끝을 알아보지 못해 모달 창(`ModalDialog`·`ConfirmDialog`·`Notice`, 이미지 크게 보기)이 `keepTabInside`로 Tab을 직접 돌립니다.
- 툴팁은 `components/WithTooltip.tsx`를 씁니다. 수천 줄을 그리는 목록(차단 목록 줄·댓글)에는 브라우저 기본(`title`)을 씁니다.
- 단축키는 `utils/event.ts`의 `isTyping`이 모달 다이얼로그 배경(`[data-slot=dialog-overlay]`·`[data-slot=alert-dialog-overlay]`)이 떠 있으면 막습니다. 미리보기 창의 Esc 전달(`features/preview/ui/Frame.tsx`)도 같은 선택자로 위에 뜬 창을 알아봅니다. 미리보기 안에서 연 창은 Base UI가 배경을 그리지 않으므로 `useModal`이 늘 `forceRender`로 그립니다. 배경을 바꾸면 이 선택자들도 맞춥니다.
