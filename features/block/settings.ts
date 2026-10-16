/** meta.ts와 background.ts가 같이 쓰는 설정. 배경 번들에 들어가므로 UI(Preact·lucide 아이콘)를 불러오지 않는다. */
import type {SettingGroup, SettingsSchema} from "@/core/module/types";

const BLUR_GROUP: SettingGroup = {name: "흐리게 처리", desc: "차단된 내용을 숨기지 않고 흐리게 처리합니다."};

const SIMILAR_GROUP: SettingGroup = {
    name: "비슷한 이미지",
    desc: "차단한 이미지·움짤과 비슷한 것(크기·화질을 바꾸거나 좌우로 뒤집은 것, gif와 그걸 바꾼 움짤)도 가립니다. 이미지마다 계산이 더 듭니다."
};

const DUPLICATE_GROUP: SettingGroup = {name: "같은 댓글 접기", desc: "같은 내용의 댓글이 여러 번 달리면 첫 댓글만 남기고 접습니다. 미리보기에도 적용됩니다."};

export const BLOCK_SETTINGS = {
    replyRemove: {
        type: "check",
        name: "대댓글도 가리기",
        desc: "차단된 댓글의 대댓글도 함께 가립니다.",
        default: false
    },
    blur: {
        type: "check",
        group: BLUR_GROUP,
        name: "사용",
        desc: "차단된 내용을 흐리게 처리합니다.",
        default: false
    },
    blurReveal: {
        type: "check",
        group: BLUR_GROUP,
        name: "마우스를 올리면 보기",
        desc: "흐리게 처리된 내용에 마우스를 올린 동안 원래대로 보여 줍니다.",
        default: true
    },
    blurStrength: {
        type: "range",
        group: BLUR_GROUP,
        name: "강도",
        desc: "차단된 내용을 흐리게 하는 정도입니다.",
        default: 5,
        min: 1,
        max: 20,
        step: 1,
        unit: "px"
    },
    similarImages: {
        type: "check",
        group: SIMILAR_GROUP,
        name: "사용",
        desc: "차단한 이미지와 비슷한 이미지도 가립니다.",
        default: false
    },
    similarThreshold: {
        type: "range",
        group: SIMILAR_GROUP,
        name: "허용 차이",
        desc: "두 지문(각 64비트)이 다를 수 있는 비트 수입니다. 클수록 더 많이 바뀐 이미지까지 가리지만, 다른 이미지를 잘못 가릴 수 있습니다.",
        default: 12,
        min: 4,
        max: 16,
        step: 1,
        unit: "비트"
    },
    foldDuplicate: {
        type: "check",
        group: DUPLICATE_GROUP,
        name: "사용",
        desc: "같은 댓글을 한 줄로 접습니다.",
        default: false
    },
    duplicateCount: {
        type: "range",
        group: DUPLICATE_GROUP,
        name: "반복 횟수",
        desc: "이만큼 반복되면 접습니다.",
        default: 3,
        min: 2,
        max: 10,
        step: 1,
        unit: "번"
    },
    duplicateMinLength: {
        type: "range",
        group: DUPLICATE_GROUP,
        name: "최소 글자 수",
        desc: "이보다 짧은 댓글(ㅋㅋ 등)은 반복돼도 접지 않습니다.",
        default: 5,
        min: 1,
        max: 50,
        step: 1,
        unit: "자"
    }
} satisfies SettingsSchema;
