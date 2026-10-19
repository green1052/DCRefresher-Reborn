import type {LabelsOf, SettingGroup} from "@/core/module/types";

import type meta from "./meta";

const SHORTCUT_GROUP: SettingGroup = {name: "관리 단축키", desc: "관리 권한이 있을 때 미리보기에서 키를 두 번 누르면 게시글을 삭제하거나 작성자를 차단합니다."};
const PRESET_GROUP: SettingGroup = {name: "차단 프리셋", desc: "차단 키로 차단할 때 쓰는 값입니다."};
const FRAME_GROUP: SettingGroup = {name: "미리보기 창", desc: "미리보기 창의 너비와 바깥 배경입니다."};

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "미리보기",
    description: "글 목록에서 클릭 또는 우클릭으로 미리보기 창을 띄워 줍니다.",
    settings: {
        previewWidth: {group: FRAME_GROUP, name: "창 너비", desc: "미리보기 창의 너비입니다. 브라우저 창이 좁으면 그에 맞춰 줄어듭니다."},
        toggleBackgroundBlur: {group: FRAME_GROUP, name: "바깥 배경 흐리게", desc: "미리보기 창 바깥 배경을 흐리게 처리합니다. (성능이 떨어질 수 있음)"},
        popupBlur: {name: "팝업 바깥 배경 흐리게", desc: "메모·차단 같은 팝업 창 바깥 배경을 흐리게 처리합니다."},
        scrollToSkip: {
            name: "스크롤하여 게시글 이동",
            desc: "미리보기 맨 아래에서 한 번 더 스크롤하면 이전(번호가 작은) 게시글로, 맨 위에서는 다음(번호가 큰) 게시글로 넘어갑니다."
        },
        tooltipMode: {name: "미니 미리보기 표시", desc: "게시글에 마우스를 올리면 미리보기를 표시합니다."},
        tooltipMediaHide: {name: "미니 미리보기 미디어 숨기기", desc: "미니 미리보기에서 이미지와 동영상을 숨깁니다."},
        tooltipDelay: {name: "미니 미리보기 지연 시간", desc: "미니 미리보기가 표시되기까지의 지연 시간입니다."},
        tooltipInteraction: {
            name: "미니 미리보기 상호작용",
            desc: "마우스를 미니 미리보기 위로 옮겨 내용을 스크롤하거나 링크·이미지를 누를 수 있습니다. 미리보기는 커서를 따라다니지 않습니다."
        },
        reversePreviewKey: {name: "미리보기 키 반전", desc: "좌클릭으로 미리보기를 열고 우클릭으로 게시글로 이동합니다. 댓글 수도 같습니다."},
        longPressDelay: {
            name: "길게 누르기 판정 시간",
            desc: "마우스 오른쪽 버튼을 이 시간 이상 눌렀다 뗄 때 기본 우클릭 메뉴가 나오게 합니다. (Windows 전용 — Shift+우클릭은 어디서나 기본 메뉴)"
        },
        colorPreviewLink: {name: "주소창에 게시글 주소 표시", desc: "미리보기를 여는 동안 주소창과 탭 제목을 그 게시글로 바꿉니다. 연 글은 방문 기록에 남아 목록에서 방문한 글 색으로 보입니다."},
        autoRefreshComment: {name: "댓글 자동 새로고침", desc: "일정 주기로 댓글을 자동으로 새로고침합니다."},
        highlightNewComments: {name: "새 댓글 강조", desc: "댓글을 새로고침했을 때 새로 들어온 댓글을 잠깐 강조합니다."},
        commentRefreshInterval: {name: "댓글 자동 새로고침 주기", desc: "댓글 자동 새로고침 주기입니다."},
        toggleAdminPanel: {name: "관리 패널 활성화", desc: "관리 권한이 있을 때 관리 패널을 표시합니다."},
        useKeyPress: {group: SHORTCUT_GROUP, name: "사용", desc: "키로 게시글을 삭제·차단합니다."},
        deleteKey: {group: SHORTCUT_GROUP, name: "삭제 키", desc: "두 번 누르면 게시글을 삭제합니다."},
        blockKey: {group: SHORTCUT_GROUP, name: "차단 키", desc: "두 번 누르면 차단 프리셋으로 작성자를 차단합니다."},
        blockPresetDay: {group: PRESET_GROUP, name: "차단 기간", desc: "차단 기간입니다."},
        blockPresetDelete: {group: PRESET_GROUP, name: "글도 삭제", desc: "차단하면서 게시글도 삭제합니다."},
        blockPresetUserType: {group: PRESET_GROUP, name: "IP 동시 차단", desc: "식별 코드와 함께 IP도 차단합니다."},
        blockPresetReason: {group: PRESET_GROUP, name: "차단 사유", desc: "차단 사유입니다. (한글 20자 이내)", placeholder: "직접 입력 (한글 20자 이내)"},
        expandRecognizeRange: {name: "게시글 인식 범위 확장", desc: "행 전체를 클릭해도 미리보기가 열리게 합니다."},
        imageViewer: {name: "이미지 크게 보기", desc: "본문 이미지를 누르면 미리보기 안에서 크게 봅니다. ←/→로 넘깁니다. 끄면 원본 보기를 새 탭으로 엽니다."},
        listKeyboard: {name: "목록 키보드 이동", desc: "J/K로 글을 고르고 Enter로 미리보기, O로 게시글을 엽니다. Esc로 선택을 풉니다."},
        disableCache: {name: "캐시 비활성화", desc: "미리보기 캐시를 사용하지 않습니다."},
        archiveArticle: {
            name: "삭제된 글과 댓글 보존",
            desc: "미리보기로 본 지 1분이 안 된 글과 댓글이 삭제되어도 이전 내용을 보여 줍니다. 새로고침한 글 목록에서 사라진 글도 붉게 표시해 남깁니다."
        },
        blockImage: {name: "이미지 아이콘 없는 게시글 이미지 숨기기", desc: "이미지 아이콘이 없는 게시글에 이미지가 있으면 숨깁니다."}
    }
} satisfies LabelsOf<typeof meta>;
