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

<style lang="scss">
@use "@/assets/styles/variables" as *;
@use "@/assets/styles/components/popup" as *;

.refresher-captcha-popup {
    @include popup-shell;

    height: 150px;
    left: calc(50% - 160px);
    top: calc(50% - 75px);
    width: 320px;

    & > p {
        font-size: 18px;
        font-weight: bold;
    }

    input {
        border: 1px solid #777;
        border-radius: $radius-md;
        height: 30px;
        outline: none;
        text-decoration: none;
        transition: all $duration-normal $ease-out-expo;
        width: 100%;

        &:focus,
        &:hover {
            box-shadow: inset 0 0 4px rgba(60, 71, 144, 0.5);
        }
    }

    .refresher-preview-button {
        bottom: 5%;
        position: absolute;
        right: 0;
    }

    .refresher-vote-text {
        margin: auto;
    }
}

html:has(#css-darkmode) .refresher-captcha-popup {
    border: 1px solid var(--refresher-border);
    color: white;
}
</style>