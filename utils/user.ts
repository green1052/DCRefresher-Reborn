/** 고정닉 닉콘 파일명(대소문자 구분). 관리자·부관리자 닉콘도 fix_ 접두사가 있으면 고정닉이다. */
const FIXED_ICONS = new Set([
    "fix_managernik.gif",
    "fix_sub_managernik.gif",
    "nftcon_fix_manager.png",
    "w_app_gonick_manager_16.png",
    "bestcon_fix_manager.png",
    "fix_nik.gif",
    "nftcon_fix.png",
    "dc20th_wgallcon4.png",
    "w_app_gonick_16.png",
    "nftmdcon_fix.png",
    "gnftmdcon_fix.gif",
    "bestcon_fix.png",
    "fix_newnik.gif"
]);

/** 반고정닉 닉콘 파일명. */
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

/** 닉네임 종류: 고정닉, 반고정닉, 유동(닉콘 없음). */
type NickType = "FIXED" | "HALF_FIXED" | "UNFIXED";

/** 닉콘 주소로 닉네임 종류를 가린다. 모르는 닉콘은 유동으로 본다. */
export const nickType = (iconUrl: string): NickType => {
    const file = iconUrl.split("/").pop() ?? "";
    return FIXED_ICONS.has(file) ? "FIXED" : HALF_FIXED_ICONS.has(file) ? "HALF_FIXED" : "UNFIXED";
};

/**
 * 현재 페이지에서 갤러리 관리 권한이 있는지. 관리 버튼, 목록 머리의 체크박스 열, 매니저 말머리 탭(listSearchHead(999))으로 판단한다.
 * 미니 갤러리에는 관리 버튼이 없고, 매니저 탭 목록에는 체크박스 열이 없다. 매니저 탭은 매니저에게만 보인다 (#271).
 */
export const isGalleryManager = (): boolean =>
    Boolean(document.querySelector(".useradmin_btnbox button, .gall_list .chkbox_th, a[onclick^=\"listSearchHead(999)\"]"));

/** 로그인한 계정 ID. 로그인 박스 갤로그 아이콘의 onclick(window.open('//gallog.dcinside.com/<id>'))에서 읽는다. */
export const loggedInUserId = (): string | undefined =>
    document.querySelector("#login_box .user_info .writer_nikcon")?.getAttribute("onclick")?.match(/gallog\.dcinside\.com\/([\w-]+)/)?.[1];
