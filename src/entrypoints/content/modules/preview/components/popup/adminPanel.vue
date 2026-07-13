<script lang="ts" setup>
import {onMounted, onUnmounted, ref} from "vue";

import pinIcon from "@/assets/icons/pin.webp?no-inline";
import upvoteIcon from "@/assets/icons/upvote.webp?no-inline";
import downvoteIcon from "@/assets/icons/downvote.webp?no-inline";
import blockIcon from "@/assets/icons/block.webp?no-inline";
import deleteIcon from "@/assets/icons/delete.webp?no-inline";
import toast from "@/utils/toast";
import type {PreviewRequest} from "../../request";
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

const recommendImg = ref(upvoteIcon);
const recommendLabel = ref("개념글 등록");
const pinLabel = ref("공지로 등록");

const handleResponse = (response: unknown): void => {
  props.emitRefreshRequest();

  if (typeof response === "object" && response !== null) {
    const r = response as { msg: string; result: string };
    toast.show(r.msg, r.result === "success" ? "info" : "error");
    return;
  }

  toast.show(String(response), "error");
};

const pin = (): void => {
  props.request.setNotice(props.preData, setAsNotice.value).then((response) => {
    props.emitRefreshRequest();

    if (typeof response === "object" && response !== null) {
      const r = response as { msg: string; result: string };
      if (r.result === "success") {
        toast.show(r.msg);
        setAsNotice.value = !setAsNotice.value;
        pinLabel.value = setAsNotice.value ? "공지로 등록" : "공지 등록 해제";
      } else {
        toast.show(r.msg, "error");
      }
      return;
    }

    toast.show(String(response), "error");
  });
};

const recommend = (): void => {
  props.request.setRecommend(props.preData, setAsRecommend.value).then((response) => {
    props.emitRefreshRequest();

    if (typeof response === "object" && response !== null) {
      const r = response as { msg: string; result: string };
      if (r.result === "success") {
        toast.show(r.msg);
        setAsRecommend.value = !setAsRecommend.value;
        recommendImg.value = setAsRecommend.value ? upvoteIcon : downvoteIcon;
        recommendLabel.value = setAsRecommend.value ? "개념글 등록" : "개념글 해제";
      } else {
        toast.show(r.msg, "error");
      }
      return;
    }

    toast.show(String(response), "error");
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

const KEY_COUNTS: Record<string, [number, number]> = {};

const onKeyPress = (ev: KeyboardEvent): void => {
  if (ev.code !== "KeyB" && ev.code !== "KeyD") return;

  if (!KEY_COUNTS[ev.code]) KEY_COUNTS[ev.code] = [Date.now(), 0];
  if (Date.now() - KEY_COUNTS[ev.code][0] > 1000) KEY_COUNTS[ev.code] = [Date.now(), 0];

  KEY_COUNTS[ev.code][0] = Date.now();
  KEY_COUNTS[ev.code][1]++;

  if (ev.code === "KeyD") {
    if (KEY_COUNTS[ev.code][1] >= 2) {
      doDelete();
      KEY_COUNTS[ev.code][1] = 0;
    } else {
      toast.show("한번 더 D키를 누르면 게시글을 삭제합니다.", "warning", 1000);
    }
  } else if (ev.code === "KeyB") {
    if (KEY_COUNTS[ev.code][1] >= 2) {
      doBlockWithPreset();
      KEY_COUNTS[ev.code][1] = 0;
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
      <img :src="pinIcon"/>
      <p>{{ pinLabel }}</p>
    </div>
    <div class="button recommend" @click="recommend">
      <img :src="recommendImg"/>
      <p>{{ recommendLabel }}</p>
    </div>
    <div class="button block" @click="emit('openBlock')">
      <img :src="blockIcon"/>
      <p>차단 (B)</p>
    </div>
    <div class="button delete" @click="doDelete">
      <img :src="deleteIcon"/>
      <p>삭제 (D)</p>
    </div>
    <div class="button bump" @click="bump">
      <img :src="upvoteIcon"/>
      <p>끌올</p>
    </div>
  </div>
</template>