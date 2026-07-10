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

import type {PreviewFrame} from "../core/PreviewFrame";
import PreviewButton from "./previewButton.vue";

interface Props {
  frame: PreviewFrame;
  upvote: () => Promise<boolean>;
  downvote: () => Promise<boolean>;
  share: () => Promise<boolean>;
  original: () => Promise<boolean>;
}

const props = defineProps<Props>();

const upvoteText = computed(() =>
    props.frame.upvotes === undefined && props.frame.fixedUpvotes === undefined
        ? "X"
        : `${props.frame.upvotes} (${props.frame.fixedUpvotes})`
);
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