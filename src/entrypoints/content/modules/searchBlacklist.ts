import filter from "@/core/filtering";

const SEARCH_RESULT_SCOPE = ".integrate_cont.sch_result .sch_result_list > li";

const parseKeywords = (value: string): string[] =>
    value
        .split(/[,\n]/)
        .map((keyword) => keyword.trim().toLowerCase())
        .filter((keyword) => keyword.length > 0);

const getSearchResultText = (element: HTMLElement): string => {
    const title = element.querySelector<HTMLElement>(".tit_txt")?.textContent ?? "";
    const description = Array.from(element.querySelectorAll<HTMLElement>(".link_dsc_txt:not(.dsc_sub)"))
        .map((node) => node.textContent ?? "")
        .join(" ");
    const gallery = element.querySelector<HTMLElement>(".sub_txt")?.textContent ?? "";

    return `${title} ${description} ${gallery}`.toLowerCase();
};

const removeBlockedResult = (element: HTMLElement, keywords: string[]): void => {
    if (keywords.length < 1) return;

    const text = getSearchResultText(element);
    if (!keywords.some((keyword) => text.includes(keyword))) return;

    element.remove();
};

export default {
    name: "통검 블랙리스트",
    description: "통합검색 결과에서 지정한 단어가 포함된 게시물을 숨깁니다.",
    url: /^https:\/\/search\.dcinside\.com\//,
    status: {
        keywords: ""
    },
    data: undefined,
    memory: {
        filterId: null,
        keywords: []
    },
    enable: true,
    default_enable: true,
    shortcuts: undefined,
    settings: {
        keywords: {
            name: "블랙리스트 단어",
            desc: "통합검색 결과의 갤러리 이름, 제목, 내용에 포함되면 게시물을 제거합니다. 여러 단어는 쉼표로 구분합니다.",
            type: "text",
            default: "",
            value: ""
        }
    },
    update: {
        keywords(value: string) {
            this.memory.keywords = parseKeywords(value);

            if (this.memory.filterId) {
                void filter.runSpecific(this.memory.filterId);
            }
        }
    },
    func() {
        this.memory.keywords = parseKeywords(this.status.keywords);

        const run = (element: HTMLElement) => {
            removeBlockedResult(element, this.memory.keywords);
        };

        this.memory.filterId = filter.add(SEARCH_RESULT_SCOPE, run, {
            neverExpire: true,
            skipIfNotExists: true
        });
    },
    revoke() {
        if (this.memory.filterId) {
            filter.remove(this.memory.filterId, true);
            this.memory.filterId = null;
        }
    }
} as RefresherModule<{
    memory: {
        filterId: string | null;
        keywords: string[];
    };
    settings: {
        keywords: RefresherTextSettings;
    };
    update: {
        keywords(value: string): void;
    };
}>;
