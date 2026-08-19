import {onMounted, ref, type Ref, shallowRef, watch} from "vue";

import toast from "@/utils/toast";
import type {Nullable} from "@/utils/types";
import {getLoggedInUserInfo, User} from "@/utils/user";

export interface CommentUserState {
    user: Ref<Nullable<User>>;
    unsignedUserID: Ref<string>;
    unsignedUserPW: Ref<string>;
    fixedUser: Ref<boolean>;
    editUser: Ref<boolean>;
    toggleEditUser: () => void;
    validCheck: (type: string, value: string) => void;
}

// 댓글 작성자 정보 관리 composable
// gallog에서 로그인 사용자 정보 추출, 비로그인 시 localStorage 기반 임시 사용자 생성
export function useCommentUser(): CommentUserState {
    const user = shallowRef<Nullable<User>>(null);
    const unsignedUserID = ref(localStorage.nonmember_nick || "ㅇㅇ");
    const unsignedUserPW = ref(localStorage.nonmember_pw || Math.random().toString(36).substring(2, 10));
    const fixedUser = ref(false);
    const editUser = ref(false);

    watch(unsignedUserID, (value: string) => {
        if (!user.value) return;

        localStorage.setItem("nonmember_nick", value);
        user.value.nick = value;
    });

    watch(unsignedUserPW, (value: string) => {
        localStorage.setItem("nonmember_pw", value);
    });

    onMounted(() => {
        const fixed = getLoggedInUserInfo();

        if (!fixed) {
            user.value = new User(unsignedUserID.value, null, "127.0.0.1", null);
            return;
        }

        fixedUser.value = true;
        if (fixed.id) {
            user.value = new User(fixed.name, fixed.id, null, fixed.iconSrc);
        }
    });

    const toggleEditUser = (): void => {
        if (user.value && user.value.isLogout()) {
            editUser.value = !editUser.value;
        }
    };

    const validCheck = (type: string, value: string): void => {
        if (type === "id" && value.length < 1) {
            toast.show(`아이디는 최소 1자리 이상이어야 합니다. 자동으로 "ㅇㅇ"로 설정합니다.`);
            unsignedUserID.value = "ㅇㅇ";
            return;
        }

        if (type === "pw" && value.length < 2) {
            const random = Math.random().toString(36).substring(5);
            toast.show(`비밀번호는 최소 2자리 이상이어야 합니다. 자동으로 "${random}"로 설정합니다.`);
            unsignedUserPW.value = random;
        }
    };

    return {
        user,
        unsignedUserID,
        unsignedUserPW,
        fixedUser,
        editUser,
        toggleEditUser,
        validCheck
    };
}