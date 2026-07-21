enum ScrollMode {
    NOT_DEFINED,
    FIXED,
    VARIABLE
}

interface ScrollSession {
    delta: number[];
    peak: number;
    fired: number;
}

type ScrollEventHandler = (ev: WheelEvent, ...args: unknown[]) => void;

const SCROLL_TAIL_THRESHOLD = 60;
const NEW_EVENT_RATIO = 4;
const SESSION_RESET_DELAY = 100;
const MAX_DELTA_HISTORY = 50;
const MIN_DELTA_THRESHOLD = 2;
const FIXED_DELTA_VALUE = 100;

export class ScrollDetection {
    lastEvent: number;
    events: Record<string, ScrollEventHandler[]>;
    session: ScrollSession;
    mode: number;

    constructor() {
        this.lastEvent = 0;
        this.events = {};
        this.mode = ScrollMode.NOT_DEFINED;
        this.session = this.createSession();
    }

    initSession(): void {
        this.session = this.createSession();
    }

    emit(event: string, ...args: unknown[]): void {
        this.events[event]?.forEach((func) => {
            (func as (...a: unknown[]) => void)(...args);
        });
    }

    listen(event: string, cb: ScrollEventHandler): void {
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

        // 미세 스크롤 무시
        if (absoluteDelta < MIN_DELTA_THRESHOLD) {
            this.initSession();
            return;
        }

        // 이전 세션과 다른 스크롤 시 세션 초기화
        if (Date.now() - lastEvent > SESSION_RESET_DELAY) {
            this.initSession();
        }

        if (this.session.delta.length !== 0) {
            const lastDelta = this.session.delta[this.session.delta.length - 1];

            if (lastDelta === FIXED_DELTA_VALUE && this.average(this.session.delta) === FIXED_DELTA_VALUE) {
                // FIXED 모드: delta 절댓값이 100으로 고정 (deltaY 미지원 또는 마우스)
                this.mode = ScrollMode.FIXED;

                if (!this.session.fired) this.scroll(ev);
                else if (Date.now() - lastEvent > SESSION_RESET_DELAY) this.initSession();
            } else {
                // VARIABLE 모드: delta가 다양한 값 (트랙패드, 관성 스크롤)
                this.mode = ScrollMode.VARIABLE;

                if (lastDelta > this.session.peak) {
                    // 감속 구간 진입 또는 새로운 이벤트
                    if (this.session.fired) {
                        if (Date.now() - this.session.fired > SCROLL_TAIL_THRESHOLD && lastDelta / NEW_EVENT_RATIO > absoluteDelta) {
                            this.initSession();
                        }
                    } else {
                        this.scroll(ev);
                    }
                } else {
                    this.session.peak = Math.abs(ev.deltaY);
                }
            }
        }

        if (this.session.delta.length < MAX_DELTA_HISTORY) {
            this.session.delta.push(Math.abs(ev.deltaY));
        }
    }

    private createSession(): ScrollSession {
        return {delta: [], peak: 0, fired: 0};
    }

    private average(arr: number[]): number {
        if (arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b) / arr.length;
    }
}