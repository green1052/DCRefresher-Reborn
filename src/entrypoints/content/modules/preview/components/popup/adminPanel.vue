<script lang="ts" setup>
import {computed, onMounted, onUnmounted, ref, type Component} from "vue";

import {Pin, ChevronUp, ChevronDown, Ban, Trash2} from "lucide-vue-next";
import toast from "@/utils/toast";
import {handleManageResponse, type PreviewRequest} from "../../request";
import type {BlockPreset} from "../../panel";

const props = defineProps<{
    preData: GalleryPreData;
    toggleBlur: boolean;
    useKeyPress: boolean;
    request: PreviewRequest;
    blockPreset: BlockPreset;
    closeFrame: () => void;
    emitRefreshRequest: () => void;
}>();

const emit = defineEmits<{
    openBlock: [];
}>();

const setAsNotice = ref(!props.preData.notice);
const setAsRecommend = ref(!props.preData.recommend);

const pinComp: Component = Pin;
const upvoteComp: Component = ChevronUp;
const downvoteComp: Component = ChevronDown;
const blockComp: Component = Ban;
const deleteComp: Component = Trash2;

const pinLabel = computed(() => (setAsNotice.value ? "공지로 등록" : "공지 등록 해제"));
const recommendLabel = computed(() => (setAsRecommend.value ? "개념글 등록" : "개념글 해제"));
const recommendComp = computed(() => (setAsRecommend.value ? upvoteComp : downvoteComp));

// 성공 시 onSuccess 실행. pin/recommend는 토글 반전에 사용한다.
const handleResponse = (response: unknown, onSuccess?: () => void): void => {
    props.emitRefreshRequest();
    handleManageResponse(response, onSuccess);
};

const pin = (): void => {
    props.request.setNotice(props.preData, setAsNotice.value).then((response) => {
        handleResponse(response, () => {
            setAsNotice.value = !setAsNotice.value;
        });
    });
};

const recommend = (): void => {
    props.request.setRecommend(props.preData, setAsRecommend.value).then((response) => {
        handleResponse(response, () => {
            setAsRecommend.value = !setAsRecommend.value;
        });
    });
};

const doDelete = (): void => {
    props.closeFrame();
    props.request.delete(props.preData).then(handleResponse);
};

const doBlockWithPreset = (): void => {
    props.closeFrame();
    props.request
        .block(
            props.preData,
            Number(props.blockPreset.day),
            0,
            props.blockPreset.reason,
            props.blockPreset.delete ? 1 : 0,
            props.blockPreset.user_type ? 1 : 0
        )
        .then(handleResponse);
};

const bump = (): void => {
    props.request.bump(props.preData).then(handleResponse);
};

// 키 입력 카운트 (D=삭제, B=차단, 2회 연속). 템플릿에 안 쓰이므로 반응형 불필요.
const keyCounts: Record<string, [number, number]> = {};

const onKeyPress = (ev: KeyboardEvent): void => {
    if (ev.code !== "KeyB" && ev.code !== "KeyD") return;

    // 댓글 입력 등 타이핑 중 D/B 연타로 삭제/차단이 나가면 안 된다
    if ((ev.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) return;

    if (!keyCounts[ev.code] || Date.now() - keyCounts[ev.code][0] > 1000) {
        keyCounts[ev.code] = [Date.now(), 0];
    }

    keyCounts[ev.code][0] = Date.now();
    keyCounts[ev.code][1]++;

    const count = keyCounts[ev.code][1];

    if (ev.code === "KeyD") {
        if (count >= 2) {
            doDelete();
            keyCounts[ev.code][1] = 0;
        } else {
            toast.show("한번 더 D키를 누르면 게시글을 삭제합니다.", "warning", 1000);
        }
    } else {
        if (count >= 2) {
            doBlockWithPreset();
            keyCounts[ev.code][1] = 0;
        } else {
            toast.show("한번 더 B키를 누르면 차단합니다.", "warning", 1000);
        }
    }
};

onMounted(() => {
    if (props.useKeyPress) {
        document.addEventListener("keypress", onKeyPress);
    }
});

onUnmounted(() => {
    if (props.useKeyPress) {
        document.removeEventListener("keypress", onKeyPress);
    }
});
</script>

<template>
    <div id="refresher-management-panel" :class="{ blur: toggleBlur }" class="refresher-management-panel">
        <div class="button pin" @click="pin">
            <component :is="pinComp" class="refresher-mgmt-icon"/>
            <p>{{ pinLabel }}</p>
        </div>
        <div class="button recommend" @click="recommend">
            <component :is="recommendComp" class="refresher-mgmt-icon"/>
            <p>{{ recommendLabel }}</p>
        </div>
        <div class="button block" @click="emit('openBlock')">
            <component :is="blockComp" class="refresher-mgmt-icon"/>
            <p>차단 (B)</p>
        </div>
        <div class="button delete" @click="doDelete">
            <component :is="deleteComp" class="refresher-mgmt-icon"/>
            <p>삭제 (D)</p>
        </div>
        <div class="button bump" @click="bump">
            <component :is="upvoteComp" class="refresher-mgmt-icon"/>
            <p>끌올</p>
        </div>
    </div>
</template>

<style lang="scss">
@use "@/assets/styles/variables" as *;

.refresher-management-panel {
    background: rgba(255, 255, 255, 0.8);
    border-radius: 0 $radius-md $radius-md 0;
    display: grid;
    height: 60%;
    left: 0;
    position: fixed;
    top: 20%;
    transition: all $duration-normal $ease-out-expo;
    user-select: none;
    width: 100px;
    z-index: $z-overlay;

    &.blur {
        background-color: var(--refresher-bg-blur);
    }

    .button {
        border-radius: $radius-md;
        display: grid;
        height: 80px;
        margin: auto;
        transition: all $duration-normal $ease-out-expo;
        width: 80px;

        img {
            height: 60px;
            margin: auto;
            width: 60px;
        }

        .refresher-mgmt-icon {
            height: 48px;
            margin: auto;
            width: 48px;
        }

        p {
            color: var(--refresher-text);
            text-align: center;
        }

        &:hover {
            background: rgba(255, 255, 255, 1);
        }
    }

    .button.delete,
    .button.block {
        &:hover {
            .refresher-mgmt-icon,
            img {
                filter: invert(22%) sepia(85%) saturate(5841%) hue-rotate(355deg) brightness(92%) contrast(126%);
            }

            p {
                color: #f00;
            }
        }
    }
}

html:has(#css-darkmode) .refresher-management-panel {
    border: 1px solid var(--refresher-border);

    &.blur {
        backdrop-filter: blur(5px) saturate(150%);
        background-color: var(--refresher-bg-blur);
    }

    .button:hover {
        background: rgba(110, 110, 110, 0.5);
    }

    img {
        filter: invert(1);
    }

    .refresher-mgmt-icon {
        color: $dark-text-color-bright;
    }
}
</style>