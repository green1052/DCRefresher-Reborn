export type UserType =
    | "UNFIXED"
    | "HALF_FIXED"
    | "FIXED"
    | "HALF_FIXED_SUB_MANAGER"
    | "FIXED_SUB_MANAGER"
    | "HALF_FIXED_MANAGER"
    | "FIXED_MANAGER";

/** 닉콘 이미지 파일명 → 유저 타입 (정확한 대소문자 매핑) */
const TYPE_BY_FILE: Record<string, UserType> = {
    "managernik.gif": "HALF_FIXED_MANAGER",
    "fix_managernik.gif": "FIXED_MANAGER",
    "sub_managernik.gif": "HALF_FIXED_SUB_MANAGER",
    "fix_sub_managernik.gif": "FIXED_SUB_MANAGER",
    "fix_nik.gif": "FIXED",
    "nftcon_fix.png": "FIXED",
    "dc20th_wgallcon4.png": "FIXED",
    "w_app_gonick_16.png": "FIXED",
    "nftmdcon_fix.png": "FIXED",
    "gnftmdcon_fix.gif": "FIXED",
    "bestcon_fix.png": "FIXED",
    "fix_newnik.gif": "FIXED",
    "nik.gif": "HALF_FIXED",
    "nftcon.png": "HALF_FIXED",
    "dc20th_wgallcon.png": "HALF_FIXED",
    "w_app_nogonick_16.png": "HALF_FIXED",
    "nftmdcon.png": "HALF_FIXED",
    "gnftmdcon.gif": "HALF_FIXED",
    "bestcon.png": "HALF_FIXED",
    "newnik.gif": "HALF_FIXED"
};

export const getType = (iconUrl: string): UserType => {
    const file = iconUrl.split("/").pop() ?? "";
    return TYPE_BY_FILE[file] ?? "UNFIXED";
};

/** 현재 페이지에서 갤러리 관리 권한이 있는지 — 관리 버튼, 또는 목록 머리의 체크박스 열(미니 갤러리엔 관리 버튼이 없다)로 판단 */
export const isGalleryManager = (): boolean => Boolean(document.querySelector(".useradmin_btnbox button, .gall_list .chkbox_th"));
