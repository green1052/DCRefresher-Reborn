<template>
    <div class="refresher-setting-category">
        <h3 @click="moveToModuleTab(moduleName)">
            {{ moduleName }} {{ !moduleEnabled ? "(비활성화)" : "" }}
            <svg
                fill="currentColor"
                height="18px"
                viewBox="0 0 24 24"
                width="18px"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
        </h3>

        <setting-item
            v-for="settingKey in filteredSettings"
            :key="`${moduleName}-${settingKey}`"
            :module-enabled="moduleEnabled"
            :module-name="moduleName"
            :setting="moduleSettings[settingKey]"
            :setting-key="settingKey"
        />
    </div>
</template>

<script lang="ts" setup>
import {computed, inject} from "vue";
import SettingItem from "./settingItem.vue";

interface Props {
    moduleName: string;
    moduleSettings: Record<string, RefresherSettings>;
    moduleEnabled: boolean;
}

const props = defineProps<Props>();

const moveToModuleTab = inject<(moduleName: string) => void>("moveToModuleTab")!;

const filteredSettings = computed(() => Object.keys(props.moduleSettings));
</script>