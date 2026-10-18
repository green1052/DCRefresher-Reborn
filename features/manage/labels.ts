import type {LabelsOf} from "@/core/module/types";

import type meta from "./meta";

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "관리",
    description: "무급 노예들을 위한 여러 편의 기능입니다.",
    settings: {
        checkAllTargetUser: {name: "선택한 유저 전부 체크", desc: "Shift 키를 누른 상태로 체크박스를 눌러 대상 유저 전부를 체크합니다. (아이디, IP, 닉네임 순서)"},
        checkViaShift: {name: "Shift 다중 체크", desc: "Shift 키를 누른 상태로 드래그해 여러 항목을 체크합니다."},
        checkCommentViaCtrl: {name: "Ctrl 대댓글 체크", desc: "Ctrl 키를 누른 상태로 댓글의 체크박스를 누르면 그 댓글의 대댓글도 함께 체크합니다."},
        deleteViaCtrl: {name: "Ctrl로 삭제", desc: "Ctrl 키를 누른 상태로 게시글을 클릭해 삭제합니다."},
        enableGifControl: {name: "GIF 조작", desc: "GIF를 제어하는 기능을 켭니다."},
        imageOrigin: {name: "이미지 출처 표시", desc: "다른 갤러리에서 올린 본문 이미지나, 다른 갤러리에서 받은 첨부 파일이 있으면 글 제목 위에 알립니다."},
        titleSearch: {name: "같은 제목 찾기", desc: "게시글 보기에 버튼을 두어 제목이 같은 글을 디시 통합검색에서 찾습니다."}
    }
} satisfies LabelsOf<typeof meta>;
