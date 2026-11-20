import {hookUploads} from "./images";

/** 글쓰기 모듈의 이미지 변환을 페이지(MAIN world)에 거는 스크립트. 배경이 scripting.executeScript의 files로 넣는다 (background.ts). modules/page-scripts.ts가 엔트리포인트로 등록한다. */
export default defineUnlistedScript(hookUploads);
