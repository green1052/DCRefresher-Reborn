import type {LabelsOf} from "@/core/module/types";

import type meta from "./meta";

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "레이아웃 수정",
    description: "디시 레이아웃을 변경합니다.",
    settings: {
        activePixel: {name: "컴팩트 모드 활성화 조건", desc: "브라우저 가로가 이 값보다 작으면 컴팩트 모드를 활성화합니다."},
        forceCompact: {name: "컴팩트 모드 강제 사용", desc: "항상 컴팩트 모드를 사용합니다."},
        useCompactModeOnView: {name: "게시글 보기 컴팩트 모드", desc: "게시글 보기에서도 컴팩트 모드를 사용합니다."},
        hideGalleryView: {name: "갤러리 뷰 숨기기", desc: "갤러리 정보, 최근 방문 갤러리 영역을 숨깁니다."},
        hideUselessView: {name: "잡다 링크 숨기기", desc: "이슈줌, 타갤 개념글, 뉴스, 힛갤 등의 콘텐츠를 오른쪽 영역에서 숨깁니다."},
        hideGalleryImage: {name: "갤러리 대문 숨기기", desc: "갤러리 대문을 숨깁니다."},
        removeNotice: {name: "갤러리 공지 숨기기", desc: "글 목록에서 공지사항을 숨깁니다."},
        removeDCNotice: {name: "디시 공지 숨기기", desc: "글 목록에서 운영자의 게시글을 숨깁니다."},
        removeGamemeca: {name: "게임메카 숨기기", desc: "글 목록에서 게임메카 게시글을 숨깁니다."},
        removeAi: {name: "AI 글 숨기기", desc: "글 목록에서 AI 표시가 붙은 글을 숨깁니다."},
        pushToRight: {name: "본문 영역 전체로 확장", desc: "\"잡다 링크 숨기기\" 옵션이 켜져 있으면 본문 영역을 확장합니다."}
    }
} satisfies LabelsOf<typeof meta>;
