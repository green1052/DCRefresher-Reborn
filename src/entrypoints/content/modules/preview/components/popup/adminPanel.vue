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

const pinUrl = browser.runtime.getURL(pinIcon as never);
const upvoteUrl = browser.runtime.getURL(upvoteIcon as never);
const downvoteUrl = browser.runtime.getURL(downvoteIcon as never);
const blockUrl = browser.runtime.getURL(blockIcon as never);
const deleteUrl = browser.runtime.getURL(deleteIcon as never);

const recommendImg = ref(upvoteUrl);
const recommendLabel = ref("개념글 등록");
const pinLabel = ref("공지로 등록");

// 응답 처리 통합 (핸들러 중복 제거)
const handleResponse = (response: unknown): void => {
  props.emitRefreshRequest();

  if (typeof response === "object" && response !== null) {
    const r = response as { msg: string; result: string };
    toast.show(r.msg, r.result === "success" ? "info" : "error");
    return;
  }

  toast.show(String(response), "error");
};

// 토글 응답 처리 (pin/recommend 공통 패턴)
const handleToggleResponse = (
  response: unknown,
  toggleRef: { value: boolean },
  updateLabel: () => void
): void => {
  props.emitRefreshRequest();

  if (typeof response === "object" && response !== null) {
    const r = response as { msg: string; result: string };
    if (r.result === "success") {
      toast.show(r.msg);
      toggleRef.value = !toggleRef.value;
      updateLabel();
    } else {
      toast.show(r.msg, "error");
    }
    return;
  }

  toast.show(String(response), "error");
};

const pin = (): void => {
  props.request.setNotice(props.preData, setAsNotice.value).then((response) => {
    handleToggleResponse(response, setAsNotice, () => {
      pinLabel.value = setAsNotice.value ? "공지로 등록" : "공지 등록 해제";
    });
  });
};

const recommend = (): void => {
  props.request.setRecommend(props.preData, setAsRecommend.value).then((response) => {
    handleToggleResponse(response, setAsRecommend, () => {
      recommendImg.value = setAsRecommend.value ? upvoteUrl : downvoteUrl;
      recommendLabel.value = setAsRecommend.value ? "개념글 등록" : "개념글 해제";
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

// 키 입력 카운트 (D=삭제, B=차단, 2회 연속)
const keyCounts = ref<Record<string, [number, number]>>({});

const onKeyPress = (ev: KeyboardEvent): void => {
  if (ev.code !== "KeyB" && ev.code !== "KeyD") return;

  if (!keyCounts.value[ev.code]) keyCounts.value[ev.code] = [Date.now(), 0];
  if (Date.now() - keyCounts.value[ev.code][0] > 1000) keyCounts.value[ev.code] = [Date.now(), 0];

  keyCounts.value[ev.code][0] = Date.now();
  keyCounts.value[ev.code][1]++;

  if (ev.code === "KeyD") {
    if (keyCounts.value[ev.code][1] >= 2) {
      doDelete();
      keyCounts.value[ev.code][1] = 0;
    } else {
      toast.show("한번 더 D키를 누르면 게시글을 삭제합니다.", "warning", 1000);
    }
  } else if (ev.code === "KeyB") {
    if (keyCounts.value[ev.code][1] >= 2) {
      doBlockWithPreset();
      keyCounts.value[ev.code][1] = 0;
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
      <img :src="pinUrl" alt="pin"/>
      <p>{{ pinLabel }}</p>
    </div>
    <div class="button recommend" @click="recommend">
      <img :src="recommendImg" alt="recommend"/>
      <p>{{ recommendLabel }}</p>
    </div>
    <div class="button block" @click="emit('openBlock')">
      <img :src="blockUrl" alt="block"/>
      <p>차단 (B)</p>
    </div>
    <div class="button delete" @click="doDelete">
      <img :src="deleteUrl" alt="delete"/>
      <p>삭제 (D)</p>
    </div>
    <div class="button bump" @click="bump">
      <img :src="upvoteUrl" alt="upvote"/>
      <p>끌올</p>
    </div>
  </div>
</template>