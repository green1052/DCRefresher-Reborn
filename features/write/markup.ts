/** 나가기 방지가 찾는 글쓰기 페이지 마크업. 못 찾으면 조용히 빗나가니 e2e/live가 확인한다. */

export const SUBMIT = "button.write";
export const EDITOR = ".note-editable";
export const SUBJECT = "input#subject";
// 디시가 에디터에 넣는 자동 짤방, 작성 가이드 (contenteditable=false라 사용자 글이 안에 들어가지 않는다).
export const AUTO = "#auto_zzal_img_div, .wrt_guide_preview_inn";
// 디시 '글 작성을 취소하시겠습니까?' 레이어의 확인 버튼.
export const LEAVE = "#leave_confirm_box .btn_blue";
// 디시가 등록에 성공해야 Y로 바꾸는 표시.
export const POSTED = "#clickbutton";
