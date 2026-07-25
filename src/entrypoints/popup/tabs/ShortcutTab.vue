<template>
    <div class="tab tab5">
        <div class="shortcut-lists">
            <template
                v-for="shortcut in shortcuts"
                :key="shortcut.name"
            >
                <div
                    v-if="shortcut.description?.length"
                    class="refresher-shortcut"
                >
                    <p class="description">{{ shortcut.description }}</p>
                    <div class="key">
                        <refresher-bubble :text="shortcut.shortcut || '없음'"/>
                    </div>
                </div>
            </template>
        </div>
        <p class="shortcut-settings-link"><a @click="openShortcutSettings">단축키 설정</a></p>
    </div>
</template>

<script lang="ts" setup>
import type {Browser} from "#imports";
import {onMounted, ref} from "vue";
import RefresherBubble from "../components/bubble.vue";

const shortcuts = ref<Browser.commands.Command[]>([]);

const openShortcutSettings = () => {
    browser.tabs.create({
        url: (import.meta.env.FIREFOX as boolean) ? "about:addons" : "chrome://extensions/shortcuts"
    });
};

onMounted(async () => {
    shortcuts.value = await browser.commands.getAll();
});
</script>