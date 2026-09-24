# DCRefresher Reborn v6 — 재작성 플랜

v5(release 브랜치, Vue) 기능 1:1 이식, React 재작성. 마이그레이션 없음(새 키).

## 확정 결정사항

| 항목 | 결정 |
|---|---|
| 스택 | React 19 (React Compiler: `react.vite.compiler: true` / oxc-transform-react) + WXT 0.21 + TypeScript, Zustand(상태), ky(HTTP), @webext-core/proxy-service(background RPC) + @webext-core/messaging(탭 단건) |
| Radix | `radix-ui` 통합 패키지. Select만 네이티브 `<select>` |
| 데이터 | 전부 `storage.local`. 프리픽스 `local:dcr:*`. 마이그레이션 없음 |
| 클라우드 백업 | `storage.sync` 매체 (local→sync, DB 제외 / 복원시 DB 보존) — release와 동일 방식 |
| 모듈 간 통신 | `modules.use(id)` (setup 리턴값=공개API) + 타입 eventBus. 직접 import 금지(지연 바인딩) |
| 유저 버블 | 있음(닉네임/ID/IP 클릭 → 액션). 메모/차단 등록 진입점 = 버블 + 컨텍스트 메뉴 + popup 탭 |
| 유저 배지 | userinfo 모듈이 MEMO/IP/UID 배지 1컨테이너 삽입, **순서 사용자 지정**(설정 타입 `order`) |
| HTTP | `export const http = ky.create({fetch: () => (globalThis.fetch ?? window.fetch).bind(globalThis)})` — Firefox CSP. 필요시 `.extend()` |
| 콘텐츠 UI | 상호작용 UI만 React(오버레이 1루트: 미리보기/팝업들/토스트/메모/캡챠). 배지·텍스트치환·필터링은 TS |

## 저장 구조 (전부 local)

```
local:dcr:block:{NICK|ID|IP|TITLE|TEXT|COMMENT|DCCON|TAB}  BlockEntry[]
local:dcr:block:defaults                                    Record<BlockType, DetectMode>
local:dcr:memo:{UID|NICK|IP}                                Record<user, MemoEntry>
local:dcr:modules                                           Record<id, boolean>  (없으면 defaultEnable)
local:dcr:module:{id}:settings                              Record<key, SettingValue>
local:dcr:module:{id}:data                                  Record<string, JsonValue>
local:dcr:db                                                StoredDB {version,lastUpdate,ip,ban}
local:dcr:backup:lastUpdate                                 number
```

```ts
type BlockType = "NICK"|"ID"|"IP"|"TITLE"|"TEXT"|"COMMENT"|"DCCON"|"TAB";
type DetectMode = "SAME"|"CONTAIN"|"NOT_SAME"|"NOT_CONTAIN";
type MemoType = "UID"|"NICK"|"IP";
interface BlockEntry { id: string; content: string; isRegex: boolean; mode: DetectMode; gallery?: string; extra?: string }
interface MemoEntry { text: string; color: string; gallery?: string }
interface StoredDB { version: string; lastUpdate: number; ip: Record<string,string>; ban: Record<string,string[]> }
type SettingValue = boolean | number | string | string[];
```

접근 규칙: defineItem 선언은 `core/storage/items.ts` 1파일 / 읽기=시작1회+watch→메모리캐시 / 쓰기=setValue 단방향(모듈 data만 Proxy→즉시저장 예외) / watch 중복은 동일값 skip / 백업=`dcr:` 프리픽스 덤프.

## 설정 스키마 (5종)

```ts
type SettingSchema =
  | { type:"check";  name; desc; default:boolean }
  | { type:"text";   name; desc; default:string; placeholder? }
  | { type:"range";  name; desc; default:number; min; max; step; unit }
  | { type:"option"; name; desc; default:string; items:Record<string,string> }
  | { type:"order";  name; desc; default:string[]; items:Record<string,string> }  // 유저배지 순서 등
```
order 정규화: default에만 있는 key→맨뒤 추가, items에 없는 key→제거. ModuleTab 컨트롤 = 위/아래 이동 버튼(드래그 라이브러리 없이).

## 모듈 인터페이스

```ts
interface ModuleDefinition {
  id: string;              // 아스키 (storage 키)
  name: string;            // 표시명(한글)
  description: string;
  urls?: RegExp[];
  defaultEnable?: boolean;
  settings?: Record<string, SettingSchema>;
  setup(ctx: ModuleCtx): unknown | void;   // 리턴값 = 공개 API (modules.use(id)로 노출)
  revoke?(): void;
  onChanged?(key: string, value: SettingValue): void;  // 활성 중 설정변경
}
interface ModuleCtx {
  addFilter(scope, cb, opts?): () => void;  // core/filtering 위임, 해제함수
  settings: Readonly<Record<string, SettingValue>>;  // live
  data: Record<string, JsonValue>;          // Proxy, set/delete시 즉시 저장
  bus: typeof eventBus;
}
```
- 등록: `features/index.ts`에 명시 나열(단순). URL 미매치/비활성도 스키마+토글 제공(비활성=setup 안함).
- storage.watch(`dcr:modules`, `dcr:module:*:settings`) → enable/설정 반영 → onChanged/setup/revoke.

## 디렉터리 (WXT 평면, srcDir 없음)

```
entrypoints/{background,content,popup,options}/  + grecaptcha.content.ts
components/   # 공용 React (SettingItem, BlockDialog, Toast, UserBubble, MemoDialog...)
features/     # 콘텐츠 모듈: block refresh preview stealth userinfo manage write layout imagesearch fonts
core/         # http messaging(storage/services) module filtering eventbus + storage(items/types)
stores/       # zustand (blocks memos modules ui)
assets/       # scss, dccon.webp 등
utils/        # 순수 헬퍼
public/       # icon*.png, 웹리소스
```

## 마일스톤

- [x] **M1 골격**: 의존성, wxt.config(manifest 이식), core(storage/http/eventbus/filtering/module/messaging/proxy), background(메뉴/단축키/DB), content 부트스트랩, popup 6탭 골격(Radix Tabs), options wrapper, 빌드 — *주의: Firefox 빌드 기본 = **MV2** (`.output/firefox-mv2`), chrome = `.output/chrome-mv3`. proxy-service는 DatabaseService로 e2e 검증(DataTab "지금 갱신"). BroadcastService는 불필요—신규시 추가. 커밋 규칙: 영어 메시지(feat:/deps:/chore:), PLAN.md는 미추적(.gitignore). 브랜치명 `rereborn`(오타, 유지). release 참조용 worktree: `.release-tree`*
- [x] **M2 데이터 기능**: block/memo 코어+모듈, popup Block/Memo탭 + 차단 Dialog(공용), refresh 모듈+단축키, 오버레이 루트(토스트/메모Dialog/버블), ModuleTab 설정 컨트롤 렌더(SettingControl 5종) — *커밋 daf05f8c. 비고:BlockDialog는 popup 전용(content는 버블→즉시 등록), DCCON 수정도 허용(v5는 alert), popup 내보내기/가져오기=M5, 필요시 MANUAL 문서: 우클릭=버블(네이티브 메뉴 대체, .ub-writer/.written_dccon), 확장 컨텍스트 메뉴=10초 내 마지막 선택 대상.*
- [x] **M3 단순 모듈**: stealth, userinfo(IP/밴 DB+배지순서), fonts, layout, imagesearch, write, manage, 컨텍스트 메뉴 연결 — *커밋 68f37a39. 비고:ban DB = `Record<이유, uid[]>`(역색인, (b9));userinfo 배지=단일 컨테이너(.dcr-user-badges, insertWriterSpan after-icon)+메모변경시 전체 재계산(v5는 선택대상만), badgeOrder 기본 [UID,IP,MEMO], 유동닉 UID 항상 표시(v5동일);stealth=CSS(stealth.scss)+플로팅버튼, contentPreview 재마운트 생략(React 오버레이가 영속이라 불필요);layout/stealth 스타일=release 변수·scss 그대로 복사(variables/stealth/layout.scss — $refresher-변수+--refresher-*다크변수 포함);layout activePixel max=screen.width(모듈로드시평가, v5동일);imagesearch=컨텍스트메뉴 경로 유지(viewimage.php→image.dcinside.com/dccon.php 치환→saucenao), contentPreview필요엔eventBus imageSearch;write=중복삽입방지없음(1:1), 마커+리스너정리;manage=GIF onmousedown제거+controls, 체크박스 3기능(CSS.escape필수), Ctrl삭제(delete_list, #gallery_id), 글댓비(1h캐시+첫10+gallog_content_reple "글,댓"), 갱차(역색인, #e8645f), data.ratio=1회대입.*
- [x] **M4 미리보기**: 파서/컨트롤러(TS) → React 오버레이 → 댓글/디시콘/캡챠/어드민/블록팝업, 미니 미리보기 — *비고: dccon 피커·grecaptcha 토큰=M5, 트랙패드 스크롤 필터 단순화(엣지 2회 휠+PageUp/Down), 미니 미리보기 캐시 전용(미조회 글은 미표시), 쿠키=Cookie Store API 직접 호출(document.cookie 폴백 없음), 캐시=lru-cache 패키지, popup=openOptionsPage 리다이렉트(options가 App optionsPage 재사용, General/Shortcut 탭·DataTab 백업=M5), 프로젝트 전체 접두사 dcr→refresher(스토리지 키/메시지 타입/클래스/CSS변수 포함, 프리릴리즈라 마이그레이션 없음). 후속 fix: 리네임 누락 camelCase dataset(dcrRefresh/dcrPaged/dcrUserInfo)→refresherUserInfo 통일 — refresh의 `[data-refresher-refresh]` 가드 미매치→버튼 무한 재생성→디시 페이지 프리즈 해결, userinfo rebuildAll 셀렉터(`[data-refresher-user-info]`)도 같이 정합*
- [ ] **M5 마무리**: 리소스(dccon.webp), 양쪽 빌드+수동 테스트 — *완료: General/Shortcut/Data탭(백업·복원·클라우드), grecaptcha.content(world MAIN), dccon 피커(DcconPopup radix), WriteComment 디시콘 활성화, popup→options dir 정리, options/dark(prefers-color-scheme)*

각 마일스톤: `bunx wxt prepare` → `bun run compile` → `bun run build`(+firefox) 통과 후 PLAN.md 갱신 → 커밋.

## 참고

- release 참조: `git show release:src/...` (유저 정보=release:src/entrypoints/content/modules/userinfo.ts, 클라우드 백업=release:src/entrypoints/popup/composables/useData.ts)
- messaging 분리: 탭 단건(popup→활성탭, bg→탭) = @webext-core/messaging `sendMessage(type, data, tabId)` / background 서비스(broadcast 릴레이, DB 강제갱신) = proxy-service
- 프록시 서비스는 background에서만 구현 가능 → popup→탭은 반드시 messaging
