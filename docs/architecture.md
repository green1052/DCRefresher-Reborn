# 구조

디렉터리 구성, 콘텐츠·배경 스크립트가 도는 순서, 저장소와 HTTP 규칙입니다.

## 디렉터리

```
entrypoints/
  background/           배경 스크립트. page.ts는 탭의 페이지(MAIN world)에서 대신 실행하는 것
  content/              콘텐츠 스크립트. stale.ts는 파이어폭스 재주입으로 죽은 인스턴스 정리
  page.content.css      디시 페이지에 입히는 CSS (manifest로 따로 주입)
  options/, popup/
features/<id>/          기능 모듈 하나
  meta.ts               이름·아이콘·설정 스키마 (옵션·팝업이 읽는다)
  index.ts              페이지에서 하는 일 (할 일이 없는 모듈은 두지 않는다)
  background.ts         배경에서 하는 일 (선택)
  page.css              디시 페이지에 입히는 CSS (선택, 저절로 들어간다)
  overlay.css           오버레이(shadow) 안의 CSS (선택, 저절로 들어간다)
  ui/                   화면 컴포넌트 (선택)
modules/                WXT 로컬 모듈 (모듈 api·설정 타입, 단축키, 기능별 페이지 CSS).
                        WXT가 바로 아래 파일을 모두 모듈로 불러오므로 같이 쓰는 도우미는 lib/에 둔다
core/                   모듈 시스템, 저장소 키, HTTP, 차단 판정, 미리보기 요청·파싱, 백업, DB
stores/                 여러 화면이 같이 쓰는 zustand 스토어
components/ui/          shadcn 부품 (손으로 만들지 않고 CLI로 추가한다)
scripts/                IP DB 빌드 스크립트
```

`features/index.ts`가 `./*/index.ts`를, `features/meta.ts`가 `./*/meta.ts`를 glob으로 모으므로 새 폴더를 따로 등록하지 않습니다. setup이 쓰는 HTTP·DOM 코드가 옵션·팝업 번들에 딸려 가지 않도록 콘텐츠 스크립트만 `features/index.ts`를 쓰고 옵션·팝업·`stores/modules.ts`는 `features/meta.ts`를 씁니다.

## 실행 흐름

### 콘텐츠 스크립트

`entrypoints/content/index.tsx`가 디시 페이지(`core/pages.ts`의 `CONTENT_MATCHES`)에서 `document_start`에 실행됩니다.

1. Firefox가 재주입하며 남긴 옛 오버레이와 잠금을 걷어 내고(`stale.ts`), 단축키·팝업 메시지를 받을 준비를 합니다.
2. 저장소를 기다리기 전에 컨텍스트가 무효가 되면 모듈을 멈추는 처리를 겁니다. 확장이 정말 없어졌을 때만 새로고침 안내를 띄웁니다(`invalidated.ts`).
3. 오버레이는 화면에 그릴 것이 처음 생길 때 띄웁니다(`overlay.tsx`, [UI](ui.md#오버레이와-css)).
4. 글 목록·본문 페이지(`BOARD_PAGE`)면 차단·메모 스토어와 모듈 on/off·설정(`core/module/registry.ts`의 `loadAll`)을 동시에 읽습니다. 모듈의 `setup`은 차단·메모를 다 읽은 뒤에 돕니다.
5. 가장 큰 IP DB는 콘텐츠 스크립트가 읽지 않고 유저 정보 모듈의 `setup`이 모듈 설정을 읽은 뒤 읽습니다(`core/database.ts`의 `initDatabase`). 저장소는 요청 순서대로 읽히기 때문입니다. 모듈이 꺼져 있으면 버블·미리보기가 IP 정보를 처음 그릴 때 읽습니다(`subscribeDatabase`). 밴 DB는 처음 조회할 때 읽습니다.

모듈은 이 문서를 불러온 주소(`core/http/urls.ts`의 `documentUrl`)로 판단합니다. 미리보기가 주소창을 글 주소로 바꿔도 페이지가 보여 주는 것은 그대로이기 때문입니다.

### 배경 스크립트

배경은 뜰 때마다 리스너를 동기로 겁니다. Chrome은 서비스 워커라 언제든 멈췄다 다시 뜨니 전역 변수에 상태를 두지 말고 저장소에 둡니다.

- `page.ts`: 콘텐츠 스크립트 대신 탭의 페이지(MAIN world)에서 실행합니다. reCAPTCHA 토큰, 갈아끼운 목록에 디시 스크립트 다시 걸기를 맡습니다. 모듈 하나만 쓰는 것은 그 모듈의 `background.ts`가 같은 도우미(`core/module/background.ts`의 `runInPage`)로 합니다(글쓰기 이미지 변환).
- `database.ts`: IP·밴 DB를 하루마다 확인해 7일이 지났거나 저장 형식이 옛것이면 받습니다. 알람은 배포 빌드에서만 만듭니다. 설치·업데이트 때도 받고 개발 빌드는 DB가 없을 때만 받습니다. 옵션의 "지금 갱신"도 직접 받지 않고 배경에 메시지(`refresher:updateDatabase`)를 보내 진행 중인 갱신과 겹치지 않게 합니다.
- 디시 통합검색은 CORS를 열지 않아서 관리 모듈의 같은 제목 찾기는 배경이 받아 줍니다(`refresher:searchPosts`).

## 저장소

- 모든 키는 `core/storage/items.ts`에 모읍니다. `storage.defineItem`을 쓰고 직접 만든 저장소 래퍼는 두지 않습니다.
- `defineItem`은 만드는 순간 값을 한 번 읽습니다. 그래서 항목은 모듈 최상위가 아니라 처음 쓸 때 만듭니다(`items.ts`의 `lazyItem`·getter).
- 읽기만 하는 곳은 항목을 만들지 않고 키로 읽고 감시합니다. 없는 값은 `null`이 오므로 받는 쪽이 기본값으로 맞춥니다.
  - 스토어처럼 키 여러 개를 읽고 따라가야 하면 `core/storage/sync.ts`의 `storageSync(keys, apply)`를 씁니다. 한 번에 읽고 키마다 감시하며 bfcache에서 돌아오면 다시 읽습니다.
  - 콘텐츠 스크립트의 감시는 `watchStorage(key, cb, signal)`로 컨텍스트의 signal에 묶습니다. 파이어폭스에서 다시 주입되면 남은 이전 인스턴스가 더 반응하지 않습니다.
  - 모듈 on/off와 설정은 `core/module/settings.ts`의 `readModuleStorage(ids)`로 읽고 `enablesOf`·`settingsOf`로 맞춥니다.
- 예외: IP·밴 DB(`DB_KEYS`)는 수백 KB라 항목을 아예 만들지 않고 `storage.getItem`·`storage.watch`로 다룹니다.
- 모듈 캐시(계속 불어나는 데이터)는 `moduleDataStorage(id, fallback)`로 `setup` 안에서 만듭니다. 이 키는 백업 대상에서 빠집니다. 개수 상한을 두세요 (글댓비 캐시는 500명).
- 백업 대상은 `core/backup.ts`의 `BACKUP_KEYS`(모듈 on/off와 설정, 차단 목록과 기본 차단 모드, 메모)입니다. 새 키를 백업·내보내기에 넣으려면 여기에 추가합니다. 모듈 설정은 지금 있는 모듈 것만 넣고 가져올 때도 그것만 씁니다. 복원·초기화는 없어진 모듈이 남긴 설정도 지웁니다. 배경이 `meta.ts`(React)를 불러오지 않도록 모듈 id는 `modules/module-types.ts`가 만드는 `.wxt/module-ids.ts`에서 읽습니다. `storage.sync` 한도는 숫자로 적지 않고 `storage.sync.QUOTA_BYTES`·`QUOTA_BYTES_PER_ITEM`에서 읽습니다.
- 차단 항목의 `mode`가 비어 있으면 그 기기의 기본 차단 모드를 따릅니다. 그래서 차단 목록을 다른 기기로 옮기는 곳은 내보낸 쪽의 기본 모드가 다르면 그 모드를 항목에 적어 둡니다. 새로 옮기는 경로를 만들 때도 같은 규칙을 따릅니다.
- 설정을 없애거나 이름을 바꿀 때 옛 값을 옮기는 코드는 두지 않습니다. 옵션·팝업을 열면 `stores/modules.ts`의 `pruneStaleSettings`가 스키마에 없는 설정을 지워서 이름을 바꾼 설정은 기본값으로 돌아갑니다.
- 차단·메모의 마지막 사용 시각(`refresher:usage`, `core/usage.ts`)은 여러 탭이 함께 고치는 값이라 쓰기는 배경이 메시지를 받아 차례로 합니다. 기기마다 다른 값이라 백업하지 않습니다.
- 클라우드 복원·합치기, JSON 가져오기, 초기화가 저장소에 쓰는 규칙은 `core/settings-transfer.ts`에 모여 있습니다. `storage.local`을 직접 다루는 곳은 키 이름을 문자열로 적지 말고 `rawKey(MODULES_KEY)`처럼 `items.ts`의 키에서 만듭니다.

## HTTP

`core/http/client.ts`의 `http`(일반 요청)와 `ajax`(`X-Requested-With` 헤더를 붙인 디시 ajax 요청)를 씁니다.

- 두 클라이언트가 p-limit 제한기 하나를 같이 써서 합친 동시 요청 수를 제한합니다. 제한 값은 "요청 제한" 모듈 설정이고 탭마다 따로 셉니다.
- Firefox 콘텐츠 스크립트에서는 두 클라이언트 모두 `content.fetch`로 보냅니다. 페이지가 보낸 요청처럼 나가야 디시 ajax가 받아 줍니다.
- 응답 머리의 시간 제한(15초)은 동시 요청 수 제한의 차례를 받은 뒤부터 머리를 받을 때까지만 잽니다. ky의 `timeout`은 차례를 기다리는 시간까지 재므로 쓰지 않습니다(호출할 때도 주지 마세요). `AbortSignal.timeout`도 쓰지 않습니다([Firefox](firefox.md)).
- 요청 전체(차례 기다림·재시도·차단 검사·본문 읽기)에는 ky의 `totalTimeout`(60초)을 겁니다. 머리를 받은 뒤 본문이 멈춰도 요청이 끝나게 하려는 것입니다. 본문은 ky의 `.text()`·`.json()`으로 읽어야 이 제한에 묶입니다. 더 짧게 끊을 요청은 호출할 때 `totalTimeout`을 줍니다(글 목록 새로고침의 `LIST_TIMEOUT`). IP/밴 DB 받기는 `totalTimeout: false`로 뺍니다.
- 재시도는 ky 기본값에 지터를 더하고 `Retry-After`는 최대 10초까지만 기다립니다. 시간 초과·`BlockedError`·POST는 재시도하지 않습니다.
- 요청이 너무 많으면 디시는 200으로 빈 페이지를 줍니다. 클라이언트는 dcinside.com의 GET 응답과 `/board/comment/` 아래 요청이 비어 있을 때만 `BlockedError`를 던집니다. 콘텐츠 스크립트가 따로 안내를 띄우니 기능 쪽에서는 `e instanceof BlockedError`일 때 자기 오류 토스트를 건너뜁니다(`stores/notify.ts` 참고).
- 갤러리 종류는 `core/http/urls.ts`의 `galleryKind(url)`로 다룹니다. 주소 경로와 `_GALLTYPE_` 값은 같은 파일의 표에만 두고 `galleryPath`·`galltypeOf`로 꺼냅니다.
- 폼 본문은 `formBody({...})`로 만듭니다. 값이 `null`·`undefined`·`false`인 필드는 빠지고 빈 문자열은 들어갑니다. CSRF 토큰(`ci_t`)이 붙는 디시 요청은 `csrfBody({...})`(`core/http/cookie.ts`)를 씁니다. 끊은 요청인지는 `isAbortError(e)`로 봅니다.
