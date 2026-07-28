<template>
    <div class="refresher-setting-category">
        <h3 @click="moveToModuleTab(moduleName)">
            {{ moduleName }} {{ !moduleEnabled ? "(비활성화)" : "" }}
            <ChevronRight :size="18"/>
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
import {ChevronRight} from "lucide-vue-next";
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