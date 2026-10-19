// 파이어폭스 전용 webRequest.filterResponseData (features/block/background.ts). 브라우저 타입(@wxt-dev/browser)은 크롬 타입이라 없어서 쓰는 만큼만 적는다.
export {};

declare module "@wxt-dev/browser/src/gen" {
    namespace Browser.webRequest {
        /** 응답 본문을 받는 대로 넘기는 필터. 받은 것을 write로 페이지에 넘겨야 페이지가 받는다. */
        interface StreamFilter {
            ondata: ((ev: { data: ArrayBuffer }) => void) | null;
            onstop: (() => void) | null;
            onerror: (() => void) | null;

            write(data: ArrayBuffer): void;

            close(): void;
        }

        function filterResponseData(requestId: string): StreamFilter;
    }
}
