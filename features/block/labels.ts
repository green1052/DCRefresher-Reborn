import type {LabelsOf, SettingGroup} from "@/core/module/types";

import type meta from "./meta";

const BLUR_GROUP: SettingGroup = {name: "흐리게 처리", desc: "차단된 내용을 숨기지 않고 흐리게 처리합니다."};

const SIMILAR_GROUP: SettingGroup = {
    name: "비슷한 이미지",
    desc: "차단한 이미지·움짤과 같은 그림이면 크기·화질을 바꿨거나 좌우로 뒤집었거나 gif를 움짤로 바꿨어도 가립니다. 허용 차이는 얼마나 달라도 같은 그림으로 볼지입니다. 높일수록 많이 바뀐 이미지도 가리지만 상관없는 이미지를 잘못 가릴 수 있습니다. 켜면 이미지마다 계산이 조금 더 듭니다."
};

const DUPLICATE_GROUP: SettingGroup = {name: "같은 댓글 접기", desc: "같은 내용의 댓글이 여러 번 달리면 첫 댓글만 남기고 접습니다. 미리보기에도 적용됩니다."};

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "콘텐츠 차단",
    description: "보고 싶지 않은 유저·글·댓글을 숨기거나 흐리게 합니다.",
    settings: {
        replyRemove: {name: "대댓글도 가리기", desc: "차단된 댓글의 대댓글도 함께 가립니다."},
        blur: {group: BLUR_GROUP, name: "사용", desc: "차단된 내용을 흐리게 처리합니다."},
        blurReveal: {group: BLUR_GROUP, name: "마우스를 올리면 보기", desc: "흐리게 처리된 내용에 마우스를 올린 동안 원래대로 보여 줍니다."},
        blurStrength: {group: BLUR_GROUP, name: "강도", desc: "차단된 내용을 흐리게 하는 정도입니다."},
        similarImages: {group: SIMILAR_GROUP, name: "사용", desc: "차단한 이미지와 비슷한 이미지도 가립니다."},
        similarThreshold: {
            group: SIMILAR_GROUP,
            name: "허용 차이",
            desc: "이미지를 64칸짜리 지문으로 줄여 비교해 서로 다른 칸이 이 수 이하면 같은 그림으로 봅니다. 높일수록 많이 바뀐 이미지도 가리지만 상관없는 이미지를 잘못 가릴 수 있습니다."
        },
        foldDuplicate: {group: DUPLICATE_GROUP, name: "사용", desc: "같은 댓글을 한 줄로 접습니다."},
        duplicateCount: {group: DUPLICATE_GROUP, name: "반복 횟수", desc: "이만큼 반복되면 접습니다."},
        duplicateMinLength: {group: DUPLICATE_GROUP, name: "최소 글자 수", desc: "이보다 짧은 댓글(ㅋㅋ 등)은 반복돼도 접지 않습니다."}
    },
    toggles: {reveal: "가린 내용 보기"},
    commands: {blockReveal: "이 페이지에서 가린 내용 보기"}
} satisfies LabelsOf<typeof meta>;
