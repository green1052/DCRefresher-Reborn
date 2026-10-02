/**
 * 두 번 누르기 확인. 같은 key를 창(ms) 안에 다시 부르면 true를 돌려주고 처음부터 다시 센다.
 * 다른 key를 거쳐 가면 이전 것은 무효다. 키보드 두 번 누르기(미리보기)와 관리 패널의 확인이 같은 규칙을 쓴다.
 */
export const createDoublePress = (windowMs: number) => {
    let armed: { key: string; at: number } | null = null;

    return (key: string): boolean => {
        const now = Date.now();
        if (armed?.key === key && now - armed.at < windowMs) {
            armed = null;
            return true;
        }
        armed = {key, at: now};
        return false;
    };
};
