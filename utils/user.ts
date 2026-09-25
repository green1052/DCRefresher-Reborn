/** 닉콘 이미지 파일명 (정확한 대소문자) — 관리자·부관리자 닉콘도 고정닉/반고정닉으로 본다 */
const FIXED_ICONS = new Set([
    "fix_managernik.gif",
    "fix_sub_managernik.gif",
    "fix_nik.gif",
    "nftcon_fix.png",
    "dc20th_wgallcon4.png",
    "w_app_gonick_16.png",
    "nftmdcon_fix.png",
    "gnftmdcon_fix.gif",
    "bestcon_fix.png",
    "fix_newnik.gif"
]);

const HALF_FIXED_ICONS = new Set([
    "managernik.gif",
    "sub_managernik.gif",
    "nik.gif",
    "nftcon.png",
    "dc20th_wgallcon.png",
    "w_app_nogonick_16.png",
    "nftmdcon.png",
    "gnftmdcon.gif",
    "bestcon.png",
    "newnik.gif"
]);

export const getType = (iconUrl: string): "FIXED" | "HALF_FIXED" | "UNFIXED" => {
    const file = iconUrl.split("/").pop() ?? "";
    return FIXED_ICONS.has(file) ? "FIXED" : HALF_FIXED_ICONS.has(file) ? "HALF_FIXED" : "UNFIXED";
};

/** 현재 페이지에서 갤러리 관리 권한이 있는지 — 관리 버튼, 또는 목록 머리의 체크박스 열(미니 갤러리엔 관리 버튼이 없다)로 판단 */
export const isGalleryManager = (): boolean => Boolean(document.querySelector(".useradmin_btnbox button, .gall_list .chkbox_th"));

/** 로그인한 계정 ID — 로그인 박스 갤로그 아이콘의 onclick(window.open('//gallog.dcinside.com/<id>'))에서 읽는다 */
export const loggedInUserId = (): string | undefined =>
    document.querySelector("#login_box .user_info .writer_nikcon")?.getAttribute("onclick")?.match(/gallog\.dcinside\.com\/([\w-]+)/)?.[1];
