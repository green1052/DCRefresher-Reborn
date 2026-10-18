import {ShieldCheck} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";
import type {ModuleIcons} from "@/core/module/types";
import {BOARD_PAGE} from "@/core/pages";

export default defineModuleMeta({
    id: "manage",
    name: "관리",
    description: "무급 노예들을 위한 여러 편의 기능입니다.",
    urls: [BOARD_PAGE],
    defaultEnable: false,

    settings: {
        checkAllTargetUser: {
            type: "check",
            name: "선택한 유저 전부 체크",
            desc: "Shift 키를 누른 상태로 체크박스를 눌러 대상 유저 전부를 체크합니다. (아이디, IP, 닉네임 순서)",
            default: false
        },
        checkViaShift: {
            type: "check",
            name: "Shift 다중 체크",
            desc: "Shift 키를 누른 상태로 드래그해 여러 항목을 체크합니다.",
            default: false
        },
        checkCommentViaCtrl: {
            type: "check",
            name: "Ctrl 대댓글 체크",
            desc: "Ctrl 키를 누른 상태로 댓글의 체크박스를 누르면 그 댓글의 대댓글도 함께 체크합니다.",
            default: false
        },
        deleteViaCtrl: {
            type: "check",
            name: "Ctrl로 삭제",
            desc: "Ctrl 키를 누른 상태로 게시글을 클릭해 삭제합니다.",
            default: false
        },
        enableGifControl: {
            type: "check",
            name: "GIF 조작",
            desc: "GIF를 제어하는 기능을 켭니다.",
            default: false
        },
        imageOrigin: {
            type: "check",
            name: "이미지 출처 표시",
            desc: "다른 갤러리에서 올린 본문 이미지나, 다른 갤러리에서 받은 첨부 파일이 있으면 글 제목 위에 알립니다.",
            default: false
        },
        titleSearch: {
            type: "check",
            name: "같은 제목 찾기",
            desc: "게시글 보기에 버튼을 두어 제목이 같은 글을 디시 통합검색에서 찾습니다.",
            default: false
        }
    }
});

/** 옵션·팝업이 그리는 아이콘. 콘텐츠 번들에 딸려 가지 않게 기본 export와 따로 둔다 (ModuleIcons). */
export const icons = {module: ShieldCheck} satisfies ModuleIcons;
