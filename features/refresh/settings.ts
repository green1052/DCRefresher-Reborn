import type {ModuleContext, SettingsSchema} from "@/core/module/types";

export const settings = {
    refreshRate: {
        type: "range",
        name: "새로고침 주기",
        desc: "글 목록을 새로고침하는 주기입니다. 새 글이 올라오는 1페이지에서만 자동으로 새로고침합니다.",
        default: 5000,
        min: 3000,
        max: 20000,
        step: 100,
        unit: "ms"
    },
    fadeIn: {
        type: "check",
        name: "새 게시글 효과",
        desc: "새로 추가된 게시글에 효과를 넣습니다.",
        default: true
    },
    useBetterBrowse: {
        type: "check",
        name: "페이지 이동 시 목록만 교체",
        desc: "페이지 번호를 누르면 페이지 전체를 다시 불러오지 않고 목록만 바꿉니다.",
        default: true
    },
    noRefreshOnSearch: {
        type: "check",
        name: "검색 중 자동 새로고침 안 함",
        desc: "검색 중에는 자동 새로고침을 하지 않습니다.",
        default: true
    },
    pauseOnHover: {
        type: "check",
        name: "목록 위에서 자동 새로고침 안 함",
        desc: "마우스를 글 목록 위에 올려 두는 동안에는 자동 새로고침을 하지 않습니다. 누르려던 글이 밀리지 않습니다.",
        default: false
    },
    doNotColorVisited: {
        type: "check",
        name: "방문한 글 색 구분 안 함",
        desc: "글 목록에서 방문한 글도 방문하지 않은 글과 같은 색으로 표시합니다.",
        default: false
    }
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;
