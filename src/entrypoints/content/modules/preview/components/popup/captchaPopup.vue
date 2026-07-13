<script lang="ts" setup>
import {onMounted, ref} from "vue";

defineProps<{ src: string }>();

const emit = defineEmits<{
  submit: [captcha: string];
  close: [];
}>();

const input = ref("");

const submit = (): void => {
  if (!input.value) return;
  emit("submit", input.value);
};

onMounted(() => {
  setTimeout(() => {
    const el = document.querySelector<HTMLInputElement>(".refresher-captcha-popup input");
    el?.focus();
  }, 0);
});
</script>

<template>
  <div class="refresher-captcha-popup">
    <p>코드 입력</p>
    <div class="close" @click="emit('close')">
      <div class="cross"></div>
      <div class="cross"></div>
    </div>
    <img :src="src"/>
    <input v-model="input" type="text" @keydown.enter="submit"/>
    <button class="refresher-preview-button primary" @click="submit">
      <p class="refresher-vote-text">전송</p>
    </button>
  </div>
</template>