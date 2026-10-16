# Firefox

Chrome에서만 시험해서는 드러나지 않는 Firefox 문제를 모았습니다. Firefox 쪽도 꼭 실행해 보세요([테스트](testing.md)).

- **콘텐츠 스크립트의 전역은 창(Window)이 아니라 샌드박스입니다.** 창이 있어야 하는 정적 API는 던집니다. 예를 들어 `AbortSignal.timeout()`은 "Could not find window"로 던져 모든 요청이 실패했습니다. `AbortController`와 `setTimeout`처럼 창이 없어도 되는 방법을 씁니다. `AbortSignal.any`, `AbortSignal.abort`는 괜찮습니다.
- **페이지 쪽 객체는 다른 영역(compartment)에서 옵니다.** `content.fetch`의 응답과 오류, `event.detail` 같은 값은 `instanceof`가 틀릴 수 있습니다. 오류는 `name`·`message`로 판단합니다(`isAbortError`, `utils/error.ts`의 `messageOf`).
- **`content.fetch`가 준 Promise에 `finally` 등으로 이은 Promise는 이쪽에서 기다려도 처리되지 않은 것으로 칩니다.** `core/http/client.ts`가 `then`으로 곧바로 콘텐츠 스크립트의 Promise에 옮겨 담습니다.
- **확장 페이지(배경·옵션·팝업)에서는 내비게이션 항목 이름이 URL 대신 `"document"`로 들어옵니다.** `performance.getEntriesByType("navigation")[0].name`을 `new URL()`에 그대로 넣으면 던져서 이 세 페이지가 통째로 멈춥니다. 모듈 최상위에서 URL을 만들 때는 `URL.parse(...) ?? ...`처럼 던지지 않게 합니다.
- **브라우저 분기는 `import.meta.env.BROWSER === "firefox"`로 합니다.** `import.meta.env.FIREFOX`는 Vitest가 문자열(`"false"`)로 바꿔 넣어 단위 테스트에서 참이 됩니다.
- **MV2라 배경은 서비스 워커가 아닌 배경 페이지로 돕니다.** 알람과 메뉴, 단축키는 두 브라우저에서 다 확인합니다.
- **페이지의 `navigator.locks`에 콘텐츠 스크립트의 콜백을 넘기면 이유 없는 `Error`로 실패합니다.** 쓰기 직렬화(`core/storage/sync.ts`)는 파이어폭스 콘텐츠 스크립트에서 잠그지 않습니다.
- **Firefox 전용 API**는 `wxt/browser` 타입(Chrome 기준)에 없습니다. 한 줄로 끝나는 `browser.commands.openShortcutSettings()`는 `// @ts-expect-error`에 이유를 적어 두었습니다. 나중에 타입이 생기면 이 주석이 오류가 되어 지울 때를 알려 줍니다. 이벤트 처리기까지 타입이 필요한 `webRequest.filterResponseData`(이미지 차단)는 `features/block/stream-filter.d.ts`가 `@wxt-dev/browser/src/gen`을 보강해 쓰는 만큼만 적습니다. 타입이 생기면 이 파일을 지웁니다.
- **콘텐츠 스크립트의 `fetch`는 페이지와 HTTP 캐시를 같이 쓰지 않습니다.** 페이지가 이미 받은 이미지도 다시 받습니다. 이미지 차단은 배경이 `filterResponseData`로 페이지의 응답을 흘려보내며 해시를 구해 두고 탭이 물어 갑니다(`features/block/background.ts`). 같은 탭이 메모리 캐시의 이미지를 다시 쓰면 요청이 없어 webRequest가 지나가지 않으므로 해시는 주소별로 남겨 둡니다.
- **지문 방지 설정(`privacy.resistFingerprinting`, `privacy.fingerprintingProtection`)을 켜면 웹 페이지 쪽 캔버스의 `getImageData`에 잡음이 섞입니다.** 확장 배경 페이지는 섞이지 않습니다. 비슷한 이미지 지문(`utils/imageFingerprint.ts`)은 그래서 배경이 구합니다. 다만 배경은 그 설정이 켜져 있을 때만 구하므로, 꺼진 채 우클릭 차단하면 탭이 이미지를 다시 받아 지문을 구합니다. 이때는 잡음이 섞일 수 있습니다.
