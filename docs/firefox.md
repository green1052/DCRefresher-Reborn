# Firefox

- 콘텐츠 스크립트 전역은 창이 아닌 샌드박스라 창이 필요한 정적 API(예: `AbortSignal.timeout()`)는 던지고, 페이지 쪽 객체는 다른 영역에서 와 `instanceof`가 틀릴 수 있습니다(오류는 `name`, `message`로 판단, `utils/error.ts`).
- `content.fetch`의 Promise에 이은 Promise는 처리되지 않은 것으로 쳐 `core/http/client.ts`가 `then`으로 옮겨 담습니다.
- 페이지의 `navigator.locks`에 콜백을 넘기면 실패해 쓰기 직렬화는 탭 안에서만 줄을 세웁니다.
- 확장 페이지에서 내비게이션 항목 이름이 URL 대신 `"document"`로 들어와 `new URL()`이 던집니다. `URL.parse(...) ?? ...`를 씁니다. 배경은 이벤트 페이지라 알람, 메뉴, 단축키는 두 브라우저에서 확인합니다.
- 브라우저 분기는 `import.meta.env.BROWSER === "firefox"`(Vitest가 `FIREFOX`를 문자열로 바꿔 테스트에서 참). Firefox 전용 API는 `wxt/browser` 타입에 없어 `// @ts-expect-error`를 붙입니다.

Firefox도 꼭 실행해 보세요([테스트](testing.md)).
