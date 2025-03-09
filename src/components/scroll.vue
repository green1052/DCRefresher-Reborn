<template>
    <div :class="{ top: side === 'top' }" class="refresher-scroll">
        <div class="center">
            <p>
                한번 더 스크롤 하면
                {{ side === "top" ? "이전" : "다음" }} 게시글을 봅니다.
            </p>
        </div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
    name: "refresher-scroll",
    props: {
        side: {
            type: String,
            required: true
        }
    }
});
</script>
