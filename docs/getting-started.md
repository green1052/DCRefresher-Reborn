# 시작하기

## 스택

| 항목 | 사용 |
|------|------|
| 확장 프레임워크 | [WXT](https://wxt.dev). Chrome, Firefox 모두 MV3. 최소 버전(Chrome 140, Firefox 144)은 코드가 쓰는 가장 늦게 들어온 API에 맞추고, 더 새 API를 쓰면 `wxt.config.ts`에서 올립니다 |
| UI | [Preact](https://preactjs.com) 11(순수 preact — compat alias 없음). [daisyUI](https://daisyui.com) 5 + [Tailwind CSS](https://tailwindcss.com) v4 |
| 상태 | zustand |
| 저장소 | WXT storage (`wxt/utils/storage`) |
| HTTP | ky |
| HTML 정화 | DOMPurify (`utils/sanitize.ts`) |
| 메시징 | @webext-core/messaging |
| 패키지 관리, 실행 | Bun 1.4 이상, Node 25 이상. 단위 테스트, E2E가 `Uint8Array`의 `toBase64` 등을 써 Node 24 이하에서는 실패합니다([테스트](testing.md)). `scripts/`는 Bun API, 빌드 모듈(`modules/`)과 E2E는 Node API를 씁니다 |
| 테스트 | Vitest, Playwright ([테스트](testing.md)) |

## 명령

```sh
bun install            # 의존성 설치 (postinstall이 wxt prepare로 .wxt 타입을 만든다)
bun run dev            # Chrome 개발 모드 (dev:firefox는 Firefox)
bun run compile        # 타입 검사 (tsc --noEmit)
bun run test           # 단위 테스트. test:watch는 지켜보며 다시 돈다
bun run build          # .output/chrome-mv3 (build:firefox는 .output/firefox-mv3)
bun run e2e            # 빌드하고 E2E. 처음 한 번 bunx playwright install chromium
bun run e2e:firefox    # 파이어폭스로 빌드하고 E2E. 처음 한 번 bunx playwright install firefox
bun run e2e:live       # 실제 디시 E2E. 디시 마크업, API가 바뀌었는지 본다 (CI에서도 돈다)
bun run zip            # 배포용 zip (zip:firefox는 Firefox zip + 소스 zip)
```

커밋 전에 `bun run compile`, `bun run test`, `bun run build`가 통과해야 하고 PR마다 CI(`.github/workflows/ci.yml`)가 타입 검사, 단위 테스트, Chromium, 파이어폭스 E2E를 돌립니다. 번들은 `bunx wxt build --analyze`의 `stats.html`로 봅니다.

## 코드 규칙

- 반복은 `for...of`, catch 변수는 `e`, 이벤트 매개변수는 `ev`.
- 브라우저, WXT 기능으로 되면 그것을, 그다음 관리되는 라이브러리(DOMPurify, ky, quick-lru 등)를 씁니다. 라이브러리 코드는 패치하지 않고 `utils/`에는 대신할 수 없는 것만 둡니다.
- 기능 하나를 고칠 때 여러 화면을 건드리지 않도록 모듈 구조를 따릅니다([모듈](modules.md)). 옵션, 팝업은 `meta.ts` 스키마와 `labels.ts`, `icons.ts`만 보고 그립니다.
- 타입은 정확히. 경계에서 `unknown`을 넘기거나 `as`로 덮지 않고 검사해 좁힙니다. 주석은 한국어로, 코드만 봐서는 알 수 없는 이유를 적습니다(내보내는 것은 `/** ... */`, 코드 안 설명은 `//`, 다른 파일은 경로).
- 커밋 메시지는 conventional commits(`feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `ci` ...). 이슈 번호는 GitHub 이슈일 때만.

[구조](architecture.md)를 보고, 기능을 더할 거라면 [모듈](modules.md)의 [새 모듈 만들기](modules.md#새-모듈-만들기-차례대로)로 갑니다.
