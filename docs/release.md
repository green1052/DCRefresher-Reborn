# 릴리즈

## 절차

1. develop에서 `package.json`의 `version`을 올리고 `chore(release): X.Y.Z`로 커밋합니다.
2. release 브랜치에 develop을 머지 커밋(`Merge X.Y.Z into release`)으로 합치고 push합니다.

release에 push하면 `.github/workflows/release.yml`이 CI를 통과했는지 보고 develop 쪽 커밋에 `X.Y.Z` 태그를 달아 zip을 GitHub 릴리즈에 올리고 Chrome 웹 스토어, Firefox Add-ons에 제출합니다(릴리즈 노트를 위해 develop 쪽에 태그). 태그가 이미 있으면 아무것도 하지 않습니다. 한 스토어가 실패해도 나머지는 끝까지 제출하므로 로그에서 실패한 스토어만 zip으로 다시 제출합니다. 릴리즈는 [IP, 밴 DB](#ip밴-db)를 만들지 않습니다.

## IP, 밴 DB

`.github/workflows/db.yml`이 수, 토요일 예약과 수동 실행(Actions → DB → Run workflow)으로 `scripts/build-db.ts`를 돌려 `data` 브랜치에 올리고, Cloudflare Pages가 `dcrefresher.green1052.com`으로 배포하면 확장이 받습니다.

- 늘 release 브랜치로 만듭니다(배포된 코드와 형식이 같아야 해서). `ip.json`은 확장 저장 형식(`core/ipdb.ts`의 `CompactIpData`) 그대로이고 `ban.json`, `_headers`는 `data` 브랜치에서 손으로 관리합니다. `data` 브랜치는 커밋 하나로 유지하고 사이에 바뀌었으면 실패합니다. 6.0.3 이하는 `raw.githubusercontent.com`에서 받으므로 게시를 유지합니다.
- 확장은 `version` 파일과 저장 형식(`IP_FORMAT`)이 같으면 받지 않습니다(`core/database.ts`의 `updateDatabase`). "갱신"은 다시 받고 깨진 파일은 저장하지 않습니다.
- **`IP_FORMAT`을 바꾸면** 옛, 새 확션이 서로의 `ip.json`을 못 읽습니다. 바꾼 버전을 릴리즈했으면 DB 워크플로를 바로 수동으로 돌립니다. 형식은 꼭 필요할 때만 바꿉니다.
