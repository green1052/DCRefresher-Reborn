<template>
    <div class="refresher-preview-votes">
        <div>
            <PreviewButton
                id="upvote"
                :click="upvote"
                :text="upvoteText"
                class="refresher-upvote"
            />
            <PreviewButton
                v-if="!frame.data.disabledDownvote"
                id="downvote"
                :click="downvote"
                :text="frame.downvotes ?? 'X'"
                class="refresher-downvote"
            />
            <PreviewButton
                id="share"
                :click="share"
                class="refresher-share primary"
                text="공유"
            />
            <PreviewButton
                id="newtab"
                :click="original"
                text="원본 보기"
            />
        </div>
    </div>
</template>

<script lang="ts" setup>
import {computed} from "vue";

import type {PreviewFrame} from "../../frame";
import PreviewButton from "@/components/previewButton.vue";

interface Props {
    frame: PreviewFrame;
    upvote: () => Promise<boolean>;
    downvote: () => Promise<boolean>;
    share: () => Promise<boolean>;
    original: () => Promise<boolean>;
}

const props = defineProps<Props>();

const upvoteText = computed(() => {
    if (props.frame.upvotes === undefined) {
        return props.frame.fixedUpvotes === undefined ? "X" : `X (${props.frame.fixedUpvotes})`;
    }
    return props.frame.fixedUpvotes === undefined
        ? props.frame.upvotes
        : `${props.frame.upvotes} (${props.frame.fixedUpvotes})`;
});
</script>

<style lang="scss" scoped>
.refresher-preview-votes {
    display: flex;
    margin-top: 2.5vh;
    position: relative;

    & > div {
        display: flex;
        margin: auto;
    }
}
</style>