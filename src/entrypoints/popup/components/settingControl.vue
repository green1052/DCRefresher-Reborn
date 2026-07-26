<template>
    <div class="control">
        <refresher-checkbox
            v-if="setting.type === 'check'"
            v-model="setting.value"
            :disabled="!moduleEnabled"
            @change="onChange"
        />
        <refresher-input
            v-else-if="setting.type === 'text'"
            :disabled="!moduleEnabled"
            :placeholder="setting.default"
            :value="setting.value"
            @change="onChange"
        />
        <refresher-range
            v-else-if="setting.type === 'range'"
            :model-value="Number(setting.value)"
            :disabled="!moduleEnabled"
            :max="setting.max"
            :min="setting.min"
            :placeholder="String(setting.default)"
            :step="setting.step"
            :unit="setting.unit"
            @change="onChange"
        />
        <refresher-options
            v-else-if="setting.type === 'option'"
            :disabled="!moduleEnabled"
            :options="setting.items as Record<string, string>"
            :value="setting.value"
            @change="onChange"
        />
    </div>
</template>

<script lang="ts" setup>
import {inject} from "vue";
import RefresherCheckbox from "./checkbox.vue";
import RefresherOptions from "./options.vue";
import RefresherRange from "./range.vue";
import RefresherInput from "./refresherInput.vue";

interface Props {
    setting: RefresherSettings;
    settingKey: string;
    moduleName: string;
    moduleEnabled: boolean;
}

const props = defineProps<Props>();

const updateUserSetting = inject<(module: string, key: string, value: unknown) => void>("updateUserSetting")!;

const onChange = (value: unknown) => {
    updateUserSetting(props.moduleName, props.settingKey, value);
};
</script>