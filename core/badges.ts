import type {IpInfoFilter} from "@/core/database";
import type {ModuleSettings} from "@/core/module/types";
import {nickType} from "@/utils/user";

export type BadgeKey = "UID" | "MEMO" | "RATIO" | "PERMBAN";

/** 유저 정보 모듈의 배지 순서·표시 조건. 페이지(userinfo)와 미리보기 작성자 표시가 이것으로 같게 그린다. */
export interface BadgeView {
    order: BadgeKey[];
    /** 고정닉/반고정닉 아이디 표시. */
    fixedUid: boolean;
    halfFixedUid: boolean;
    ipFilter: IpInfoFilter;
}

/** 유저 정보 모듈이 꺼져 있을 때의 값. 기본 순서이고 IP 정보(userinfo가 붙이는 배지)는 없다. */
export const DEFAULT_BADGE_VIEW: BadgeView = {order: ["UID", "MEMO", "RATIO", "PERMBAN"], fixedUid: true, halfFixedUid: true, ipFilter: "none"};

/** 유저 정보 모듈 설정의 배지 순서·표시 조건. */
export const badgeViewOf = (settings: ModuleSettings["userinfo"]): BadgeView => ({
    order: settings.badgeOrder,
    fixedUid: settings.showFixedNickUID,
    halfFixedUid: settings.showHalfFixedNickUID,
    ipFilter: settings.ipInfoFilter
});

/** 닉콘(고정닉·반고정닉)에 따라 UID를 보일지. 닉콘이 없으면 늘 보인다. */
export const showsUid = (view: BadgeView, icon?: string): boolean => {
    const type = icon ? nickType(icon) : "UNFIXED";
    return type === "FIXED" ? view.fixedUid : type === "HALF_FIXED" ? view.halfFixedUid : true;
};
