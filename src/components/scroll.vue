<template>
    <div
        :class="{ top: side === 'top' }"
        class="refresher-scroll"
    >
        <div class="center">
            <p>
                한번 더 스크롤 하면
                {{ side === "top" ? "이전" : "다음" }} 게시글을 봅니다.
            </p>
        </div>
    </div>
</template>

<script lang="ts" setup>
interface Props {
    side: "top" | "bottom";
}

defineProps<Props>();
</script>
