# 설정 마이그레이션 방법

## Chrome

## 공통

1. ```chrome://extensions``` 접속
2. 개발자 모드 활성화
3. 대상 확장프로그램의 뷰 검사 서비스 워커 클릭
4. 콘솔 탭으로 이동


## 백업

1. 해당 코드 실행 후 결과 복사

### DCRefresher
```js
chrome.storage.sync.get().then((settings) => {
    const result = {};
    for (const [key, value] of Object.entries(settings)) {
        if (["refresher.asn", "refresher.country", "refresher.updated"].includes(key)) continue;
        result[key] = value;
    }
    console.log(JSON.stringify(result));
});
```

### DCRefresher Reborn 
```js
chrome.storage.local.get().then((settings) => {
    const result = {};
    for (const [key, value] of Object.entries(settings)) {
        if (["refresher.asn", "refresher.country", "refresher.updated"].includes(key)) continue;
        result[key] = value;
    }
    console.log(JSON.stringify(result));
});
```

## 복원

1. settings 변수에 백업한 설정 붙여넣고 실행

### DCRefresher
```js
const settings = ``;
for (const [key, value] of Object.entries(JSON.parse(settings))) {
    chrome.storage.sync.set({[key]: value});
}
```

### DCRefresher Reborn 
```js
const settings = ``;
for (const [key, value] of Object.entries(JSON.parse(settings))) {
    chrome.storage.local.set({[key]: value});
}
```
