# Firefox

Chrome에서만 시험하면 드러나지 않는 Firefox 문제입니다. 6.0.2에서는 아래 항목 중 첫째(`AbortSignal.timeout`)와 셋째(확장 페이지의 내비게이션 항목 이름)가 Firefox에서만 깨졌습니다. Firefox 쪽도 꼭 실행해 보세요([테스트](testing.md)).

- **콘텐츠 스크립트의 전역은 창(Window)이 아니라 샌드박스입니다.** 창이 있어야 하는 정적 API는 던집니다. 예를 들어 `AbortSignal.timeout()`은 "Could not find window"로 던져 모든 요청이 실패했습니다. `AbortController`와 `setTimeout`처럼 창이 없어도 되는 방법을 씁니다. `AbortSignal.any`, `AbortSignal.abort`는 괜찮습니다.
- **페이지 쪽 객체는 다른 영역(compartment)에서 옵니다.** `content.fetch`의 응답과 오류, `event.detail` 같은 값은 `instanceof`가 틀릴 수 있습니다. 오류는 `name`·`message`로 판단합니다(`isAbortError`, `utils/error.ts`의 `messageOf`).
- **`content.fetch`가 준 Promise에 `finally` 등으로 이은 Promise는 이쪽에서 기다려도 처리되지 않은 것으로 칩니다.** 끊은 요청마다 AbortError가 콘솔에 남았습니다. `core/http/client.ts`가 `then`으로 곧바로 콘텐츠 스크립트의 Promise에 옮겨 담습니다.
- **확장 페이지(배경·옵션·팝업)의 내비게이션 항목 이름은 URL이 아니라 `"document"`입니다.** `performance.getEntriesByType("navigation")[0].name`을 `new URL()`에 그대로 넣으면 던져 배경·옵션·팝업이 통째로 멈췄습니다. 모듈 최상위에서 URL을 만들 때는 `URL.parse(...) ?? ...`처럼 던지지 않게 합니다.
- **브라우저 분기는 `import.meta.env.BROWSER === "firefox"`로 합니다.** `import.meta.env.FIREFOX`는 Vitest 5가 문자열(`"false"`)로 바꿔 넣어 단위 테스트에서 참이 됩니다.
- **MV2라 배경은 서비스 워커가 아니라 배경 페이지입니다.** 알람·메뉴·단축키는 두 브라우저에서 다 확인합니다.
- **페이지의 `navigator.locks`에 콘텐츠 스크립트의 콜백을 넘기면 이유 없는 `Error`로 실패합니다.** 차단·메모 저장이 모두 실패했습니다. 쓰기 직렬화(`core/storage/sync.ts`)는 파이어폭스 콘텐츠 스크립트에서 잠그지 않습니다.
- **Firefox 전용 API**는 `wxt/browser` 타입(Chrome 기준)에 없습니다. 지금은 `browser.commands.openShortcutSettings()` 한 곳이라 `// @ts-ignore`에 이유를 적어 두었습니다. 이런 곳이 늘어나면 그때 타입 선언을 추가합니다.
