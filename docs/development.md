## 개발

```
git clone https://github.com/green1052/DCRefresher-Reborn.git
```

우선 위 명령어로 repository를 clone 해주세요.

```
yarn install
```

`yarn install` 명령어를 활용해 의존성 라이브러리들을 다운받아주세요. yarn을 찾을 수 없다고 나오는 경우 `npm install -g yarn` 를 입력해 yarn을 받아주세요.

```
yarn dev
```

그 후, 위 명령어를 입력하여 파일 변경 사항이 있을 때마다 빌드하는 개발 모드를 실행할 수 있습니다.

번들링 라이브러리로 webpack, 테스팅 라이브러리로 mocha를 사용하고 있습니다.

빌드 결과물은 `dist` 폴더에 저장되니 크롬에서 `chrome://extensions` 로 이동하여 `압축해제된 확장 프로그램을 로드합니다.` 를 클릭하신 후 `dist` 폴더를 선택하시면 빌드된 확장 프로그램을
로드할 수 있습니다.

단, 크롬에서 변경 사항을 자동으로 감지하지 않으니 새로 고친 사항이 있을 때마다 `chrome://extensions`에서 확장의 새로고침 버튼을 눌러 주셔야 합니다.

```
yarn build
```

명령어를 통해 production 모드 빌드를 할 수 있습니다. 실행 전에 `dist` 폴더를 삭제하신 후 진행하시는 것을 추천합니다.

## 구조

#### 애플리케이션

![구조](https://user-images.githubusercontent.com/32066651/103604514-adffc600-4f54-11eb-9486-39b1441883db.png)

#### 확장 내부

![app](https://user-images.githubusercontent.com/32066651/103624731-49a52c80-4f7d-11eb-854c-3327434f726b.png)

## 모듈 개발

### module 객체

모듈은 DCRefresher에서 페이지 DOM 제어 등을 담당하는 실질적인 기능 집합입니다. 모듈 파일은 `src/modules` 폴더에 모여 있습니다. 추후에는 외부에서 스크립트를 불러와 따로 빌드 없이 모듈을
사용할 수 있도록 할 예정도 있습니다.

모듈 파일은 오직 하나의 `RefresherModule` 형식의 객체를 가집니다. 객체에 들어가야할 값들은 `src/@types/module.d.ts` 파일에 `RefresherModule`라는 이름의
interface로 정의되어 있으며, 해당 interface를 참고하시며 개발하시면 도움이 되실겁니다.

`RefresherModule`의 구조는 업데이트되면서 변경될 수 있으며, 추가되었으면 하는 API가 있으시면 언제든지 이슈나 Pull Request 남겨주시면 감사하겠습니다.

API들은 `module.require` 에서 배열의 형태로 이름들을 넣어 불러올 수 있으며 적은 순서대로 `module.func` 과 `module.revoke` 에 인자로 넣어 호출하게 됩니다.

Refresher에서 제공하는 Core API들은 다음과 같습니다.

#### filter

MutationObserver를 활용한 API로, `filter.add` 함수로 필터에 등록시켜두면 DOM에서 해당 선택자에 맞는 Element를 찾아 반환합니다.

##### filter.add()

> (선택자: string, 콜백 함수<요소>: Function, 옵션: RefresherFilteringOptions): UUID

`선택자`를 가진 요소가 필터에 감지될 경우 `콜백 함수`의 인자로 요소를 담아 함수를 호출합니다. 선택자를 가진 요소가 없으면 콜백 함수는 실행되지 않습니다.

결과 값으로 UUID를 반환합니다.

##### filter.remove()

> (UUID: string, UUID를 가진 필터가 없을 경우 건너뛸지에 대한 여부: boolean)

`UUID`를 가진 필터를 제거합니다.

##### filter.run()

> (비동기 방식으로 실행할지에 대한 여부: boolean)

필터에 등록된 모든 함수들을 실행합니다.
<b>모듈에서 직접 run 함수를 호출하는 것은 권장되지 않습니다. 대신 runSpecific 사용을 고려하세요.</b>

run 함수는 기본적으로 페이지 로드 중, 페이지 로드 후에 자동으로 실행됩니다.

##### runSpecific()

> (UUID: string)

`UUID`를 가진 필터를 실행합니다. 다크모드와 같이 반응성이 중요한 경우 runSpecific을 모듈에서 직접 사용하여 다른 모듈에서 처리하는 것에 비해 빠르게 호출할 수 있습니다.

#### Frame

프레임을 생성하는 API입니다. 미리보기 창에서 보는 그 프레임입니다. 아직은 미리보기 모듈용으로 구현되어 있어 사용을 권장하지 않습니다. 지금은 모듈의 `func` 함수
내에서 `document.createElement`를 사용하여 창을 만들어 사용해주세요.

#### eventBus

EventBus 모델을 구현한 API입니다. 이벤트를 발생시켜 다른 모듈이나 코어와 통신할 수 있습니다.

##### eventBus.on()

> (이벤트 이름: string, 콜백 함수<...any>: Function, 옵션: RefresherEventBusOption): UUID

`이벤트 이름`을 가진 이벤트가 `emit`될 경우 콜백 함수를 실행합니다. 결과 값으로 UUID를 반환합니다.

현재 옵션에는 `once: boolean` (한번 호출된 후에 삭제) 한 가지 값만 넣을 수 있습니다.

##### eventBus.emit()

> (이벤트 이름: string, ...넘길 인자들: any)

`이벤트 이름`을 가진 이벤트를 `...넘길 인자들`을 담아 호출합니다.

##### eventBus.remove()

> (이벤트 이름: string, UUID: string, UUID를 가진 필터가 없을 경우 건너뛸지에 대한 여부: boolean)

`이벤트 이름`을 가진 이벤트 함수 목록 중에서 `UUID`를 가진 함수를 제거합니다.

#### http

브라우저 fetch API를 사용한 네트워킹 API입니다. 다른 페이지를 가져와 처리할 수 있습니다.

##### http.urls{}

페이지 기본 URL을 담은 객체입니다. 내용은 `src/utils/http.ts`를 참고하세요.

##### http.make()

> == fetch API: Promise

기능은 fetch API와 다를 것이 없으나 결과 값으로 실패시 `HTTP 코드, 상태 메세지`를 담안 reject가 오며, 성공시 결과 값의 텍스트를 담은 resolve가 옵니다.

##### http.view()

> (URL: string): string

`URL`이 게시글 보기 창일 때 (/board/view) 게시글 목록 URL로 바꾸어 반환합니다.

##### http.checkMini()

> (URL: string): boolean

`URL`이 미니 갤러리 링크인지 확인합니다.

##### http.checkMinor()

> (URL: string): boolean

`URL`이 마이너 갤러리 링크인지 확인합니다.

##### http.galleryType()

> (URL: string): string

`URL`에서 갤러리 타입을 확인하여 도메인 뒤에 붙는 URL 값을 반환합니다. 메이저 갤러리인 경우 ``, 마이너 갤러리인 경우 `mgallery`, 미니 갤러리인 경우 `mini` 가 반환됩니다.

##### http.galleryTypeName()

> (URL: string): string

`URL`에서 갤러리 타입을 확인하여 디시 내부 API에서 사용하는 갤러리 이름 값을 반환합니다.

메이저 갤러리인 경우 `G`, 마이너 갤러리인 경우 `M`', 미니 갤러리인 경우 `MI` 가 반환됩니다.

#### ip

##### ip.format()

> (IP: string): string

IP 값을 읽고 통신사나 회사 정보를 IP와 함께 적어 반환합니다.


<br/>
여기에 정리되지 않은 값들은 내부적으로 사용되는 함수거나 잘 사용되지 않는 함수들입니다.

여기서 직접 import해서 사용하면 안되는가?라는 의문점이 드실 수도 있습니다. 그러실 수 있고요. 자유롭게 core를 import 해서 사용해주시면 됩니다. <b>단, 이는 src/modules 폴더에 들어갔을
때만 해당하며 외부 스크립트 로드 방식은 module.require을 작성하여 사용해주셔야 합니다.</b>

### 모듈 개발 예시

#### 1. 페이지에서 컨텐츠 변경하기

페이지의 한 요소 (여기서는 갤러리 대문) 를 제거한다고 가정해봅시다.

![image](https://user-images.githubusercontent.com/32066651/103629509-bde2ce80-4f83-11eb-97f5-7b1fbdaa6982.png)

##### module.func 작성

페이지에서 1번째 인자의 선택자를 가진 Element를 찾아 2번째 인자의 함수로 전달하는 함수는 `filter.add` 입니다. 갤러리 대문의 선택자 `.issue_contentbox .bgcover`
를 `filter.add` 함수의 1번째 인자로 지정하고, 그 요소를 제어하기 위해 2번째 인자로 함수를 하나 작성하겠습니다. 그리고 필터를 등록했으니 나중에 모듈이 비활성화되었을 때 필터를 제거하기
위해 `filter.add` 함수에서 반환하는 UUID 값을 `this.memory.coverFilter` 에 넣겠습니다.

```js
export.module = {
    name: "대문 제거",
    desc: "갤러리 대문을 제거합니다.",
    memory: {coverFilter: ""},
    require: ["filter"],
    func(filter) {
        this.memory.coverFilter = filter.add(".issue_contentbox .bgcover", (element) => {
            // element: <span>...</span>

            element.parentElement.removeChild(element); // 요소 제거
        });
    }
};
```

이 얼마나 간단한 스크립트인가요. 이를 그대로 모듈에 작성하여 확장을 로드해볼까요?

![image](https://user-images.githubusercontent.com/32066651/103630839-98ef5b00-4f85-11eb-9f74-058b9103c1ec.png)

잔짜잔! 성공적으로 갤러리 대문이 제거된 것을 확인하실 수 있습니다.

##### module.revoke 작성

`module.revoke`는 모듈이 비활성화되기 전 사용했던 메모리를 정리하거나 필터 함수를 제거할 때 사용하는 함수입니다. `module.func` 에서 받는 인자들을 그대로 받습니다.

위에서 `this.memory.coverFilter`에 UUID를 넣었었죠. 이제 필터 함수에서 이 UUID를 가진 필터를 제거해보도록 하겠습니다.

```js
{
... // func, name, memory...
    revoke(filter)
    {
        if (this.memory.coverFilter) {
            filter.remove(this.memory.coverFilter)
        }
    }
}
```

놀랍게도 한국 개발자들이 보여주다-사실 모듈 작성이 정말 쉽다는 것

#### 2. 이벤트 받기

새로고침 모듈에서는 `refresh` 이벤트를 새로고침될 때마다 반환합니다.

```js
export.module = {
    name: "이벤트 버스 예제",
    desc: "이벤트 버스의 예제입니다.",
    memory: {event: ""},
    require: ["eventBus"],
    func(eventBus) {
        this.memory.event = eventBus.add("refresh", _ => {
            // 새로고침될 때 할 일을 여기서 구현합니다.

            alert("새로고침");
        });
    },
    revoke(eventBus) {
        if (this.memory.event) {
            eventBus.remove("refresh", this.memory.event);
        }
    }
};
```

이렇게 작성하면 새로고침 모듈이 새로고칠 때마다 `새로고침`을 팝업 창으로 띄우게 됩니다.
