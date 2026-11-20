/**
 * 디시 투표 iframe(pollFrame)은 페이지 스크립트가 안쪽 본문 높이로 맞춘다(frame.height = body.offsetHeight).
 * 미리보기는 shadow DOM 안이라 그 스크립트가 없어 속성 크기(459×437) 그대로다. 안쪽 내용을 재서 대신 맞춘다.
 * 다른 출처 iframe은 안을 읽을 수 없어 그대로 둔다.
 */
export const fitPolls = (root: HTMLElement): (() => void) => {
    const observers = new Map<HTMLIFrameElement, ResizeObserver>();
    const listeners = new AbortController();

    for (const frame of root.querySelectorAll<HTMLIFrameElement>('iframe[name="pollFrame"]')) {
        const fit = (): void => {
            // 프레임당 옵저버는 하나다. 다시 로드되면 떠난 문서를 보던 옵저버를 끊는다.
            observers.get(frame)?.disconnect();

            const doc = frame.contentDocument;
            // 투표(poll/vote)는 body가 <script>로 시작해 그것을 재면 0×0으로 접히므로 첫 요소를 잰다.
            const container = doc?.body?.querySelector<HTMLElement>(":scope > :not(script, style)");
            if (!doc || !(container instanceof doc.defaultView!.HTMLElement)) return;

            // 글꼴, 배율에 따라 1px만 넘쳐도 안쪽에 스크롤바가 생겨 내용을 가리므로 끈다.
            doc.documentElement.style.overflow = "hidden";

            const observer = new ResizeObserver(() => {
                // 다시 로드되는 중(load 전)엔 떠난 문서의 요소가 0으로 재어져 프레임이 접히므로 무시한다.
                if (frame.contentDocument !== doc) return;
                // 컨테이너 크기만 주면 잘린다. 안쪽 body 여백(양쪽 대칭)을 더하고 소수점은 올린다.
                const {width, height} = container.getBoundingClientRect();
                frame.style.width = `${Math.ceil(width + container.offsetLeft * 2)}px`;
                frame.style.height = `${Math.ceil(height + container.offsetTop * 2)}px`;
            });
            observer.observe(container);
            observers.set(frame, observer);
        };

        if (frame.contentDocument?.readyState === "complete" && frame.contentDocument.URL !== "about:blank") fit();
        // 다시 로드되면(새로고침 등) 안쪽 문서가 바뀌므로 load마다 다시 맞춘다.
        frame.addEventListener("load", fit, {signal: listeners.signal});
    }

    return () => {
        listeners.abort();
        for (const observer of observers.values()) observer.disconnect();
    };
};
