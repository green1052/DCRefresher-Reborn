const average = (arr: number[]) => arr.reduce((a, b) => a + b) / arr.length;

enum ScrollMode {
    NOT_DEFINED,
    FIXED,
    VARIABLE
}

interface ScrollSession {
    time: number[];
    delta: number[];
    peak: number;
    direction: number;
    fired: number;
}

export class ScrollDetection {
    lastEvent: number;
    events: Record<string, Array<(...args: any[]) => void>>;
    session: ScrollSession;
    mode: number;

    constructor() {
        this.lastEvent = 0;
        this.events = {};
        this.mode = 0;

        this.session = {
            time: [],
            delta: [],
            peak: 0,
            direction: 0,
            fired: 0
        };

        this.initSession();
    }

    initSession(): void {
        this.session = {
            time: [],
            delta: [],
            peak: 0,
            direction: 0,
            fired: 0
        };
    }

    emit(event: string, ...args: any[]): void {
        this.events[event]?.forEach((func) => {
            func(...args);
        });
    }

    listen(event: string, cb: (...args: any[]) => void): void {
        this.events[event] ??= [];

        this.events[event].push(cb);
    }

    scroll(ev: WheelEvent): void {
        this.emit("scroll", ev);
        this.session.fired = Date.now();
    }

    addMouseEvent(ev: WheelEvent): void {
        const lastEvent = this.lastEvent;
        this.lastEvent = Date.now();

        const absoluteDelta = Math.abs(ev.deltaY);
        if (absoluteDelta < 2) {
            this.initSession();
            return;
        }

        if (Date.now() - lastEvent > 100) {
            this.initSession();

            // 이전 세션이랑 다른 스크롤임
        }

        if (this.session.delta.length !== 0) {
            const lastDelta = this.session.delta[this.session.delta.length - 1];

            if (lastDelta === 100 && average(this.session.delta) === 100) {
                this.mode = ScrollMode.FIXED;
                // delta 절댓값이 100으로 고정된 경우 (deltaY를 지원하지 않거나 마우스 움직임)

                if (!this.session.fired) this.scroll(ev);
                else if (Date.now() - lastEvent > 100) this.initSession();
            } else {
                this.mode = ScrollMode.VARIABLE;
                // delta 절댓값이 다양한 값으로 나오는 경우 (노트북 트랙패드, 관성 스크롤 지원)

                if (lastDelta > this.session.peak) {
                    // 감속 구간 진입 혹은 갑자기 새로운 이벤트 발생
                    if (this.session.fired) {
                        if (Date.now() - this.session.fired > 60 && lastDelta / 4 > absoluteDelta) {
                            // 갑자기 새로운 이벤트로 발생한게 확실함
                            this.initSession();
                        }
                        // 스크롤 이벤트는 이미 불러졌고 scroll tail만 남아 있는 경우
                    } else {
                        this.scroll(ev);
                    }
                } else {
                    this.session.peak = Math.abs(ev.deltaY);
                }
            }
        }

        this.session.delta.push(Math.abs(ev.deltaY));
    }
}
