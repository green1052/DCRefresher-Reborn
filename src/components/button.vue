<template>
    <div class="refresher-preview-button" @click="safeClick">
        <transition name="refresher-shake">
            <img :key="error + 1" :src="getURL(`/assets/icons/${id}.webp`)" />
        </transition>
        <transition name="refresher-shake">
            <p :id="`refresher-${id}-counts`" :key="error" class="refresher-vote-text">
                {{ text }}
            </p>
        </transition>
    </div>
</template>

<script lang="ts">
import Vue, { PropType } from "vue";
import { getURL } from "../utils/getURL";

interface ButtonData {
    error: number;
}

export default Vue.extend({
    name: "refresher-preview-button",
    props: {
        id: {
            type: [String, Number]
        },
        text: {
            type: String
        },
        click: {
            type: Function as PropType<() => Promise<boolean>>,
            required: false
        }
    },
    data(): ButtonData {
        return {
            error: 0
        };
    },
    methods: {
        getURL,
        async safeClick(): Promise<boolean> {
            const result = await this.click?.();

            if (!result) {
                this.error = Math.random();
            }

            return result;
        }
    }
});
</script>
