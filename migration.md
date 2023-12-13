# 설정 마이그레이션 방법

DCRefresher Reborn에 DCRefresher에서 사용하던 설정을 가져오거나 백업할 수 있습니다.

## Chrome

## 공통

1. ```chrome://extensions``` 접속
2. 개발자 모드 활성화
3. 대상 확장프로그램의 뷰 검사 서비스 워커 클릭
4. 콘솔 탭으로 이동

## 백업

1. 해당 코드 실행 후 결과 복사

### DCRefresher를 백업

```js
chrome.storage.sync.get(null, (settings) => {
    const result = {};

    for (const [key, value] of Object.entries(settings)) {
        if (["refresher.lastVersion"].includes(key)) continue;

        if (key === "refresher.module:유저 정보") {
            const {memos} = JSON.parse(value);

            for (const [key, value] of Object.entries(memos)) {
                const [type, id] = key.split("@");

                result[`__REFRESHER_MEMO:${type}`] ??= {};
                result[`__REFRESHER_MEMO:${type}`][id] = value;
            }

            continue;
        }

        result[key] = value;
    }

    console.log(JSON.stringify(result));
});
```

### DCRefresher Reborn을 백업

```js
chrome.storage.local.get().then((settings) => {
    const result = {};
    for (const [key, value] of Object.entries(settings)) {
        if (["refresher.asn", "refresher.country", "refresher.updated", "refresher.database.ip", "refresher.database.ip.version"].includes(key)) continue;
        result[key] = value;
    }
    console.log(JSON.stringify(result));
});
```

## 복원

1. settings 변수에 백업한 설정 붙여넣고 실행

```js
(async () => {
    const settings = `여기에 입력`;

    await chrome.storage.local.clear();
    for (const [key, value] of Object.entries(JSON.parse(settings))) {
        chrome.storage.local.set({[key]: value});
    }
})();
```
