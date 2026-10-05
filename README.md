<div align="center">
    <img src="./assets/icon.png" width="160" alt="DCRefresher Reborn 아이콘">
    <h1>DCRefresher Reborn</h1>
    <p>디시인사이드 개선 확장 프로그램</p>
    <p>
        <a href="https://github.com/green1052/DCRefresher-Reborn/releases/latest"><img src="https://img.shields.io/github/v/release/green1052/DCRefresher-Reborn" alt="최신 버전"></a>
        <a href="https://chromewebstore.google.com/detail/pmfifcbendahnkeojgpfppklgioemgon"><img src="https://img.shields.io/chrome-web-store/users/pmfifcbendahnkeojgpfppklgioemgon?logo=googlechrome&amp;logoColor=white&amp;label=Chrome" alt="Chrome 웹 스토어 사용자 수"></a>
        <a href="https://addons.mozilla.org/ko/firefox/addon/dcrefresher-reborn"><img src="https://img.shields.io/amo/users/dcrefresher-reborn?logo=firefox&amp;logoColor=white&amp;label=Firefox" alt="Firefox Add-ons 사용자 수"></a>
    </p>
    <p>
        <a href="https://chromewebstore.google.com/detail/pmfifcbendahnkeojgpfppklgioemgon"><b>Chrome에 설치</b></a>
        ·
        <a href="https://addons.mozilla.org/ko/firefox/addon/dcrefresher-reborn"><b>Firefox에 설치</b></a>
        ·
        <a href="https://github.com/green1052/DCRefresher-Reborn/wiki">위키</a>
        ·
        <a href="https://github.com/green1052/DCRefresher-Reborn/issues">버그 제보</a>
    </p>
    <a href="https://www.buymeacoffee.com/green1052"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="150" height="42" alt="Buy Me a Coffee로 후원하기"></a>
</div>

글을 열지 않고 목록에서 미리 보고, 목록을 자동으로 새로고침하고, 보고 싶지 않은 유저와 글을 가립니다. 작성자 옆에는 IP 정보(통신사·국가·VPN)와 메모를 보여 줍니다.

<p align="center">
    <img src="docs/images/preview.webp" width="49%" alt="글 목록에서 우클릭으로 연 미리보기 창">
    <img src="docs/images/mini-preview.webp" width="49%" alt="제목에 마우스를 올리면 뜨는 미니 미리보기">
</p>

## 설치

| 브라우저 | 설치 | 최소 버전 |
|---|---|---|
| Chrome (Edge, Whale 등 크로뮴 계열 포함) | [Chrome 웹 스토어](https://chromewebstore.google.com/detail/pmfifcbendahnkeojgpfppklgioemgon) | 153 |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/ko/firefox/addon/dcrefresher-reborn) | 155 |

설치한 뒤 툴바의 확장 아이콘을 누르면 팝업이 열립니다. 팝업에서 모듈을 켜고 끄고, 톱니바퀴 버튼으로 옵션 페이지(설정·차단·메모·단축키·데이터·정보)를 엽니다.

## 사용법

### 미리보기

- 글 목록에서 제목을 **우클릭**하면 미리보기 창이 열립니다. 좌클릭은 원래대로 글로 이동합니다. 설정의 `미리보기 키 반전`을 켜면 반대가 됩니다.
- 목록의 **댓글 수**를 우클릭하면 댓글만 보기로 열립니다. 좌클릭은 원래대로 댓글 위치로 이동하고, `미리보기 키 반전`을 켜면 반대가 됩니다.
- 원래 우클릭 메뉴가 필요하면 **Shift+우클릭**을 하거나, Windows에서는 오른쪽 버튼을 길게 눌렀다 뗍니다.
- 창 안에서 **PageUp** / **PageDown**으로 목록의 앞·뒤 글로 넘어갑니다. 창 맨 아래(맨 위)에서 휠을 한 번 더 굴려도 넘어갑니다.
- **Esc**나 창 바깥 클릭으로 닫습니다. `주소창에 게시글 주소 표시`(기본 켜짐)가 켜져 있으면 브라우저 뒤로 가기로도 닫히고, 닫은 미리보기를 앞으로 가기로 다시 열 수 있습니다.
- 제목에 마우스를 올리면 뜨는 **미니 미리보기**는 설정에서 켭니다(기본 꺼짐).
- 미리보기 창에서 본문·댓글의 **디시콘**을 누르면 그 디시콘 패키지 정보가 뜨고, 아직 없는 패키지는 바로 추가할 수 있습니다.
- 본문 **이미지**를 누르면 창 안에서 크게 봅니다. **←** / **→**로 넘기고 Esc로 닫습니다.
- 댓글을 새로고침하면 새로 들어온 댓글을 잠깐 강조합니다. 미리보기로 연 글은 목록에서 흐리게 표시합니다.
- 목록에서 **J** / **K**로 글을 고르고 **Enter**로 미리보기, **O**로 글을 엽니다. **Esc**로 선택을 풉니다.

### 글 목록 새로고침

- 이 탭을 보고 있지 않을 때 들어온 새 글 수를 탭 제목 앞에 `(3)`처럼 붙입니다.
- 기본으로 다른 탭을 보는 동안은 새로고침을 쉽니다. `숨은 탭에서도 새로고침`을 켜면 느린 주기(기본 30초)로 계속 받습니다.

### 단축키

| 기능 | 기본 키 |
|---|---|
| 글 목록 새로고침 | `Alt+R` |
| 자동 새로고침 일시정지 | `Alt+S` |
| 스텔스 모드: 이미지 잠시 보이기 | `Alt+P` |
| 이 페이지에서 가린 내용 보기 | 없음 |

키는 브라우저의 확장 프로그램 단축키 설정에서 바꿉니다. 옵션 페이지의 **단축키** 탭에서 지금 키를 확인하고, **단축키 설정** 버튼으로 그 화면을 열 수 있습니다. 갤러리 관리 권한이 있으면 미리보기 창에서 `D`를 두 번 눌러 글을 삭제하고, `B`를 두 번 눌러 작성자를 차단할 수 있습니다(설정에서 키 변경).

## 주요 기능

기능은 모듈 단위로 나뉘어 있고 따로 켜고 끌 수 있습니다. 모듈마다 자세한 설명은 [위키](https://github.com/green1052/DCRefresher-Reborn/wiki)에 있습니다.

| 모듈 | 하는 일 |
|---|---|
| [미리보기](https://github.com/green1052/DCRefresher-Reborn/wiki/preview) | 목록에서 글과 댓글을 창으로 보고, 댓글 쓰기·추천·앞뒤 글 넘기기를 합니다 |
| [글 목록 새로고침](https://github.com/green1052/DCRefresher-Reborn/wiki/refresh) | 목록을 자동으로 새로고침하고 새 글을 표시합니다 |
| [콘텐츠 차단](https://github.com/green1052/DCRefresher-Reborn/wiki/block) | 닉네임, 아이디, IP, 제목, 내용, 댓글, 디시콘 등으로 글과 댓글을 숨기거나 흐리게 합니다 |
| [유저 정보](https://github.com/green1052/DCRefresher-Reborn/wiki/userinfo) | 작성자 옆에 아이디, IP 정보(통신사·국가·VPN), 메모, 글댓비·깡계·갱차 배지를 표시합니다 |
| [레이아웃 수정](https://github.com/green1052/DCRefresher-Reborn/wiki/layout) | 좁은 화면용 컴팩트 모드와 페이지 요소 숨기기를 제공합니다 |
| [폰트 교체](https://github.com/green1052/DCRefresher-Reborn/wiki/fonts) | 페이지와 미리보기의 폰트와 본문 글자 크기를 바꿉니다 |
| [이미지 검색](https://github.com/green1052/DCRefresher-Reborn/wiki/imagesearch) | 디시 이미지를 우클릭해 검색 엔진(SauceNao, Google Lens 등)에서 찾습니다 |
| [요청 제한](https://github.com/green1052/DCRefresher-Reborn/wiki/requests) | 디시인사이드로 한꺼번에 보내는 요청 수를 제한해 차단을 막습니다 |
| [스텔스 모드](https://github.com/green1052/DCRefresher-Reborn/wiki/stealth) | 페이지의 이미지와 동영상을 가립니다 (기본 꺼짐) |
| [검색 이어 보기](https://github.com/green1052/DCRefresher-Reborn/wiki/search) | 검색 결과가 한 페이지에 못 미치면 다음 결과를 이어 붙입니다 (기본 꺼짐) |
| [글쓰기](https://github.com/green1052/DCRefresher-Reborn/wiki/write) | 작성 중인 글을 두고 실수로 나가지 않게 확인하고, 올리는 이미지를 WebP로 바꾸거나 파일 이름을 숨깁니다 (기본 꺼짐) |
| [관리](https://github.com/green1052/DCRefresher-Reborn/wiki/manage) | 갤러리 관리자를 위한 편의 기능입니다 (기본 꺼짐) |

그 밖에 [메모](https://github.com/green1052/DCRefresher-Reborn/wiki/memo), [단축키](https://github.com/green1052/DCRefresher-Reborn/wiki/shortcuts), [데이터 관리](https://github.com/green1052/DCRefresher-Reborn/wiki/data)(클라우드 백업·내보내기·가져오기·초기화)가 있습니다.

## 문제 해결

| 증상 | 해결 |
|---|---|
| `요청이 많아 디시인사이드가 잠시 접속을 막았습니다.` 안내가 뜨고 페이지가 비어 있음 | 디시인사이드가 요청이 많은 IP를 잠시 막은 것입니다. 잠시 기다린 뒤 새로고침하세요. [요청 제한](https://github.com/green1052/DCRefresher-Reborn/wiki/requests)의 동시 요청 수를 낮추면 덜 막힙니다 |
| `확장 프로그램이 업데이트되었거나 꺼져서 이 페이지에서는 멈췄습니다.` | 확장이 업데이트되었거나 꺼지기 전에 열어 둔 탭입니다. 확장이 켜져 있는지 확인한 뒤 새로고침하세요. 글쓰기 중이면 먼저 글을 등록하세요 |
| IP 정보 배지가 보이지 않음 | 옵션 → **데이터** → IP/밴 데이터베이스의 **지금 갱신**을 누르세요. 평소에는 설치·업데이트 때와 7일마다 자동으로 받습니다 |
| `저장하지 못했습니다.` | 업데이트 뒤 남은 옛 탭에서 주로 납니다. 페이지를 새로고침한 뒤 다시 해 보세요. 팝업에서 났다면 팝업을 닫았다가 다시 여세요 |
| 미리보기에 `성인 인증이 필요한 글입니다.` / `비밀글입니다.` | 원문에서만 풀 수 있습니다. **원문 열기**로 인증하거나 비밀번호를 넣은 뒤 **다시 시도**하세요 |

그래도 안 되면 [이슈](https://github.com/green1052/DCRefresher-Reborn/issues)로 알려 주세요. 옵션 → **정보** → **진단 정보 복사**로 버전, 브라우저, 켜진 모듈을 붙이면 원인을 찾기 쉽습니다.

## 권한과 개인정보

개발자 서버는 없고, 분석·추적 코드도 없습니다. 사용자 데이터를 밖으로 보내지 않습니다. 직접 켠 클라우드 백업만 브라우저 계정 동기화로 올라가고, Firefox에는 수집하는 데이터가 없다고 선언되어 있습니다.

- **연결하는 곳**
  - 디시인사이드: 글·목록·댓글과 디시콘 목록·패키지 정보, (글댓비를 켜면) 작성자의 갤로그 글·댓글 수, (같은 제목 찾기를 누르면) 통합검색 결과를 불러오고, 사용자가 누른 댓글 쓰기·추천·관리·디시콘 추가 요청을 보냅니다.
  - `dcrefresher.green1052.com`: IP/밴 데이터베이스 파일을 받기만 합니다. 이 저장소의 `data` 브랜치를 Cloudflare Pages로 그대로 배포한 곳입니다.
  - 이미지 검색 엔진: 이미지 우클릭 메뉴를 누를 때만, 그 이미지 주소로 검색 탭을 엽니다.
  - Google reCAPTCHA: 디시가 요구할 때만 디시와 같은 방식으로 씁니다.
  - 글에 들어 있는 외부 이미지·동영상(유튜브 등): 미리보기로 글을 열면 원문을 볼 때처럼 그 주소에서 불러옵니다.
- **저장하는 곳**
  - 설정, 차단·메모 목록, IP DB, 글댓비 같은 캐시는 브라우저 안(`storage.local`)에만 저장합니다.
  - 데이터 탭에서 클라우드 백업(수동 백업이나 자동 백업)을 쓰면 설정·차단·메모 목록을 압축해 브라우저 계정 동기화(`storage.sync`)에 올립니다.
  - 비회원 닉네임·비밀번호는 디시가 쓰는 브라우저 저장소를 그대로 같이 씁니다.
- **권한**

  | 권한 | 쓰는 곳 |
  |---|---|
  | `*.dcinside.com` | 디시 페이지에서 동작하고 디시에 요청을 보냅니다 |
  | `storage`, `unlimitedStorage` | 설정과 목록, IP·밴 DB(합쳐 1MB 남짓)를 저장합니다 |
  | `alarms` | IP DB 갱신 확인과 자동 백업을 예약합니다 |
  | `contextMenus` | 이미지 검색 우클릭 메뉴를 만듭니다 |
  | `scripting` | 디시 페이지의 reCAPTCHA 토큰을 받고, 새로고침하거나 검색 결과로 이어 붙인 목록에 디시 자체 차단·메모 표시를 다시 입힙니다 |

## 바로가기

- [위키](https://github.com/green1052/DCRefresher-Reborn/wiki)
- [버그 제보 / 기능 제안](https://github.com/green1052/DCRefresher-Reborn/issues)
- [디스코드 서버](https://discord.gg/SSW6Zuyjz6)
- [리프레셔 미니 갤러리](https://gall.dcinside.com/mini/board/lists/?id=bjwg64)

## 개발

[Bun](https://bun.sh) 1.4 이상이 필요합니다.

```sh
bun install
bun run dev               # Chrome 개발 모드
bun run dev:firefox       # Firefox 개발 모드
bun run compile           # 타입 검사
bun run test              # 단위 테스트 (Vitest)
bun run build             # Chrome 빌드 (.output/chrome-mv3)
bun run e2e               # Chrome E2E (Playwright). 먼저 build, 처음 한 번 bunx playwright install chromium
bun run build:firefox     # Firefox 빌드 (.output/firefox-mv2)
bun run e2e:firefox       # Firefox E2E. 먼저 build:firefox, 처음 한 번 bunx playwright install firefox
bun run e2e:live          # 실제 디시에 읽기 요청을 보내는 E2E (쓰기는 막는다). DC_LIST_URL로 갤러리를 바꾼다 (기본 미니 갤러리 bjwg64)
bun run zip               # Chrome 배포용 zip
bun run zip:firefox       # Firefox 배포용 zip (소스 zip도 함께 생성)
```

결과물은 `.output` 폴더에 생성됩니다. 구조, 기능 추가 방법, 테스트와 릴리즈 절차는 [개발 문서](docs/DEVELOPMENT.md)를 참고하세요.

### 기여

- 버그 제보와 기능 제안은 [이슈 템플릿](https://github.com/green1052/DCRefresher-Reborn/issues/new/choose)으로 올려 주세요.
- 풀 리퀘스트는 `develop` 브랜치로 보내 주세요. 커밋 전에 `bun run compile`, `bun run test`, `bun run build`가 통과해야 하고, 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/ko/)를 따릅니다.
- Chrome과 Firefox에서 모두 확인해 주세요.
