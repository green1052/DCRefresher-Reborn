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

<style lang="scss" scoped>
.refresher-scroll {
    background: linear-gradient(to top, rgba(12, 23, 53, 0.7), rgba(32, 42, 72, 0.3), rgba(0, 0, 0, 0));
    bottom: 0;
    color: white;
    display: flex;
    height: 40%;
    justify-content: center;
    left: 0;
    pointer-events: none;
    position: fixed;
    width: 100%;

    .center {
        margin: auto;
        position: relative;
        top: 20%;

        p {
            font-size: 24px;
            font-weight: bold;
            letter-spacing: -1.66px;
        }
    }

    &.top {
        background: linear-gradient(to bottom, rgba(12, 23, 53, 0.7), rgba(32, 42, 72, 0.3), rgba(0, 0, 0, 0));
        bottom: unset;
        top: 0;

        .center {
            bottom: 20%;
            top: unset;
        }
    }
}
</style>