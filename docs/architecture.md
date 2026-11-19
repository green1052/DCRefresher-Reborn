# 구조

## 디렉터리

```
entrypoints/
  background/           배경 스크립트. page.ts는 탭의 페이지(MAIN world)에서 실행
  content/              콘텐츠 스크립트. index.ts는 부트스트랩(IIFE), main.ts는 본문
  content-main.html     main.ts를 ESM 청크(chunks/content-main.js)로 묶는 HTML 엔트리
  page.content.css      디시 페이지 CSS (manifest로 따로 주입)
  upload-hook.ts        글쓰기 이미지 변환. 배경이 페이지에 넣는 unlisted script
features/<id>/          기능 모듈 하나
  meta.ts               id, 설정 스키마, 단축키, 토글 id (모든 번들이 읽는다)
  labels.ts             이름, 설명, 설정 문구
  icons.ts              lucide 아이콘
  index.ts              페이지에서 하는 일 (없는 모듈은 두지 않는다)
  background.ts         배경에서 하는 일 (선택)
  page.css              디시 페이지 CSS (선택, 자동 주입)
  overlay.tsx/.css      오버레이 호스트와 shadow 안 CSS (선택, 자동)
  ui/                   화면 컴포넌트 (선택)
modules/                WXT 로컬 모듈 (모듈 api, 설정 타입, 단축키, 기능별 페이지 CSS).
                        도우미는 lib/에 둔다 (WXT가 아래 파일을 모두 모듈로 불러옴)
core/                   모듈 시스템, 저장소 키, HTTP, 차단 판정, 파싱, 백업, DB
stores/                 여러 화면이 같이 쓰는 zustand 스토어
utils/                  라이브러리로 대신할 수 없는 도우미
components/              공용 컴포넌트(다이얼로그, 툴팁 등 — 부품 UI는 daisyUI 클래스로 인라인)
scripts/                IP DB 빌드 스크립트
```

`features/index.ts`가 `./*/index.ts`를, `features/meta.ts`가 `meta.ts`, `labels.ts`, `icons.ts`를 glob으로 모으므로 새 폴더를 등록하지 않습니다. HTTP, DOM 코드가 옵션, 팝업 번들에 딸려 가지 않도록 콘텐츠 스크립트만 `features/index.ts`를 쓰고 옵션, 팝업, `stores/modules.ts`는 `features/meta.ts`를 씁니다.

## 콘텐츠 스크립트

`entrypoints/content/index.ts`가 디시 페이지(`CONTENT_MATCHES`)에서 `document_start`에 실행됩니다. `index.ts`는 얇은 부트스트랩으로 배포 빌드에서는 `chunks/content-main.js`를 불러 `main.ts`의 `start`를 부르고(옵션, 팝업과 청크 공유) 개발 빌드는 직접 씁니다. 모듈 구현은 `features/index.ts`의 lazy glob으로 켜진 모듈만 늦게 받습니다(꺼진 모듈은 청크를 내려받지도 평가하지도 않음). 파이어폭스는 모듈별 청크 없이 `content-main.js`에 인라인되고(WXT 기본), 155 미만은 실패한 동적 import가 새로고침까지 캐시됩니다.

- WXT 문서가 안내하는 수동 구현입니다. 공식 지원(이슈 #357)이 나면 `type: "module"`로 바꿉니다. 비동기 로더라 `document_start`를 완전히는 못 지킵니다.
- 청크 이름은 `wxt.config.ts`의 `vite:build:extendConfig` 훅이 고정하고(런타임에 경로로 찾으므로 해시 불가), 청크와 `content-scripts/content.css`는 `web_accessible_resources`에 디시 페이지에만 엽니다.

`main.ts`:

1. 단축키, 팝업 메시지 준비, 컨텍스트가 무효가 되면 모듈을 멈춥니다(`stopAll`, `releaseDatabase`).
2. `BOARD_PAGE`면 차단, 메모 스토어와 모듈 on/off, 설정(`core/module/registry.ts`의 `loadAll`)을 동시에 읽고 setup을 돌립니다. 오버레이는 그릴 것이 생길 때 띄웁니다([UI](ui.md#오버레이와-css)).
3. IP DB는 유저 정보 모듈의 `setup`이 설정을 읽은 뒤 읽습니다(`initDatabase`). IP 정보 표시(`ipInfoFilter`)가 `none`이 아니거나 갱차 조회(`checkPermBan`)가 켜져 있을 때만 읽고(`needsDatabase`) 나중에 켜면 그때 읽습니다(`subscribeDatabase`). 밴 DB는 처음 조회할 때 읽습니다.

## 필터

`ctx.addFilter`(`core/filtering.ts`). `document.documentElement`에 건 `MutationObserver` 하나를 모든 필터가 같이 씁니다.

- **callback은 멱등이어야 하고 이미 있던 조상에도 불립니다.** 추가된 노드의 부모마다 `closest(scope)`로도 찾습니다.
- mutation은 묶음으로 가장 바깥 덩어리만 훑고, 모든 필터 선택자를 합친 선택자로 먼저 걸러 냅니다.
- 행마다 넣는 장식(배지 묶음 등)에는 `FILTER_SKIP_ATTR`을 답니다(안 그러면 그 삽입이 다시 필터를 깨움). callback이 던지면 콘솔에만 남고, 틀린 선택자는 `addFilter`가 던져 setup이 실패합니다.

## 배경 스크립트

배경은 뜰 때마다 리스너를 동기로 겁니다. Chrome은 서비스 워커, Firefox는 이벤트 페이지라 상태는 저장소에 둡니다. 탭↔배경 메시지는 `core/messaging/protocol.ts`의 `ProtocolMap`에 모읍니다 - 이름은 `refresher:` 접두사, 배경에서 딱 한 번만 받고(`tests/unit/entrypoints/background/messages.test.ts`), 배경을 거친 오류는 `instanceof` 대신 `utils/error.ts`의 이름으로 봅니다. 모듈은 이 문서를 불러온 주소(`documentUrl`)로 판단하고 갤러리 id, 글 번호는 `pageGallery`, `pagePostNo`를 씁니다.

- `page.ts`: 탭의 페이지(MAIN world)에서 실행합니다. 갈아끼운 목록에 디시 스크립트(`chk_user_block`, `UserMemo.renderWriterMemoBadges`)를 다시 거는 다리를 페이지마다 겁니다(`refresher:installListBridge`). 그 뒤로 콘텐츠 스크립트는 `LIST_REPLACED_EVENT` 이벤트만 보냅니다. 한 모듈만 쓸 때는 그 `background.ts`가 `runInPage`로 합니다. import가 필요한 코드는 unlisted script로 번들해 `runFileInPage`로 넣습니다(글쓰기 이미지 변환).
- `database.ts`: IP, 밴 DB를 하루마다 확인해 7일이 지났거나 형식이 옛것이면 받습니다. 알람은 배포 빌드에서만, 설치, 업데이트 때도 받습니다. "갱신"은 배경에 메시지(`refresher:updateDatabase`)를 보냅니다. 통합검색, 갤로그는 CORS가 막혀 배경이 대신 받습니다(`refresher:searchPosts`, `refresher:gallogPage`).

## 저장소

- 모든 키는 `core/storage/items.ts`에 모읍니다. `storage.defineItem`을 쓰고 래퍼는 두지 않습니다. `defineItem`은 만드는 순간 값을 읽으므로 항목은 처음 쓸 때 만듭니다(`lazyItem`).
- 읽기만 하는 곳은 키로 읽고 감시하며 없는 값은 `null`이라 받는 쪽이 기본값을 맞춥니다. 여러 키는 `storageSync(keys, apply)`, 콘텐츠 스크립트의 감시는 `watchStorage(key, cb, signal)`, 모듈 on/off와 설정은 `readModuleStorage(ids)` → `enablesOf`, `settingsOf`로 읽습니다. IP, 밴 DB(`DB_KEYS`)는 수백 KB라 `storage.getItem`, `storage.watch`로 다룹니다.
- 모듈 캐시 항목은 `moduleDataStorage(id, fallback)`로 만들고 백업에서 빠집니다. 개수 상한을 두세요(글댓비 캐시 500명).
- 백업 대상은 `core/backup.ts`의 `BACKUP_KEYS`(모듈 on/off와 설정, 차단 목록과 기본 차단 모드, 메모)입니다. 모듈 id는 `.wxt/module-ids.ts`에서 읽고(배경 번들에 `meta.ts`를 넣지 않도록), 파이어폭스에는 한도 상수가 없어 같은 값(102,400 / 8,192바이트)을 씁니다(`CLOUD_QUOTA`).
- 차단 항목의 `mode`가 비어 있으면 기기의 기본 차단 모드를 따릅니다(내보낼 때 기본 모드가 다르면 항목에 적음). 설정을 없애거나 바꿀 때 옛 값 이전 코드는 두지 않습니다(`pruneStaleSettings`가 지움).
- 복원, 합치기, 가져오기, 초기화의 쓰기 규칙은 `core/settings-transfer.ts`에 있고 직전 값을 `backupStorage.undo`에 남깁니다. `storage.local`을 직접 다룰 때는 `rawKey(MODULES_KEY)`로 키를 만듭니다.
- `stores/`의 zustand 스토어는 콘텐츠 스크립트와 옵션, 팝업이 같이 씁니다. 차단(`blocks.ts`), 메모(`memos.ts`)는 `typedListSync`로 저장소와 묶여 있고, 그리기 전에 `initBlocksStore()`, `initMemosStore()`가 끝나야 합니다(안 그러면 빈 목록이 저장소를 덮음).
- **`update(type, change)`의 `change`는 순수해야 합니다**(스토어와 저장소에 두 번 불림). 목록 쓰기는 Web Locks으로 줄을 세우는데 **같은 출처끼리만 섭니다**(디시 탭과 옵션 페이지 사이는 안 섬 - 교차 출처 쓰기는 배경을 거치게 하세요). 파이어폭스 콘텐츠 스크립트는 탭 안에서만 줄을 세웁니다([Firefox](firefox.md)).

## HTTP

`core/http/client.ts`의 `http`(일반)와 `ajax`(디시 ajax)를 씁니다. Firefox 콘텐츠 스크립트에서는 `content.fetch`로 보냅니다.

- 시간 제한, 전체 제한은 기본으로 없습니다(`timeout: false`, `totalTimeout: false`). 필요한 호출만 줍니다(글 목록 `LIST_TIMEOUT` 30초). `AbortSignal.timeout`은 파이어폭스 샌드박스에서 던집니다([Firefox](firefox.md)). 재시도는 하지 않습니다(`retry: 0`).
- 갤러리 종류는 `core/http/urls.ts`의 `galleryKind(url)`로 다루고 경로와 `_GALLTYPE_` 표는 그 파일에만 둡니다.
- 폼 본문은 `formBody({...})`(`null`, `undefined`, `false`는 빠짐). CSRF는 `csrfBody({...})`(`core/http/cookie.ts`). 끊은 요청은 `isAbortError(e)`(`utils/error.ts`)로 봅니다.
