const updateWindowSize = (
    forceActive: boolean,
    active: number | string,
    width: number
) => {
    if (typeof active === "string") active = Number(active);

    const isView = location.href.includes("board/view");

    if (forceActive || active >= width) {
        if (!document.documentElement.className.includes("refresherCompact")) {
            document.documentElement.classList.add("refresherCompact");

            if (isView) {
                document.documentElement.classList.add("refresherCompactView");
            }
        }
    } else {
        if (document.documentElement.className.includes("refresherCompact")) {
            document.documentElement.classList.remove("refresherCompact");
        }
    }
};

export default {
    name: "레이아웃 수정",
    description: "디시 레이아웃을 변경할 수 있도록 도와줍니다.",
    url: /(board\/lists|board\/view)/g,
    status: {
        activePixel: 900,
        forceCompact: false,
        hideGalleryView: false,
        hideUselessView: false,
        pushToRight: false,
        removeNotice: false,
        removeDCNotice: false,
        useCompactModeOnView: true
    },
    memory: {
        uuid: null,
        uuiddc: null,
        resize: (): void => {
        }
    },
    settings: {
        activePixel: {
            name: "컴팩트 모드 활성화 조건",
            desc: "브라우저 가로가 이 값 보다 작을 경우 컴팩트 모드를 활성화합니다.",
            type: "range",
            default: 900,
            min: 100,
            step: 1,
            max: screen.width,
            unit: "px",
            advanced: false
        },

        forceCompact: {
            name: "컴팩트 모드 강제 사용",
            desc: "항상 컴팩트 모드를 사용하도록 설정합니다.",
            type: "check",
            default: false,
            advanced: false
        },

        useCompactModeOnView: {
            name: "컴팩트 모드 강제 사용",
            desc: "게시글 보기에서도 컴팩트 모드를 사용하도록 설정합니다.",
            type: "check",
            default: true
        },

        hideGalleryView: {
            name: "갤러리 뷰 숨기기",
            desc: "갤러리 정보, 최근 방문 갤러리 영역을 숨깁니다.",
            type: "check",
            default: false
        },

        hideUselessView: {
            name: "잡다 링크 숨기기",
            desc: "이슈줌, 타갤 개념글, 뉴스, 힛갤등의 컨텐츠를 오른쪽 영역에서 숨깁니다.",
            type: "check",
            default: false
        },

        pushToRight: {
            name: "본문 영역 전체로 확장",
            desc: `"잡다 링크 숨기기" 옵션이 켜진 경우 본문 영역을 확장합니다.`,
            type: "check",
            default: false
        },

        removeNotice: {
            name: "갤러리 공지 숨기기",
            desc: "글 목록에서 공지사항을 숨깁니다.",
            type: "check",
            default: false
        },

        removeDCNotice: {
            name: "디시 공지 숨기기",
            desc: "글 목록에서 운영자의 게시글을 숨깁니다.",
            type: "check",
            default: false
        }
    },
    enable: true,
    default_enable: true,
    require: ["filter"],
    update: {
        activePixel(this: RefresherModule, value: number): void {
            if (this.status) {
                updateWindowSize(this.status.forceCompact, value, innerWidth);
            }
        },

        forceCompact(this: RefresherModule, value: boolean): void {
            updateWindowSize(value, this.status.activePixel, innerWidth);
        },

        hideGalleryView(value: boolean): void {
            document.documentElement.classList[value ? "add" : "remove"](
                "refresherHideGalleryView"
            );
        },

        hideUselessView(value: boolean): void {
            document.documentElement.classList[value ? "add" : "remove"](
                "refresherHideUselessView"
            );
        },

        pushToRight(value: boolean): void {
            document.documentElement.classList[value ? "add" : "remove"](
                "refresherPushToRight"
            );
        },

        removeNotice(
            this: RefresherModule,
            value: boolean,
            filter: RefresherFilter
        ): void {
            if (!this.memory) {
                return;
            }

            if (!this.memory.uuid && value) {
                this.memory.uuid = filter.add(
                    ".gall_list .us-post b",
                    (elem: HTMLElement) => {
                        if (
                            new URL(location.href).searchParams.get("exception_mode") ===
                            "notice"
                        ) {
                            return;
                        }

                        const pelem = (elem.parentElement as HTMLElement)
                            .parentElement as HTMLElement;
                        if (pelem as HTMLElement) {
                            pelem.style.display = "none";
                        }
                    },
                    {
                        neverExpire: true
                    }
                );
            } else if (this.memory.uuid && !value) {
                filter.remove(this.memory.uuid);
            }
        },

        removeDCNotice(
            this: RefresherModule,
            value: boolean,
            filter: RefresherFilter
        ): void {
            if (!this.memory) {
                return;
            }

            if (!this.memory.uuiddc && value) {
                this.memory.uuiddc = filter.add(
                    ".gall_list .ub-content .ub-writer",
                    (elem: Element) => {
                        const adminAttribute = elem.getAttribute("user_name");

                        if (!adminAttribute || adminAttribute !== "운영자") {
                            return;
                        }

                        const pelem = elem.parentElement as HTMLElement;

                        if (pelem) {
                            pelem.style.display = "none";
                        }
                    },
                    {
                        neverExpire: true
                    }
                );
            } else if (this.memory.uuiddc && !value) {
                filter.remove(this.memory.uuiddc);
            }
        }
    },
    func(filter: RefresherFilter): void {
        if (location.href.includes("board/view") && !this.status.useCompactModeOnView) return;

        this.memory.resize = () =>
            updateWindowSize(
                this.status.forceCompact,
                this.status.activePixel,
                innerWidth
            );
        window.addEventListener("resize", this.memory.resize);
        this.memory.resize();

        this.update.hideGalleryView(this.status.hideGalleryView);
        this.update.hideUselessView(this.status.hideUselessView);
        this.update.pushToRight(this.status.pushToRight);

        this.update.removeNotice.bind(this)(this.status.removeNotice, filter);
        this.update.removeDCNotice.bind(this)(this.status.removeDCNotice, filter);
    },

    revoke(filter: RefresherFilter): void {
        window.removeEventListener("resize", this.memory.resize);

        this.update.hideGalleryView(false);
        this.update.hideUselessView(false);
        this.update.pushToRight(false);

        this.update.removeNotice.bind(this)(false, filter);
        this.update.removeDCNotice.bind(this)(false, filter);
    }
};