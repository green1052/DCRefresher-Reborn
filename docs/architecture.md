# 구조

디렉터리 구성, 콘텐츠·배경 스크립트가 도는 순서, 저장소와 HTTP 규칙입니다.

## 디렉터리

```
entrypoints/
  background/           배경 스크립트. page.ts는 탭의 페이지(MAIN world)에서 대신 실행하는 것
  content/              콘텐츠 스크립트. index.ts는 부트스트랩(IIFE), main.ts는 본문
  content-main.html     main.ts를 ESM 청크(chunks/content-main.js)로 묶는, 여는 일 없는 HTML 엔트리
  page.content.css      디시 페이지에 입히는 CSS (manifest로 따로 주입)
  upload-hook.ts        글쓰기 이미지 변환. 배경이 페이지(MAIN world)에 넣는 unlisted script
  options/, popup/
features/<id>/          기능 모듈 하나
  meta.ts               id·설정 스키마·단축키·토글 id (모든 번들이 읽는다)
  labels.ts             이름·설명·설정 문구 (옵션·팝업·단축키 설정이 읽는다)
  icons.ts              lucide 아이콘 (옵션·팝업이 읽는다)
  index.ts              페이지에서 하는 일 (할 일이 없는 모듈은 두지 않는다)
  background.ts         배경에서 하는 일 (선택)
  page.css              디시 페이지에 입히는 CSS (선택, 저절로 들어간다)
  overlay.tsx           오버레이 호스트 컴포넌트 (선택, 저절로 그려진다)
  overlay.css           오버레이(shadow) 안의 CSS (선택, 저절로 들어간다)
  ui/                   화면 컴포넌트 (선택)
modules/                WXT 로컬 모듈 (모듈 api·설정 타입, 단축키, 기능별 페이지 CSS).
                        WXT가 바로 아래 파일을 모두 모듈로 불러오므로 같이 쓰는 도우미는 lib/에 둔다
core/                   모듈 시스템, 저장소 키, HTTP, 차단 판정, 미리보기 요청·파싱, 백업, DB
stores/                 여러 화면이 같이 쓰는 zustand 스토어
utils/                  라이브러리로 대신할 수 없는 작은 도우미 (DOM, 이벤트, 오류, 해시, 이미지 지문 등)
components/ui/          shadcn 부품 (손으로 만들지 않고 CLI로 추가한다)
scripts/                IP DB 빌드 스크립트
```

`features/index.ts`가 `./*/index.ts`를, `features/meta.ts`가 `./*/meta.ts`·`labels.ts`·`icons.ts`를 glob으로 모아 합치므로 새 폴더를 따로 등록하지 않습니다. setup이 쓰는 HTTP·DOM 코드가 옵션·팝업 번들에 딸려 가지 않도록 콘텐츠 스크립트만 `features/index.ts`를 쓰고 옵션·팝업·`stores/modules.ts`는 `features/meta.ts`를 씁니다.

## 실행 흐름

### 콘텐츠 스크립트

`entrypoints/content/index.ts`가 디시 페이지(`core/pages.ts`의 `CONTENT_MATCHES`)에서 `document_start`에 실행됩니다.

`index.ts`는 얇은 부트스트랩입니다. 배포 빌드에서는 `content-main.html`이 만든 `chunks/content-main.js`를 불러 `main.ts`의 `start`를 부릅니다 — 옵션·팝업과 청크를 공유해 총량이 작아서입니다. 개발 빌드는 청크가 디스크에 나오지 않으므로 번들 안에서 직접 씁니다.

**본문 청크 안에서는 늦은 동적 import를 쓰지 않습니다.** 파이어폭스는 문서를 다시 읽은 뒤 콘텐츠 스크립트가 늦게 하는 청크 import가 실패합니다(버그 1803950 계열). 반면 스크립트 시작(document_start)의 이 부트스트랩 import는 믿을 수 있어 그대로 둡니다.

- 이 구조는 WXT 문서(ES Modules)가 안내하는 수동 구현입니다. WXT가 공식 지원(이슈 #357, v1.1)을 내면 `type: "module"`로 바꿔 걷습니다.
- 비동기 로더라 `run_at: document_start`를 완전히는 지키지 못합니다(본문 시작이 페이지 파싱보다 늦을 수 있습니다).
- 청크 이름은 `wxt.config.ts`의 `vite:build:extendConfig` 훅이 고정합니다(부트스트랩이 런타임에 경로로 찾으므로 해시가 들어가면 안 됩니다).
- 청크와 `content-scripts/content.css`는 웹 페이지에서도 접근할 수 있어야 하므로 `web_accessible_resources`에 디시 페이지에만 열어 둡니다(양 브라우저 MV3 객체 모양입니다).

아래는 `main.ts`가 하는 일입니다.

1. 단축키·팝업 메시지를 받을 준비를 합니다.
2. 저장소를 기다리기 전에 컨텍스트가 무효가 되면 모듈을 멈추는 처리를 겉니다(`stopAll`·`releaseDatabase`).
3. 오버레이는 화면에 그릴 것이 처음 생길 때 띄웁니다(`overlay.tsx`, [UI](ui.md#오버레이와-css)).
4. 글 목록·본문 페이지(`BOARD_PAGE`)면 차단·메모 스토어와 모듈 on/off·설정(`core/module/registry.ts`의 `loadAll`)을 동시에 읽습니다. 모듈의 `setup`은 차단·메모를 다 읽은 뒤에 돕니다.
5. 가장 큰 IP DB는 콘텐츠 스크립트가 읽지 않고 유저 정보 모듈의 `setup`이 모듈 설정을 읽은 뒤 읽습니다(`core/database.ts`의 `initDatabase`). 저장소는 요청 순서대로 읽히기 때문입니다. 다만 IP 정보 표시(`ipInfoFilter`)가 "표시 안 함"(`none`)이 아니거나 갱차 조회(`checkPermBan`)가 켜져 있을 때만 읽고, 나중에 설정을 켜면 그때 읽습니다(`features/userinfo/index.ts`의 `needsDatabase`). 모듈이 꺼져 있거나 둘 다 꺼져 있으면 버블이 IP 정보를 처음 그릴 때 읽습니다(`subscribeDatabase`). 밴 DB는 처음 조회할 때 읽습니다.

### 필터

모듈이 "이 선택자에 맞는 요소마다 이걸 해라"를 거는 방법입니다(`ctx.addFilter`, `core/filtering.ts`). 모듈마다 옵저버를 만들지 않고 `document.documentElement` 하나에 건 `MutationObserver`를 모든 필터가 같이 씁니다.

- **callback은 멱등이어야 합니다.** 같은 요소에 여러 번 불립니다.
- **이미 있던 조상에도 불립니다.** 자식이 붙어 조건을 새로 만족했을 수 있어, 추가된 노드의 부모마다 `closest(scope)`로도 찾습니다. "처음 보는 요소"라고 가정하지 마세요.
- mutation은 묶음으로 처리하고 가장 바깥 덩어리만 훑습니다(문서를 읽는 동안 한 묶음에 노드가 수천 개). 모든 필터 선택자를 합친 선택자로 먼저 걸러 냅니다.
- 기능이 행마다 넣는 장식(배지 묶음 등)에는 `FILTER_SKIP_ATTR`을 답니다. 붙이지 않으면 그 삽입이 다시 필터를 깨워 행마다 모든 필터가 한 번 더 돕니다.
- callback이 던지면 콘솔에만 남고 다른 필터는 그대로 돕니다. 틀린 선택자는 `addFilter`가 바로 던져 그 모듈의 setup이 실패합니다.

### 메시징

탭↔배경 메시지는 모두 `core/messaging/protocol.ts`의 `ProtocolMap` 한 곳에 타입과 함께 모읍니다. 이름은 `refresher:` 접두사를 붙이고, 배경에서 **딱 한 번만** 받습니다(`tests/unit/entrypoints/background/messages.test.ts`가 확인합니다). 배경을 거쳐 온 오류는 클래스를 잃으므로 `instanceof` 대신 `utils/error.ts`의 이름으로 보는 함수를 씁니다.

모듈은 이 문서를 불러온 주소(`core/http/urls.ts`의 `documentUrl`)로 판단합니다. 미리보기가 주소창을 글 주소로 바꿔도 페이지가 보여 주는 것은 그대로이기 때문입니다. 이 문서의 갤러리 id와 글 번호는 같은 파일의 `pageGallery`·`pagePostNo`를 씁니다.

### 배경 스크립트

배경은 뜰 때마다 리스너를 동기로 겁니다. Chrome은 서비스 워커, Firefox는 이벤트 페이지라 언제든 멈췄다 다시 뜨니 전역 변수에 상태를 두지 말고 저장소에 둡니다.

- `page.ts`: 콘텐츠 스크립트 대신 탭의 페이지(MAIN world)에서 실행합니다. 갈아끼운 목록에 디시 스크립트(`chk_user_block`, `UserMemo.renderWriterMemoBadges`)를 다시 거는 다리를 페이지마다 한 번 겁니다(`refresher:installListBridge`). 그 뒤로 콘텐츠 스크립트(`core/list.ts`의 `notifyListReplaced`)는 갤러리 id를 담은 `LIST_REPLACED_EVENT` 이벤트만 보내 배경을 깨우지 않습니다. 모듈 하나만 쓰는 것은 그 모듈의 `background.ts`가 같은 도우미(`core/module/background.ts`의 `runInPage`)로 합니다(미리보기의 reCAPTCHA·Turnstile 토큰). import가 필요한 코드는 직렬화해 넘길 수 없어 `entrypoints/`에 unlisted script로 따로 번들하고 `runFileInPage`로 넣습니다(글쓰기 이미지 변환).
- `database.ts`: IP·밴 DB를 하루마다 확인해 7일이 지났거나 저장 형식이 옛것이거나 저장 시각이 미래(시계가 앞섰을 때)면 받습니다. 알람은 배포 빌드에서만 만듭니다. 설치·업데이트 때도 받고 개발 빌드는 DB가 없을 때만 받습니다. 옵션의 "지금 갱신"도 직접 받지 않고 배경에 메시지(`refresher:updateDatabase`)를 보내 진행 중인 갱신과 겹치지 않게 합니다.
- 디시 통합검색과 갤로그는 CORS를 열지 않아 배경이 대신 받습니다. 관리 모듈의 같은 제목 찾기(`refresher:searchPosts`)와 검색 모듈의 아이디로 닉네임 찾기(`refresher:gallogPage`)입니다.
- 이미지 차단(`features/block/background.ts`)은 본문 이미지에 우클릭 메뉴(이 이미지 차단)를 걸고, 메뉴를 누를 때 본문 이미지 호스트의 선택 권한(`core/pages.ts`의 `IMAGE_HOST_ORIGINS`, `wxt.config.ts`의 `optional_host_permissions`)을 묻습니다. 모듈이 켜져 있는 동안 두 브라우저 모두 viewimage.php 요청에 CORS 헤더를 붙이는 declarativeNetRequest 세션 규칙을 걸고, 권한이 없으면(`*.dcinside.co.kr` 이미지) 이 규칙을 건너뜁니다. 해시는 콘텐츠 스크립트가 구합니다([기능별 구조](features.md#이미지-차단)).

## 저장소

- 모든 키는 `core/storage/items.ts`에 모읍니다. `storage.defineItem`을 쓰고 직접 만든 저장소 래퍼는 두지 않습니다.
- `defineItem`은 만드는 순간 값을 한 번 읽습니다. 그래서 항목은 모듈 최상위가 아니라 처음 쓸 때 만듭니다(`items.ts`의 `lazyItem`·getter).
- 읽기만 하는 곳은 항목을 만들지 않고 키로 읽고 감시합니다. 없는 값은 `null`이 오므로 받는 쪽이 기본값으로 맞춥니다.
  - 스토어처럼 키 여러 개를 읽고 따라가야 하면 `core/storage/sync.ts`의 `storageSync(keys, apply)`를 씁니다. 한 번에 읽고 키마다 감시하며 bfcache에서 돌아오면 다시 읽습니다.
  - 콘텐츠 스크립트의 감시는 `watchStorage(key, cb, signal)`로 컨텍스트의 signal에 묶습니다. 파이어폭스에서 다시 주입되면 남은 이전 인스턴스가 더 반응하지 않습니다.
  - 모듈 on/off와 설정은 `core/module/settings.ts`의 `readModuleStorage(ids)`로 읽고 `enablesOf`·`settingsOf`로 맞춥니다.
- 예외: IP·밴 DB(`DB_KEYS`)는 수백 KB라 항목을 아예 만들지 않고 `storage.getItem`·`storage.watch`로 다룹니다.
- 모듈 캐시(계속 불어나는 데이터)의 항목은 처음 쓸 때 `moduleDataStorage(id, fallback)`로 만들고, 읽기·감시는 `moduleDataKey(id)` 키로 합니다. 이 키는 백업 대상에서 빠집니다. 개수 상한을 두세요 (글댓비 캐시는 500명).
- 백업 대상은 `core/backup.ts`의 `BACKUP_KEYS`(모듈 on/off와 설정, 차단 목록과 기본 차단 모드, 메모)입니다. 새 키를 백업·내보내기에 넣으려면 여기에 추가합니다. 모듈 설정은 지금 있는 모듈 것만 넣고 가져올 때도 그것만 씁니다. 복원·초기화는 없어진 모듈이 남긴 설정도 지웁니다. 배경 번들에 모든 모듈의 `meta.ts`를 넣지 않도록 모듈 id는 `modules/module-types.ts`가 만드는 `.wxt/module-ids.ts`에서 읽습니다. `storage.sync` 한도는 `storage.sync.QUOTA_BYTES`·`QUOTA_BYTES_PER_ITEM`에서 읽습니다. 파이어폭스에는 이 상수가 없어 크롬과 같은 값(102,400·8,192바이트)을 대신 씁니다(`core/backup.ts`의 `CLOUD_QUOTA`).
- 차단 항목의 `mode`가 비어 있으면 그 기기의 기본 차단 모드를 따릅니다. 그래서 차단 목록을 다른 기기로 옮기는 곳은 내보낸 쪽의 기본 모드가 다르면 그 모드를 항목에 적어 둡니다. 새로 옮기는 경로를 만들 때도 같은 규칙을 따릅니다.
- 설정을 없애거나 이름을 바꿀 때 옛 값을 옮기는 코드는 두지 않습니다. 옵션·팝업을 열면 `stores/modules.ts`의 `pruneStaleSettings`가 스키마에 없는 설정을 지워서 이름을 바꾼 설정은 기본값으로 돌아갑니다.
- 차단·메모의 마지막 사용 시각(`refresher:usage`, `core/usage.ts`)은 여러 탭이 함께 고치는 값이라 쓰기는 배경이 메시지를 받아 차례로 합니다. 기기마다 다른 값이라 백업하지 않습니다. 옵션 페이지는 목록이 바뀔 때마다 기록을 목록에 맞추지만, 지운 항목의 기록은 페이지를 열고 처음 맞출 때만 버립니다. 그 뒤에 지운 항목은 삭제 알림의 되돌리기로 같은 id가 돌아오므로 원래 시각을 지키려고 남깁니다.
- 클라우드 복원·합치기, JSON 가져오기, 초기화가 저장소에 쓰는 규칙은 `core/settings-transfer.ts`에 모여 있습니다. 쓰기를 마치면 직전 값을 `backupStorage.undo`(`refresher:backup:undo`, 백업 대상 아님)에 남겨 데이터 탭의 되돌리기가 씁니다. `storage.local`을 직접 다루는 곳은 키 이름을 문자열로 적지 말고 `rawKey(MODULES_KEY)`처럼 `items.ts`의 키에서 만듭니다.

## 스토어

`stores/`의 zustand 스토어는 콘텐츠 스크립트와 옵션·팝업이 **같은 파일을 같이** 씁니다. 차단(`blocks.ts`)·메모(`memos.ts`)는 `core/storage/sync.ts`의 `typedListSync`로 저장소와 양방향으로 묶여 있습니다.

- 그리기 전에 `initBlocksStore()`·`initMemosStore()`가 끝나야 합니다. 안 기다리면 빈 목록이 저장소를 덮습니다.
- **`update(type, change)`의 `change`는 순수해야 합니다.** 스토어 값과 (잠금 안에서 다시 읽은) 저장소 값에 두 번 불리고, 결과는 저장소 쪽으로 맞춰집니다. 안에서 무작위 값이나 `Date.now()`를 고르면 저장 뒤에 화면이 한 번 바뀝니다 — 밖에서 미리 정해 넘기세요.
- 목록 쓰기는 읽고-고쳐-쓰기라 Web Locks로 줄을 세웁니다. **잠금은 같은 출처끼리만 섭니다**: 디시 탭끼리, 옵션↔팝업끼리는 서지만 **디시 탭과 옵션 페이지 사이는 서지 않습니다**(Chrome도 마찬가지). 교차 출처로 같은 키를 쓰는 경로를 새로 만들면 배경을 거치게 하세요. 파이어폭스 콘텐츠 스크립트는 `navigator.locks`가 Xray 경계에서 실패해 탭 안에서만 p-limit으로 줄을 세웁니다([Firefox](firefox.md)).
- 저장소에서 돌아온 값이 지금 값과 같으면(`canonical` 비교) 스토어를 건드리지 않습니다. 배지 전체를 다시 그리는 구독자가 깨지 않게 하기 위함입니다.

## HTTP

`core/http/client.ts`의 `http`(일반 요청)와 `ajax`(`X-Requested-With` 헤더를 붙인 디시 ajax 요청)를 씁니다.

- Firefox 콘텐츠 스크립트에서는 두 클라이언트 모두 `content.fetch`로 보냅니다. 페이지가 보낸 요청처럼 나가야 디시 ajax가 받아 줍니다.
- 시간 제한은 기본으로 걸지 않습니다(`timeout: false`). 모든 요청에 호출한 쪽의 AbortSignal이 붙어 있어 사용자가 창을 닫거나 페이지를 떠나면 끊깁니다. `AbortSignal.timeout`은 파이어폭스 샌드박스에서 던지므로 쓰지 않습니다([Firefox](firefox.md)).
- 요청 전체에 기본 제한은 없습니다(`totalTimeout: false`). 제한이 필요한 호출만 ky의 `totalTimeout`을 줍니다(글 목록 새로고침의 `LIST_TIMEOUT` 30초).
- 예외: 본문 이미지(`core/block.ts`의 `imageHash`)는 콘텐츠 스크립트 자체의 fetch가 필요해(파이어폭스의 `content.fetch`는 페이지 CORS에 걸립니다) `http`/`ajax` 대신 기본 ky로 받습니다. 자기 제한(`fetchLimit`, 4개)과 전체 60초 상한(`totalTimeout`, ky `timeout`은 끔)을 씁니다. 본문은 같은 요청의 `.blob()`으로 읽습니다.
- 재시도는 하지 않습니다(`retry: 0`). 실패는 호출한 쪽에서 처리합니다.
- 갤러리 종류는 `core/http/urls.ts`의 `galleryKind(url)`로 다룹니다. 주소 경로와 `_GALLTYPE_` 값은 같은 파일의 표에만 두고 `galleryPath`·`galltypeOf`로 꺼냅니다.
- 폼 본문은 `formBody({...})`로 만듭니다. 값이 `null`·`undefined`·`false`인 필드는 빠지고 빈 문자열은 들어갑니다. CSRF 토큰(`ci_t`)이 붙는 디시 요청은 `csrfBody({...})`(`core/http/cookie.ts`)를 씁니다. 끊은 요청인지는 `isAbortError(e)`(`utils/error.ts`)로 봅니다.
