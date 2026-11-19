# 기능별 구조

## 미리보기

`features/preview`가 모듈과 UI, `core/preview`가 디시 요청, 파싱, 캐시(1분, quick-lru 25개)입니다. 댓글은 쪽마다 요청이라 매번 받으면 디시가 IP를 잠시 막습니다(#273).

1. 캐시에 없고 목록 행에 댓글 수가 보이면(10초 안에 받은 댓글이 없을 때) 본문과 함께 댓글 목록도 요청합니다. 댓글 토큰(`e_s_n_o`)은 목록 페이지 값을 쓰고 본문의 토큰, 댓글 번호와 맞을 때만 씁니다. PageUp/PageDown, 스크롤 끝 휠로 넘어갈 때는 미리 받지 않습니다. 10초 안에 받은 목록은 다시 받지 않습니다(`COMMENTS_REUSE`) - 단 새로고침 버튼, 자동 새로고침, 캐시 비활성화는 늘 받습니다.
2. 댓글은 한 쪽에 100개씩 최대 10쪽을 등록순으로 합칩니다(디시 API는 1쪽에 최신 댓글을 줌). 최신순은 스레드 첫 댓글만 거꾸로 세우고 답글순은 답글 많은 스레드부터입니다(`CommentList.tsx`의 `threadParents`).
3. 댓글을 그리는 `pullComments`는 순번으로 늦은 옛 목록이 새 목록을 덮지 않게 합니다(새 경로도 이 안에서 기다리게 함). 댓글만 실패하면 댓글 칸에 '다시 시도'(`commentsFailed`)를 보입니다.

'주소창에 게시글 주소 표시'(`colorPreviewLink`)가 켜져 있으면 글 주소를 기록에 쌓고, 닫을 때 목록 주소를 새 항목으로 쌓아 돌아갑니다(미리보기 항목이 뒤 갈래에 남아 뒤로 가기로 다시 열립니다. 기록이 50개까지라 40칸 넘으면 바꿈). 쌓은 주소는 방문한 것으로 쳐 목록 링크가 `:visited` 색이 되고, 미리보기로 읽은 글 표시도 이것으로 씁니다.

디시 JS의 값(reCAPTCHA 사이트 키, `_d()` 해독표)은 `core/preview/dcinside-js.ts`에 모읍니다. E2E(Node)도 불러오므로 다른 모듈을 불러오지 않습니다([테스트](testing.md#e2e-playwright)).

### 본문 HTML 정화

본문 HTML은 `utils/sanitize.ts`에서 DOMPurify로 정화합니다(`<video>`가 든 DOMParser 문서는 Chrome에서 해제되지 않으므로 `<template>`에서 `IN_PLACE`). `<embed>` 유튜브는 `iframe`으로 바꾸고, 차단 단어 검사는 `htmlToText`로 뽑은 글에 합니다. 여기는 **신뢰 경계**입니다(남이 쓴 HTML이 확장 UI와 같은 shadow 루트에 들어감). 막는 이유는 넷입니다.

- **확장 UI 흉내**: `<style>`, 폼 요소, `popover`, `command` 속성.
- **확장 표시 덮어쓰기**: `data-slot`(`isTyping`), `data-blocked`, `data-*-revealed`, `data-blur-reveal`(`core/block.ts`의 `isBlockedHidden`).
- **미디어 숨기기 회피**: SVG `<feImage>`, `<image>`, `background`. `sanitizeHtml(html, {stripMedia: true})`는 `img`, `video`, `iframe`도 막습니다(`NO_MEDIA`).
- **창 밖 침범**: inline `style`은 `KEPT_STYLE` 허용 목록만 남기고 음수 margin은 버립니다.

## 글 목록 새로고침

- 주소를 바꾸지 않은 로드는 새 글이 한 자리에 끼어든 것뿐이면 바뀐 행만 고칩니다(`list.ts`의 `insertionOf`). 검색 결과, 작성자 거르기 목록은 늘 통째로 바꿉니다. 삭제된 글 보존(`archiveArticle`)은 남긴 행의 복제본을 끼워 비교합니다.
- 자동 새로고침은 목록 표만 파싱하고 tbody가 지난번과 같으면 파싱도 하지 않습니다. 사용자 로드, 검색 결과는 문서 전체를 파싱해 페이징도 맞춥니다. 읽은 자리 선(`refresherReadMark`)은 행 class라 갈아끼우면 사라지고 바뀐 행이 있는 로드 뒤 `showMark`가 다시 긋습니다.
- 목록 요청 하나에 30초 제한(`LIST_TIMEOUT`)([HTTP](architecture.md#http)). 실패하면 주기를 최대 60초까지 두 배씩 늘리고 성공하면 돌아갑니다. 새 글 없는 자동 새로고침이 이어지면 0.5배씩 최대 4배까지 늘리고 새 글, 강제 로드, 탭 복귀, 마우스, 키 입력이 되돌립니다(둘 중 긴 것). 간격에 0.5~2초가 무작위로 더해집니다.

## 검색

`features/search`는 목록, 본문 페이지에서 돕고 이어 붙이기는 목록에서만 합니다.

- 결과가 한 쪽(`#list_num`, 기본 50개)에 못 미치면 다음 구간(`a.search_next`)을 받아 이어 붙이고 페이징을 마지막 구간 것으로 바꿉니다. 받은 쪽은 "다음 검색 횟수"만큼 캐시하고, 작성자 거르기 목록은 갈아끼워도 1쪽이 그대로면 1분(`REUSE_TTL`) 동안 옮겨 옵니다.
- 글쓴이 검색(`search_name`)은 닉네임만 찾습니다. 아이디, IP는 주소에 `rf_uid`, `rf_ip`를 얹고 그 작성자가 아닌 행을 숨깁니다(`writer.ts`, 주소는 `writerFilter`가 읽고 페이징 링크마다 다시 얹음). 아이디는 배경이 갤로그를 받아(`refresher:gallogPage`) 닉네임을 읽어 그 결과를 거르고, IP는 목록을 다음 쪽으로 넘기며 거릅니다(유동 IP는 앞 두 자리만 보여 `123.45` 꼴).
- 검색창 종류에 아이디, IP를 더하고 그것을 고르면 capture로 디시 처리기보다 먼저 받아 막습니다. 버블의 검색 버튼은 모듈 api `searchUserPosts`를 부릅니다. 거른 목록의 1쪽은 이어 붙인 것이라 새로 받은 1쪽에 없어도 지워진 글이 아닙니다 - `isWholeFirstPage`는 거르기 중 거짓을 돌려 삭제된 글 보존을 끕니다.
