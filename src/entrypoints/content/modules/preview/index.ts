import {PreviewController, type PreviewStatus} from "./controller";
import {PostCache} from "./cache";
import {createMiniPreview, type MiniPreviewState} from "./miniPreview";
import {queryString} from "@/http/http";

interface PreviewMemory {
    controller: PreviewController | null;

    [key: string]: unknown;
}

type PreviewSettingsMap = {
    tooltipMode: RefresherCheckSettings;
    tooltipMediaHide: RefresherCheckSettings;
    tooltipDelay: RefresherRangeSettings;
    tooltipInteraction: RefresherCheckSettings;
    tooltipRatioDisable: RefresherCheckSettings;
    reversePreviewKey: RefresherCheckSettings;
    longPressDelay: RefresherRangeSettings;
    scrollToSkip: RefresherCheckSettings;
    colorPreviewLink: RefresherCheckSettings;
    autoRefreshComment: RefresherCheckSettings;
    commentRefreshInterval: RefresherRangeSettings;
    toggleBlur: RefresherCheckSettings;
    toggleBackgroundBlur: RefresherCheckSettings;
    toggleAdminPanel: RefresherCheckSettings;
    useKeyPress: RefresherCheckSettings;
    blockPresetDay: RefresherOptionSettings;
    blockPresetReason: RefresherTextSettings;
    blockPresetDelete: RefresherCheckSettings;
    blockPresetUserType: RefresherCheckSettings;
    expandRecognizeRange: RefresherCheckSettings;
    experimentalComment: RefresherCheckSettings;
    disableCache: RefresherCheckSettings;
    archiveArticle: RefresherCheckSettings;
    blockImage: RefresherCheckSettings;
};

const postCaches = new PostCache();
const miniPreview: MiniPreviewState = createMiniPreview();

export default {
    name: "미리보기",
    description: "글을 오른쪽 클릭 했을때 미리보기 창을 만들어줍니다.",
    url: /\/board\/(view|lists)/,
    status: {} as PreviewSettingsMap extends Record<string, RefresherSettings> ? { [K in keyof PreviewSettingsMap]: PreviewSettingsMap[K]["default"] } : never,
    memory: {
        controller: null
    },
    enable: true,
    default_enable: true,
    settings: {
        tooltipMode: {
            name: "툴팁 미리보기 표시",
            desc: "마우스를 올려두면 글 내용만 빠르게 볼 수 있는 툴팁을 추가합니다.",
            type: "check",
            default: false
        },
        tooltipMediaHide: {
            name: "툴팁 미리보기 미디어 숨기기",
            desc: "툴팁 미리보기 화면에서 미디어를 숨깁니다.",
            type: "check",
            default: false
        },
        tooltipDelay: {
            name: "툴팁 미리보기 딜레이",
            desc: "툴팁 미리보기가 나타나기까지의 시간을 설정합니다.",
            type: "range",
            default: 0,
            min: 0,
            max: 1000,
            step: 50,
            unit: "ms"
        },
        tooltipInteraction: {
            name: "툴팁 미리보기 상호작용",
            desc: "툴팁 미리보기에서 마우스 클릭이나 휠 스크롤을 가능하게 합니다. (툴팁 미리보기 딜레이 설정 필수)",
            type: "check",
            default: false
        },
        tooltipRatioDisable: {
            name: "툴팁 미리보기 글댓비 강조시 비활성화",
            desc: "글댓비 강조가 활성화된 경우 툴팁 미리보기를 비활성화합니다.",
            type: "check",
            default: false
        },
        reversePreviewKey: {
            name: "키 반전",
            desc: "오른쪽 버튼 대신 왼쪽 버튼으로 미리보기를 엽니다.",
            type: "check",
            default: false
        },
        longPressDelay: {
            name: "기본 마우스 오른쪽 클릭 딜레이",
            desc: "마우스 오른쪽 버튼을 해당 밀리초 이상 눌러 뗄 때 기본 우클릭 메뉴가 나오게 합니다.",
            type: "range",
            default: 300,
            min: 200,
            max: 2000,
            step: 50,
            unit: "ms"
        },
        scrollToSkip: {
            name: "스크롤하여 게시글 이동",
            desc: "맨 위나 아래로 스크롤하여 다음 게시글로 이동할 수 있게 합니다.",
            type: "check",
            default: true
        },
        colorPreviewLink: {
            name: "게시글 URL 변경",
            desc: "미리보기를 열면 게시글의 URL을 변경하여 브라우저 탐색으로 게시글을 바꿀 수 있게 해줍니다.",
            type: "check",
            default: true
        },
        autoRefreshComment: {
            name: "댓글 자동 새로고침",
            desc: "댓글을 일정 주기마다 자동으로 새로고침합니다.",
            type: "check",
            default: false
        },
        commentRefreshInterval: {
            name: "댓글 자동 새로고침 주기",
            desc: "위의 옵션이 켜져있을 시 댓글을 새로고침할 주기를 설정합니다.",
            type: "range",
            default: 10000,
            min: 3000,
            max: 20000,
            step: 100,
            unit: "ms"
        },
        toggleBlur: {
            name: "게시글 배경 블러 활성화",
            desc: "미리보기 창의 배경을 블러 처리하여 미관을 돋보이게 합니다. (성능 하락 영향 있음)",
            type: "check",
            default: true
        },
        toggleBackgroundBlur: {
            name: "바깥 배경 블러 활성화",
            desc: "미리보기 창의 바깥 배경을 블러 처리하여 미관을 돋보이게 합니다. (성능 하락 영향 있음)",
            type: "check",
            default: false
        },
        toggleAdminPanel: {
            name: "관리 패널 활성화",
            desc: "갤러리에 관리 권한이 있는 경우 창 옆에 관리 패널을 표시합니다.",
            type: "check",
            default: true
        },
        useKeyPress: {
            name: "관리 패널 > 키 제어",
            desc: "관리 패널이 활성화된 경우 단축키를 눌러 빠르게 관리할 수 있습니다.",
            type: "check",
            default: true
        },
        blockPresetDay: {
            name: "관리 패널 > 차단 프리셋 > 차단 기간",
            desc: "차단 시 기본으로 선택할 차단 기간을 설정합니다.",
            type: "option",
            default: "1",
            items: {
                "1": "1시간",
                "6": "6시간",
                "24": "1일",
                "168": "7일",
                "336": "14일",
                "744": "31일"
            }
        },
        blockPresetReason: {
            name: "관리 패널 > 차단 프리셋 > 차단 사유",
            desc: "차단 시 기본으로 선택할 차단 사유를 설정합니다.",
            type: "text",
            default: ""
        },
        blockPresetDelete: {
            name: "관리 패널 > 차단 프리셋 > 선택한 글 삭제",
            desc: "차단 시 선택한 글을 삭제합니다.",
            type: "check",
            default: false
        },
        blockPresetUserType: {
            name: "관리 패널 > 차단 프리셋 > 식별 코드 차단 시 IP 동시 차단",
            desc: "차단 시 선택한 글을 삭제합니다.",
            type: "check",
            default: false
        },
        expandRecognizeRange: {
            name: "게시글 목록 인식 범위 확장",
            desc: "게시글의 오른쪽 클릭을 인식하는 범위를 칸 전체로 확장합니다.",
            type: "check",
            default: false
        },
        experimentalComment: {
            name: "댓글 기능 활성화",
            desc: "댓글을 작성할 수 있습니다.",
            type: "check",
            default: false
        },
        disableCache: {
            name: "캐시 비활성화",
            desc: "캐시를 사용하지 않습니다. (툴팁 미리보기 제외)",
            type: "check",
            default: false
        },
        archiveArticle: {
            name: "삭제된 글 & 댓글 보존",
            desc: "삭제된 글과 댓글을 보존합니다. (캐시 비활성화 시 작동 안함)",
            type: "check",
            default: false
        },
        blockImage: {
            name: "이미지 아이콘 없는 이미지 차단",
            desc: "이미지가 없는 게시글에 이미지가 있을 경우 차단합니다.",
            type: "check",
            default: false
        }
    } satisfies PreviewSettingsMap,
    data: {},
    async func(this: RefresherModule<{ data: {}; memory: PreviewMemory; settings: PreviewSettingsMap }>) {
        this.memory.controller = new PreviewController(
            this.status as PreviewStatus,
            postCaches,
            miniPreview,
            queryString("id") ?? undefined
        );
        await this.memory.controller.setup();
    },
    revoke(this: RefresherModule<{ data: {}; memory: PreviewMemory; settings: PreviewSettingsMap }>) {
        this.memory.controller?.destroy();
        this.memory.controller = null;
    }
} as RefresherModule<{
    data: {};
    memory: PreviewMemory;
    settings: PreviewSettingsMap;
}>;