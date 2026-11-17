/** 받아온 목록 응답에서 찾는 디시 마크업. 바뀌면 조용히 빗나가니 e2e/live가 확인한다. */

/** 목록 표의 여는 태그 앞부분. 응답에서 이 뒤의 첫 tbody를 목록으로 자른다. */
export const LIST_TABLE = "<table class=\"gall_list";

/** 공지 행의 아이콘. 공지는 새 글, 맨 위 글로 세지 않는다. */
export const NOTICE_ICON = "em[class*=icon_notice]";

/** 조회수, 추천수, 댓글 수 칸. 폴링마다 위쪽 행 여럿에서 바뀐다. */
export const COUNT_CELLS = ".gall_count, .gall_recommend, .reply_num";

/** 행의 원래 HTML에서 수 칸(COUNT_CELLS)의 여는 태그와 그 뒤 글자. 글자를 비워 수만 바뀐 행을 가린다. */
export const COUNT_TEXT = /(class="(?:gall_count|gall_recommend|reply_num)"[^>]*>)[^<]*/g;
