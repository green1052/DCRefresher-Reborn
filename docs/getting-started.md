# 시작하기

쓰는 기술, 개발 환경을 띄우는 방법, 코드 규칙입니다.

## 스택

| 항목 | 사용 |
|------|------|
| 확장 프레임워크 | [WXT](https://wxt.dev). Chrome은 MV3, Firefox는 MV2. manifest에 최소 브라우저 버전은 적지 않는다(`minimum_chrome_version`·`strict_min_version` 없음). 다만 코드가 쓰는 API 때문에 Chrome 140·Firefox 140 이상이어야 돈다(`Uint8Array`의 `toBase64`·`fromBase64`·`toHex`는 Chrome 140, Cookie Store API(`core/http/cookie.ts`)는 Firefox 140. `URL.parse`, `Set` 메서드, `AbortSignal.any`, `Map.groupBy`, `RegExp.escape`, `Iterator.from`은 그보다 낮다). 이 API들은 빌드가 바꿔 주지 않는다 |
| UI | [Preact](https://preactjs.com) 11 (코드는 `react`에서 import하고 `@preact/preset-vite`가 `preact/compat`으로 바꾼다) + React Compiler(`@vitejs/plugin-react`의 컴파일러 플러그인만 Babel 없이 oxc(`oxc-transform-react`)로 돌린다. React 18 대상이라 `react-compiler-runtime`을 쓴다), [shadcn/ui](https://ui.shadcn.com) (Base UI, `components.json`의 base-vega 스타일, zinc 기본색에 indigo 테마) + [Tailwind CSS](https://tailwindcss.com) v4 (`@tailwindcss/vite`) |
| 상태 | zustand |
| 저장소 | WXT storage (`wxt/utils/storage`) |
| HTTP | ky + `utils/limit.ts`(동시 요청 수 제한) |
| 캐시 | `utils/lru.ts`의 `LruCache` (Map으로 만든 작은 메모리 캐시) |
| HTML 정화 | DOMPurify (`utils/sanitize.ts`) |
| 메시징 | @webext-core/messaging |
| 타입 도우미 | `utils/typed.ts` (`objectKeys`, `objectEntries`, `objectFromEntries`, `arrayIncludes`. 내장 함수에 타입만 붙인 것) |
| 패키지 관리·실행 | Bun 1.4 이상. `scripts/`는 Bun으로 돌아 Bun API(`Bun.file`·`Bun.write`)를 쓴다. WXT·Vitest·Playwright는 Node에서 돌므로(Vitest의 jsdom은 Bun에서 뜨지 않고, Playwright는 Bun에서 무작위로 멈춘다) 빌드 모듈(`modules/`)과 E2E는 Node API를 쓴다 |
| 테스트 | Vitest (`wxt/testing/vitest-plugin`, fake-browser), Playwright (`e2e`) |

## 명령

```sh
bun install            # 의존성 설치 (postinstall이 wxt prepare로 .wxt 타입을 만든다)
bun run dev            # Chrome 개발 모드 (코드를 고치면 다시 빌드하고 확장을 새로 불러온다)
bun run dev:firefox    # Firefox 개발 모드
bun run compile        # 타입 검사 (tsc --noEmit)
bun run test           # 단위 테스트 (Vitest). test:watch는 지켜보며 다시 돈다
bun run build          # .output/chrome-mv3
bun run e2e            # E2E (Playwright, 크로미엄에 확장을 올린다). 먼저 bun run build, 처음 한 번 bunx playwright install chromium
bun run build:firefox  # .output/firefox-mv2
bun run e2e:firefox    # 파이어폭스 E2E. 먼저 bun run build:firefox, 처음 한 번 bunx playwright install firefox
bun run e2e:live       # 실제 디시 E2E. 디시 마크업·API가 바뀌었는지 본다
bun run zip            # 배포용 zip
bun run zip:firefox    # Firefox zip + 소스 zip
```

`tsconfig.json`은 `noUnusedLocals`, `noUnusedParameters`를 켜 둡니다. 커밋 전에 `bun run compile`, `bun run test`, `bun run build`가 통과해야 합니다. 이 검사들과 크로미엄·파이어폭스 E2E는 PR마다 CI 워크플로(`.github/workflows/ci.yml`)에서 돕니다.

## 코드 규칙

- 반복은 `for...of`를 씁니다 (`forEach` 대신). catch 변수는 `e`, 이벤트 매개변수는 `ev`입니다.
- 브라우저 기본 기능과 WXT 기능으로 되면 그것을 씁니다. 라이브러리는 직접 만들면 위험하거나 큰 것(DOMPurify, ky 등)만 둡니다. 몇 줄로 대신할 수 있는 것은 `utils/`에 둡니다(`typed.ts`, `limit.ts`, `lru.ts`). 라이브러리 코드는 패치하지 않습니다.
- 기능 하나를 고칠 때 여러 화면을 건드리지 않도록 모듈 구조를 따릅니다([모듈](modules.md)). 옵션·팝업은 모듈 정의(스키마, `extensionPageVars`, `pageToggles`)만 보고 그립니다.
- 타입은 정확하게 씁니다. 경계에서 `unknown`을 넘기거나 `as`로 덮지 말고 값을 검사해 좁힙니다.
- 주석은 한국어로, 코드만 봐서는 알 수 없는 이유(디시·브라우저 동작, 순서 제약, 성능 이유)를 적습니다.
  - 문장은 "~다."처럼 마침표로 끝냅니다. 주석의 마지막 문장도 마찬가지입니다. 구분선(`// ===== … =====`)과 영어 라벨에는 찍지 않습니다.
  - 내보내는 함수·상수·타입은 `/** … */`, 코드 안의 설명은 `//`를 씁니다.
  - 다른 파일을 가리킬 때는 경로를 적습니다(`core/storage/sync.ts`). 파일을 옮기면 가리키던 주석도 같이 고칩니다.
- 커밋 메시지는 conventional commits(`feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `ci` …)를 따릅니다. 이슈 번호는 GitHub 이슈일 때만 적습니다.
