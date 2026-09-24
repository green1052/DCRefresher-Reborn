name: 버그 제보
description: 리프레셔 버그를 제보하세요
title: "[BUG] "
labels: bug
assignees: green1052
body:

- type: markdown
  attributes:
  value: |
  제보 전에 [기존 이슈](https://github.com/green1052/DCRefresher-Reborn/issues?q=is%3Aissue)에서
  동일한 문제가 이미 보고되었는지 확인해주세요.

    - type: textarea
      id: description
      attributes:
      label: 버그 설명
      description: 발생한 버그에 대해 명확하고 간결하게 설명해주세요.
      placeholder: "예: 글 목록 자동 새로고침이 작동하지 않습니다."
      validations:
      required: true

    - type: textarea
      id: steps
      attributes:
      label: 재현 방법
      description: 버그를 재현하는 단계를 작성해주세요.
      placeholder: |
      1. ...
      2. ...
      3. ...
      validations:
      required: true

    - type: textarea
      id: expected
      attributes:
      label: 예상 동작
      description: 어떤 결과를 예상했는지 설명해주세요.
      validations:
      required: true

    - type: textarea
      id: actual
      attributes:
      label: 실제 동작
      description: 실제로 어떤 일이 일어났는지 설명해주세요.
      validations:
      required: true

    - type: dropdown
      id: module
      attributes:
      label: 문제가 발생한 모듈
      options:
      - 모름 / 전체
      - 미리보기
      - 컨텐츠 차단
      - 관리
      - 기타
      validations:
      required: true

    - type: textarea
      id: screenshots
      attributes:
      label: 스크린샷
      description: 가능하다면 스크린샷을 붙여넣어주세요. (클립보드 이미지 직접 붙여넣기 가능)
      validations:
      required: false

    - type: input
      id: url
      attributes:
      label: 재현 가능한 주소
      description: 해당되는 경우 문제가 발생한 갤러리/게시글 주소를 작성해주세요.
      placeholder: "https://gall.dcinside.com/..."
      validations:
      required: false

    - type: input
      id: version
      attributes:
      label: 리프레셔 버전
      description: 팝업 하단 또는 브라우저 확장 프로그램 페이지에서 확인할 수 있습니다.
      placeholder: "예: 5.1.7"
      validations:
      required: true

    - type: dropdown
      id: os
      attributes:
      label: OS
      options:
      - Windows
      - macOS
      - Linux
      - 기타
      validations:
      required: true

    - type: dropdown
      id: browser
      attributes:
      label: 브라우저
      options:
      - Chrome
      - Edge
      - Whale
      - Firefox
      - 기타
      validations:
      required: true

    - type: textarea
      id: logs
      attributes:
      label: 콘솔 로그
      description: |
      브라우저 개발자 도구(F12) > Console 탭의 에러 메시지를 붙여넣어주세요.
      콘텐츠 스크립트 로그는 디시인사이드 페이지에서 확인해주세요.
      render: shell
      validations:
      required: false

    - type: textarea
      id: additional
      attributes:
      label: 추가 정보
      description: 버그와 관련된 추가 정보가 있다면 작성해주세요.
      validations:
      required: false

    - type: checkboxes
      id: checklist
      attributes:
      label: 확인사항
      options:
      - label: 최신 버전을 사용하고 있습니다.
      required: true
      - label: 동일한 문제가 보고되지 않았습니다.
      required: true
      - label: 브라우저 콘솔에서 에러 메시지를 확인했습니다.
      required: false
