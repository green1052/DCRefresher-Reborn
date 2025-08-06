<template>
    <div
        class="refresher-preview-button"
        @click="safeClick"
    >
        <transition name="refresher-shake">
            <img
                :key="error"
                :src="getURL(`/assets/${id}.webp`)"
            />
        </transition>
        <transition name="refresher-shake">
            <p
                :id="`refresher-${id}-counts`"
                :key="error + 1"
                class="refresher-vote-text"
            >
                {{ text }}
            </p>
        </transition>
    </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";

import getURL from "../utils/getURL";

interface Props {
    id?: string | number;
    text?: string;
    click?: () => Promise<boolean>;
}

const props = withDefaults(defineProps<Props>(), {
    id: "",
    text: "",
    click: undefined
});

const error = ref(0);

const safeClick = async (): Promise<boolean> => {
    if (props.click) {
        const result = await props.click();

        if (!result) {
            error.value = Math.random();
        }

        return result || false;
    }

    return false;
};
</script>
