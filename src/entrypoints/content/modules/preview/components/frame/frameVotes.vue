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
                v-if="!disabledDownvote"
                id="downvote"
                :click="downvote"
                :text="downvotes ?? 'X'"
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

import PreviewButton from "@/components/previewButton.vue";

interface Props {
    upvotes?: string;
    fixedUpvotes?: string;
    downvotes?: string;
    disabledDownvote?: boolean;
    upvote: () => Promise<boolean>;
    downvote: () => Promise<boolean>;
    share: () => Promise<boolean>;
    original: () => Promise<boolean>;
}

const props = defineProps<Props>();

const upvoteText = computed(() => {
    const base = props.upvotes ?? "X";
    return props.fixedUpvotes === undefined ? base : `${base} (${props.fixedUpvotes})`;
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