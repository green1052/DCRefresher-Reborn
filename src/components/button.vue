<template>
    <div class="refresher-preview-button" v-on:click="safeClick">
        <transition name="refresher-shake">
            <img :key="error + 1" :src="getURL('/assets/icons/' + id + '.png')"></img>
        </transition>
        <transition name="refresher-shake">
            <p :id="'refresher-' + id + '-counts'" :key="error" class="refresher-vote-text">{{ text }}</p>
        </transition>
    </div>
</template>

<script lang="ts">
import browser from "webextension-polyfill";
import Vue from "vue";

interface ButtonProps {
    click: () => boolean;
    error: number;
}

interface ButtonData {
    error: number;
}

export default Vue.extend({
    name: "refresher-preview-button",
    props: {
        id: {type: [String, Number]},
        text: {
            type: String
        },
        click: {
            type: Function,
            required: false
        }
    },
    data(): ButtonData {
        return {
            error: 0
        };
    },
    methods: {
        getURL(u: string): string {
            return browser.extension ? browser.runtime.getURL(u) : u;
        },

        async safeClick(this: ButtonProps): Promise<unknown> {
            const result = this.click && (await this.click());

            if (!result) {
                this.error = Math.random();
            }

            return result;
        }
    }
});
</script>