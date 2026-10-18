import type {LabelsOf, SettingGroup} from "@/core/module/types";

import type meta from "./meta";

const BACKGROUND_GROUP: SettingGroup = {name: "숨은 탭", desc: "다른 탭을 보는 동안의 새로고침입니다."};

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "글 목록 새로고침",
    description: "글 목록을 자동으로 새로고침합니다.",
    settings: {
        refreshRate: {
            name: "새로고침 주기",
            desc: "글 목록을 새로고침하는 주기입니다. 새 글이 올라오는 1페이지에서만 자동으로 새로고침합니다. 새 글이 한동안 없으면 주기를 조금씩 늘려 최대 4배까지 기다립니다. 새 글이 올라오거나 목록 위에서 마우스·키보드를 쓰면 원래 주기로 돌아옵니다."
        },
        fadeIn: {name: "새 게시글 효과", desc: "새로 추가된 게시글에 효과를 넣습니다."},
        useBetterBrowse: {name: "페이지 이동 시 목록만 교체", desc: "페이지 번호를 누르면 페이지 전체를 다시 불러오지 않고 목록만 바꿉니다."},
        noRefreshOnSearch: {name: "검색 중 자동 새로고침 안 함", desc: "검색 중에는 자동 새로고침을 하지 않습니다."},
        pauseOnHover: {name: "목록 위에서 자동 새로고침 안 함", desc: "마우스를 글 목록 위에 올려 두는 동안에는 자동 새로고침을 하지 않습니다. 누르려던 글이 밀리지 않습니다."},
        titleCount: {
            name: "탭 제목에 새 글 수 표시",
            desc: "다른 창을 보는 동안 들어온 새 글 수를 탭 제목 앞에 (3)처럼 붙입니다. 다른 탭을 보는 동안에도 세려면 '숨은 탭에서도 새로고침'을 켜세요. 탭으로 돌아오면 지우고, 그동안 들어온 글 아래에 '여기까지 읽음' 선을 긋습니다."
        },
        backgroundRefresh: {group: BACKGROUND_GROUP, name: "숨은 탭에서도 새로고침", desc: "다른 탭을 보는 동안에도 아래 주기로 새로고침합니다. 끄면 탭으로 돌아올 때까지 쉽니다."},
        backgroundRefreshRate: {group: BACKGROUND_GROUP, name: "숨은 탭 새로고침 주기", desc: "숨은 탭의 새로고침 주기입니다. 새 글이 한동안 없으면 이 주기도 최대 4배까지 늘어납니다."},
        doNotColorVisited: {name: "방문한 글 색 구분 안 함", desc: "글 목록에서 방문한 글도 방문하지 않은 글과 같은 색으로 표시합니다."}
    },
    toggles: {pause: "자동 새로고침 일시정지"},
    commands: {
        refreshLists: "새로고침",
        refreshPause: "자동 새로고침 일시정지"
    }
} satisfies LabelsOf<typeof meta>;
