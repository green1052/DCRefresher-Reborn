/**
 * 비회원 닉네임·비밀번호. 디시가 댓글을 쓸 때 페이지 localStorage에 기억하는 값을 같이 쓴다 (common.js의 save_def_nonmember).
 * 그래야 원문 페이지와 미리보기가 같은 닉네임·비밀번호를 채운다.
 */
export const savedNonmember = (): { nick: string; pw: string } => ({
    nick: localStorage.getItem("nonmember_nick") ?? "",
    pw: localStorage.getItem("nonmember_pw") ?? ""
});

/** 디시처럼 닉네임은 늘, 비밀번호는 비어 있지 않을 때만 저장한다. */
export const saveNonmember = (nick: string, pw: string): void => {
    localStorage.setItem("nonmember_nick", nick);
    if (pw) localStorage.setItem("nonmember_pw", pw);
};
