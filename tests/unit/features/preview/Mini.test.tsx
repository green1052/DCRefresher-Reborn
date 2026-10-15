import {render} from "preact";
import {act} from "preact/test-utils";
import {afterEach, expect, it, vi} from "vitest";

import {fitMovies} from "@/features/preview/ui/fitMovies";
import {Mini} from "@/features/preview/ui/Mini";
import {usePreviewStore} from "@/features/preview/ui/previewStore";

// jsdom은 iframe 안 문서를 그리지 않아 크기를 잴 수 없으니, 미니 미리보기가 본문에 맞추기를 거는지만 본다.
vi.mock("@/features/preview/ui/fitMovies", () => ({fitMovies: vi.fn(() => () => undefined)}));

afterEach(() => {
    render(null, document.body);
    usePreviewStore.setState({mini: null});
});

it("본문의 동영상 크기를 전체 미리보기처럼 맞춘다", () => {
    act(() => render(<Mini/>, document.body));
    act(() => usePreviewStore.setState({
        mini: {x: 0, y: 0, title: "제목", contents: "<iframe src=\"https://gall.dcinside.com/board/movie/movie_view\"></iframe>", blockMedia: false, interactive: false, gallery: "test"}
    }));

    const contents = document.querySelector<HTMLElement>(".refresher-mini-contents")!;
    expect(fitMovies).toHaveBeenLastCalledWith(contents);
});
