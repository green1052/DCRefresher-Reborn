# 설정 마이그레이션

설정을 이전하거나 백업하는 방법을 설명합니다.

## Chrome

1. ```chrome://extensions``` 접속
2. 개발자 모드 활성화
3. 뷰 검사 서비스 워커 클릭
4. 콘솔 탭으로 이동

## Firefox

1. ```about:debugging#/runtime/this-firefox``` 접속
2. 검사 버튼 클릭
3. 콘솔 탭으로 이동

## 백업

아래 코드를 실행하고 내용을 복사하세요.

## DCRefresher를 백업

### 백업

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

## DCRefresher Reborn을 백업, 복원 (Deprecated)

해당 코드는 3.10.2 이후 버전에서 사용을 권장하지 않습니다.

대신 설정 > 고급 > 데이터 관리 기능을 사용하세요.

### 백업

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

### 복원

```js
(async () => {
    const settings = `데이터 관리 기능에서 내보낸 JSON`;

    await chrome.storage.local.clear();
    for (const [key, value] of Object.entries(JSON.parse(settings))) {
        chrome.storage.local.set({[key]: value});
    }
})();
```
