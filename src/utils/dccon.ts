// 디시콘 이미지 URL에서 디시콘 코드(no 파라미터) 추출
export const extractDcconCode = (src: string): string =>
    src.replace(/^.*no=/, "").replace(/&.*$/, "");
