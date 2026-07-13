import {RefreshController, type RefreshStatus} from "./controller";

interface RefreshMemory {
    controller: RefreshController | null;

    [key: string]: unknown;
}

type RefreshSettingsMap = {
    refreshRate: RefresherRangeSettings;
    fadeIn: RefresherCheckSettings;
    useBetterBrowse: RefresherCheckSettings;
    noRefreshOnSearch: RefresherCheckSettings;
    doNotColorVisited: RefresherCheckSettings;
};

export default {
    name: "글 목록 새로고침",
    description: "글 목록을 자동으로 새로고침합니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    memory: {
        controller: null
    },
    enable: true,
    default_enable: true,
    settings: {
        refreshRate: {
            name: "새로고침 주기",
            desc: "페이지를 새로 고쳐 현재 페이지에 반영하는 주기입니다.",
            type: "range",
            default: 5000,
            min: 3000,
            max: 20000,
            step: 100,
            unit: "ms"
        },
        fadeIn: {
            name: "새 게시글 효과",
            desc: "새로 올라온 게시글에 서서히 등장하는 효과를 줍니다.",
            type: "check",
            default: true
        },
        useBetterBrowse: {
            name: "인페이지 페이지 전환",
            desc: "게시글 목록을 다른 페이지로 넘길 때 페이지를 새로 고치지 않고 넘길 수 있게 설정합니다.",
            type: "check",
            default: true
        },
        noRefreshOnSearch: {
            name: "검색 중 페이지 새로고침 안함",
            desc: "사이트 내부 검색 기능을 사용 중일시 새로고침을 사용하지 않습니다.",
            type: "check",
            default: true
        },
        doNotColorVisited: {
            name: "방문 링크 색상 지정 비활성화",
            desc: "Firefox와 같이 방문한 링크 색상 지정이 느린 브라우저에서 깜빡거리는 현상을 완화시킵니다.",
            type: "check",
            default: false
        }
    },
    shortcuts: {
        refreshLists() {
            this.memory.controller?.refreshLists();
        },
        refreshPause() {
            this.memory.controller?.togglePause();
        }
    },
    async func() {
        this.memory.controller = new RefreshController(this.status as RefreshStatus);
        await this.memory.controller.setup();
    },
    revoke() {
        this.memory.controller?.destroy();
        this.memory.controller = null;
    }
} as RefresherModule<{
    memory: RefreshMemory;
    shortcuts: {
        refreshLists(): void;
        refreshPause(): void;
    };
    settings: RefreshSettingsMap;
}>;