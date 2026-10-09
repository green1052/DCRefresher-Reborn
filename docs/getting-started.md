# 시작하기

이 문서에는 쓰는 기술과 개발 환경을 띄우는 방법, 코드 규칙을 모았습니다.

## 스택

| 항목 | 사용 |
|------|------|
| 확장 프레임워크 | [WXT](https://wxt.dev). Chrome은 MV3, Firefox는 MV2. manifest의 최소 버전(Chrome 140, Firefox 144)은 코드가 쓰는 API 중 가장 늦게 들어온 것에 맞춥니다. 빌드가 바꿔 주지 않으므로 더 새 API를 쓰면 `wxt.config.ts`에서 같이 올립니다 |
| UI | [Preact](https://preactjs.com) 11 + React Compiler, [shadcn/ui](https://ui.shadcn.com)(Base UI) + [Tailwind CSS](https://tailwindcss.com) v4. 코드는 `react`에서 import합니다([UI](ui.md#부품)) |
| 상태 | zustand |
| 저장소 | WXT storage (`wxt/utils/storage`) |
| HTTP | ky + `utils/limit.ts`(동시 요청 수 제한) |
| HTML 정화 | DOMPurify (`utils/sanitize.ts`) |
| 메시징 | @webext-core/messaging |
| 패키지 관리·실행 | Bun 1.4 이상. `scripts/`는 Bun에서 돌아 Bun API를 씁니다. WXT·Vitest·Playwright는 Node에서 돌므로 빌드 모듈(`modules/`)과 E2E는 Node API를 씁니다 |
| 테스트 | Vitest, Playwright ([테스트](testing.md)) |

## 명령

```sh
bun install            # 의존성 설치 (postinstall이 wxt prepare로 .wxt 타입을 만든다)
bun run dev            # Chrome 개발 모드 (dev:firefox는 Firefox)
bun run compile        # 타입 검사 (tsc --noEmit)
bun run test           # 단위 테스트. test:watch는 지켜보며 다시 돈다
bun run build          # .output/chrome-mv3 (build:firefox는 .output/firefox-mv2)
bun run e2e            # E2E. 먼저 build, 처음 한 번 bunx playwright install chromium
bun run e2e:firefox    # 파이어폭스 E2E. 먼저 build:firefox, 처음 한 번 bunx playwright install firefox
bun run e2e:live       # 실제 디시 E2E. 디시 마크업·API가 바뀌었는지 본다
bun run zip            # 배포용 zip (zip:firefox는 Firefox zip + 소스 zip)
```

커밋 전에 `bun run compile`, `bun run test`, `bun run build`가 통과해야 합니다. 이 검사들과 크로미엄과 파이어폭스 E2E는 PR마다 CI(`.github/workflows/ci.yml`)에서 돕니다.

## 코드 규칙

- 반복은 `for...of`를 씁니다 (`forEach` 대신). catch 변수는 `e`, 이벤트 매개변수는 `ev`입니다.
- 브라우저 기본 기능과 WXT 기능으로 되면 그것을 씁니다. 라이브러리는 직접 만들면 위험하거나 큰 것(DOMPurify, ky 등)만 두고 몇 줄로 대신할 수 있는 것은 `utils/`에 둡니다(`typed.ts`, `limit.ts`). 라이브러리 코드는 패치하지 않습니다.
- 기능 하나를 고칠 때 여러 화면을 건드리지 않도록 모듈 구조를 따릅니다([모듈](modules.md)). 옵션·팝업은 모듈 정의(스키마, `extensionPageVars`, `pageToggles`)만 보고 그립니다.
- 타입은 정확하게 씁니다. 경계에서 `unknown`을 넘기거나 `as`로 덮지 말고 값을 검사해 좁힙니다.
- 주석은 한국어로, 코드만 봐서는 알 수 없는 이유(디시·브라우저 동작, 순서 제약, 성능 이유)를 적습니다.
  - 문장은 "~다."처럼 마침표로 끝내되 구분선(`// ===== … =====`)과 영어 라벨에는 찍지 않습니다.
  - 내보내는 함수·상수·타입은 `/** … */`, 코드 안의 설명은 `//`를 씁니다.
  - 다른 파일을 가리킬 때는 경로를 적습니다(`core/storage/sync.ts`). 파일을 옮기면 가리키던 주석도 같이 고칩니다.
- 커밋 메시지는 conventional commits(`feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `ci` …)를 따릅니다. 이슈 번호는 GitHub 이슈일 때만 적습니다.
