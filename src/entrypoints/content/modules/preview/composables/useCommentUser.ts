import {useEffect, useState} from "react";

import toast from "@/utils/toast";
import type {Nullable} from "@/utils/types";
import {getLoggedInUserInfo, User} from "@/utils/user";

// 댓글 작성자 정보 관리 훅
// gallog에서 로그인 사용자 정보 추출, 비로그인 시 localStorage 기반 임시 사용자 생성
export function useCommentUser() {
    const [user, setUser] = useState<Nullable<User>>(null);
    const [unsignedUserID, setUnsignedUserID] = useState(localStorage.nonmember_nick || "ㅇㅇ");
    const [unsignedUserPW, setUnsignedUserPW] = useState(
        localStorage.nonmember_pw || Math.random().toString(36).substring(2, 10)
    );
    const [fixedUser, setFixedUser] = useState(false);
    const [editUser, setEditUser] = useState(false);

    useEffect(() => {
        const fixed = getLoggedInUserInfo();

        if (!fixed) {
            setUser(new User(unsignedUserID, null, "127.0.0.1", null));
            return;
        }

        setFixedUser(true);
        if (fixed.id) {
            setUser(new User(fixed.name, fixed.id, null, fixed.iconSrc));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const changeUnsignedUserID = (value: string) => {
        setUnsignedUserID(value);
        localStorage.setItem("nonmember_nick", value);
        setUser((prev) => {
            if (prev) prev.nick = value;
            return prev;
        });
    };

    const changeUnsignedUserPW = (value: string) => {
        setUnsignedUserPW(value);
        localStorage.setItem("nonmember_pw", value);
    };

    const toggleEditUser = (): void => {
        setUser((prev) => {
            if (prev && prev.isLogout()) {
                setEditUser((e) => !e);
            }
            return prev;
        });
    };

    const validCheck = (type: string, value: string): void => {
        if (type === "id" && value.length < 1) {
            toast.show(`아이디는 최소 1자리 이상이어야 합니다. 자동으로 "ㅇㅇ"로 설정합니다.`);
            changeUnsignedUserID("ㅇㅇ");
            return;
        }

        if (type === "pw" && value.length < 2) {
            const random = Math.random().toString(36).substring(5);
            toast.show(`비밀번호는 최소 2자리 이상이어야 합니다. 자동으로 "${random}"로 설정합니다.`);
            changeUnsignedUserPW(random);
        }
    };

    return {
        user,
        unsignedUserID,
        unsignedUserPW,
        changeUnsignedUserID,
        changeUnsignedUserPW,
        fixedUser,
        editUser,
        toggleEditUser,
        validCheck
    };
}
