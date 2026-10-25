export const formatTime = (time: number): string => (time === 0 ? "기록 없음" : new Date(time).toLocaleString("ko-KR"));

export const formatBytes = (bytes: number): string =>
    bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(2)}MB`;

/** data를 JSON 파일(name-YYYYMMDD.json)로 내려받는다. 옵션 페이지라 downloads 권한 없이 a[download]로 된다. */
export const downloadJson = (name: string, data: unknown): void => {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type: "application/json"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}-${date}.json`;
    link.click();
    // 바로 풀면 내려받기가 시작되기 전에 주소가 사라지는 브라우저가 있어 조금 두었다가 푼다.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
