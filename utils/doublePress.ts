/** 두 번 누르기 확인. 같은 key를 창(ms) 안에 다시 부르면 true이고 처음부터 다시 센다(다른 key는 이전 것을 무효로 한다). */
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
