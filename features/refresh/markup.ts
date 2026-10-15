/**
 * 받아온 목록 응답을 문자열로 다룰 때 찾는 디시 마크업. 디시가 바꾸면 비교·부분 파싱·수 칸 갱신이 조용히 빗나가므로 e2e/live가 실제 응답에 그대로 있는지 본다.
 * e2e(Node)도 불러오므로 다른 모듈을 불러오지 않는다.
 */

/** 목록 표의 여는 태그 앞부분. 응답에서 이 뒤의 첫 tbody를 목록으로 자른다. */
export const LIST_TABLE = "<table class=\"gall_list";

/** 조회수·추천수·댓글 수 칸. 폴링마다 위쪽 행 여럿에서 바뀐다. */
export const COUNT_CELLS = ".gall_count, .gall_recommend, .reply_num";

/** 행의 원래 HTML에서 수 칸(COUNT_CELLS)의 여는 태그와 그 뒤 글자. 글자를 비워 수만 바뀐 행을 가린다. */
export const COUNT_TEXT = /(class="(?:gall_count|gall_recommend|reply_num)"[^>]*>)[^<]*/g;
