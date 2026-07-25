<template>
    <div
        v-if="visible"
        class="block-dialog-backdrop"
        @click="$emit('close')"
    >
        <div
            class="block-dialog-content"
            @click.stop
        >
            <h3 class="head">{{ blockKeyNames[currentBlockType] }} 차단 추가</h3>

            <div class="memo-row">
                <p>{{ blockKeyNames[currentBlockType] }}</p>
                <refresher-input
                    v-model:value="formData.content"
                    :placeholder="`${blockKeyNames[currentBlockType]} 값을 입력하세요`"
                    @keyup.enter="$emit('confirm')"
                />
            </div>

            <div class="memo-row">
                <p>정규식 사용</p>
                <refresher-checkbox
                    v-model="formData.isRegex"
                />
            </div>

            <div class="memo-row">
                <p>특정 갤러리 차단 (선택)</p>
                <refresher-input
                    v-model:value="formData.gallery"
                    placeholder="갤러리 ID"
                />
            </div>

            <div class="memo-row">
                <p>차단 모드</p>
                <refresher-options
                    v-model:value="formData.mode"
                    :options="{ NONE: '기본값', ...blockDetectModeTypeNames }"
                />
            </div>

            <div class="button-wrap">
                <div @click="$emit('confirm')">
                    <p>추가</p>
                </div>
                <div @click="$emit('close')">
                    <p>취소</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type {RefresherBlockDetectMode} from "@/@types/block";
import RefresherInput from "./refresherInput.vue";
import RefresherCheckbox from "./checkbox.vue";
import RefresherOptions from "./options.vue";

interface BlockFormData {
    content: string;
    isRegex: boolean;
    gallery: string;
    mode: RefresherBlockDetectMode | "NONE";
}

const props = defineProps<{
    visible: boolean;
    currentBlockType: string;
    blockKeyNames: Record<string, string>;
    blockDetectModeTypeNames: Record<string, string>;
    formData: BlockFormData;
}>();

defineEmits<{
    confirm: [];
    close: [];
}>();
</script>