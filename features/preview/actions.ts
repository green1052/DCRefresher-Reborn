import {getModuleApi} from "@/core/module/registry";
import type {GalleryPreData} from "@/core/preview/types";
import {blockUser, type BlockOptions, bump, deletePost, setNotice, setRecommend} from "@/core/preview/request";
import {notifyManage} from "@/utils/notify";
import {isRecord} from "@/utils/record";

import {MANAGE_LABELS, type ManageKind, usePreviewStore} from "./ui/previewStore";

/**
 * 미리보기 창의 관리(공지·개념글·삭제·끌올)와 차단. 관리 패널·차단 창·단축키가 같이 쓴다.
 * 둘 다 끝나면 목록을 다시 받는다. close는 글을 지웠을 때 창을 닫는다.
 */
export const createActions = (close: () => void) => {
    const store = usePreviewStore;

    // 관리 요청은 한 번에 하나만 보낸다. 패널을 연타해도 같은 POST가 두 번 가지 않는다.
    let managing = false;

    const manage = async (kind: ManageKind) => {
        const st = store.getState();
        // 목록에서 가져온 글 정보만 쓴다. 본문을 받는 중이거나 오류가 난 창에서도 관리할 수 있다.
        if (!st.preData || managing) return;

        const target = st.preData;
        // 응답 전에 다른 글로 넘어갔으면 공지·개념글 표시는 바꾸지 않고 알림만 띄운다.
        const stillOpen = (): boolean => store.getState().signalId === st.signalId;
        managing = true;

        // 바뀐 공지·개념글 상태를 글 정보와 지금 기록에도 넣는다. 다른 글로 넘어갔다 뒤로 가기로 돌아오면
        // 기록에 남은 옛 상태로 버튼이 반대로 보여, 두 번 누르면 반대 요청이 나간다.
        const toggled = (field: "notice" | "recommend", value: boolean): void => {
            const preData = {...target, [field]: value};
            store.setState(field === "notice" ? {notice: value, preData} : {recommend: value, preData});
            const state: unknown = history.state;
            if (isRecord(state) && isRecord(state.preData) && state.preData.id === target.id) history.replaceState({...state, preData}, "");
        };

        const failure = "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
        try {
            // 공지·개념글 표시는 성공했을 때만 바꾼다.
            if (kind === "notice" || kind === "recommend") {
                const on = st[kind];
                const request = kind === "notice" ? setNotice(target, !on) : setRecommend(target, !on);
                if (await notifyManage(request, `${MANAGE_LABELS[kind][on ? 1 : 0]}했습니다.`, failure) && stillOpen()) toggled(kind, !on);
            } else if (kind === "delete") {
                close();
                await notifyManage(deletePost(target), "게시글을 삭제했습니다.", failure);
            } else if (kind === "bump") {
                await notifyManage(bump(target), "게시글을 끌올했습니다.", failure);
            }
        } finally {
            managing = false;
        }

        void getModuleApi("refresh")?.reload();
    };

    // 차단 요청도 한 번에 하나만. 차단 키를 네 번 누르면(두 번씩 두 차례) 같은 사람을 두 번 차단한다.
    let blocking = false;

    /** 차단 키(프리셋)와 차단 창이 같이 쓴다. 글도 지웠으면 창을 닫는다. */
    const block = async (target: GalleryPreData, options: BlockOptions): Promise<boolean> => {
        if (blocking) return false;
        blocking = true;
        const signal = store.getState().signalId;
        try {
            const blocked = await notifyManage(blockUser(target, options), "차단했습니다.", "차단하지 못했습니다. 잠시 후 다시 시도해 주세요.");
            // 그새 다른 글로 넘어갔으면 창을 닫지 않는다.
            if (blocked && options.delChk && store.getState().signalId === signal) close();
            void getModuleApi("refresh")?.reload();
            return blocked;
        } finally {
            blocking = false;
        }
    };

    return {manage, block};
};
