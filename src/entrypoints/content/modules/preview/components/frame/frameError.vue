<template>
    <div class="refresher-preview-contents refresher-error">
        <h3>{{ error?.title || "알 수 없는 오류" }}</h3>
        <br/>
        <br/>
        <br/>
        <p>가능한 경우:</p>

        <ul v-if="!error?.detail">
            <li>알 수 없는 오류가 발생했습니다.</li>
        </ul>
        <ul v-else-if="error.detail.includes('Failed to fetch')">
            <li>연결 오류, 서버 오류일 가능성도 있습니다.</li>
            <li>브라우저 오류, 대부분 구현 오류로 확장 프로그램 업데이트가 필요합니다.</li>
            <li>서버 구조 변경으로 인한 잘못된 방식으로 요청. 지속될 경우 개발자에게 문의하세요.</li>
        </ul>
        <ul v-else-if="error.detail.includes('40')">
            <li>게시글이 이미 삭제됨</li>
            <li>게시글이 없음</li>
            <li>서버 구조 변경으로 인한 잘못된 값으로 요청. 지속될 경우 개발자에게 문의하세요.</li>
        </ul>
        <ul v-else-if="error.detail.includes('50')">
            <li>서버가 불안정합니다. 페이지를 다시 고쳐보세요.</li>
            <li>서버 구조 변경으로 인한 내용 해석 실패. 지속될 경우 개발자에게 문의하세요.</li>
            <li>네트워크 방화벽에 의해 차단되지는 않았는지 확인해보세요.</li>
        </ul>
        <ul v-else>
            <li>알 수 없는 오류입니다. 아래 코드를 복사하여 개발자에게 문의해주세요.</li>
        </ul>
        <br/>
        <span class="refresher-mute">{{ error?.detail }}</span>
        <br/>
        <br/>
        <PreviewButton
            id="refresh"
            :click="retry"
            class="refresher-writecomment"
        />
    </div>
</template>

<script lang="ts" setup>
import PreviewButton from "@/components/previewButton.vue";

interface Props {
    error?: { title: string; detail: string };
    retry: () => Promise<boolean>;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
.refresher-error {
    h3 {
        font-size: 24px;
        font-weight: bold;
        letter-spacing: -1.66px;
    }

    p {
        font-weight: 400;
    }

    .refresher-mute {
        font-size: 12px;
        opacity: 0.6;
        text-transform: uppercase;
    }

    ul {
        font-weight: 300;
        margin-left: 15px;

        li:before {
            content: ">";
            margin-right: 5px;
        }
    }
}
</style>