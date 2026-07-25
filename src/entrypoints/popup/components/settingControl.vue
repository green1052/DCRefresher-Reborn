<template>
    <div class="control">
        <refresher-checkbox
            v-if="setting.type === 'check'"
            v-model="setting.value"
            :disabled="!moduleEnabled"
            @change="onCheckChange"
        />
        <refresher-input
            v-else-if="setting.type === 'text'"
            :disabled="!moduleEnabled"
            :placeholder="setting.default"
            :value="setting.value"
            @change="onTextChange"
        />
        <refresher-range
            v-else-if="setting.type === 'range'"
            v-model="rangeValue"
            :disabled="!moduleEnabled"
            :max="setting.max"
            :min="setting.min"
            :placeholder="String(setting.default)"
            :step="setting.step"
            :unit="setting.unit"
            @change="onRangeChange"
        />
        <refresher-options
            v-else-if="setting.type === 'option'"
            :disabled="!moduleEnabled"
            :options="setting.items as Record<string, string>"
            :value="setting.value"
            @change="onOptionChange"
        />
    </div>
</template>

<script lang="ts" setup>
import {computed, inject} from "vue";
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

const rangeValue = computed({
    get: () => Number(props.setting.value),
    set: () => {}
});

const onCheckChange = (value: boolean) => {
    updateUserSetting(props.moduleName, props.settingKey, value);
};

const onTextChange = (value: string) => {
    updateUserSetting(props.moduleName, props.settingKey, value);
};

const onRangeChange = (value: number) => {
    updateUserSetting(props.moduleName, props.settingKey, value);
};

const onOptionChange = (value: string) => {
    updateUserSetting(props.moduleName, props.settingKey, value);
};
</script>