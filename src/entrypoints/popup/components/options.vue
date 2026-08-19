<template>
    <select
        :disabled="disabled"
        :value="value"
        class="refresher-options"
        @change="handleChange"
    >
        <option
            v-for="(optionValue, key) in options"
            :key="key"
            :value="key"
        >
            {{ optionValue }}
        </option>
    </select>
</template>

<script lang="ts" setup>
interface Props {
    options?: Record<string, string>;
    value?: string;
    disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
    options: () => ({}),
    value: "",
    disabled: false
});

const emit = defineEmits<{
    "update:value": [value: string];
    change: [value: string];
}>();

const handleChange = (ev: Event) => {
    const target = ev.target as HTMLSelectElement;
    emit("update:value", target.value);
    emit("change", target.value);
};
</script>

<style lang="scss" scoped>
@use "@/assets/styles/tokens" as *;

.refresher-options {
    background-color: var(--refresher-field-bg);
    border: 1px solid var(--refresher-field-border);
    border-radius: 4px;
    color: var(--refresher-field-text);
    cursor: pointer;
    display: inline-block;
    font-size: 15px;
    height: 25px;
    overflow: hidden;
    position: relative;
    transition: all 0.25s $ease-out-expo;
    width: 150px;

    &:focus {
        border-color: var(--refresher-green);
        box-shadow: 0 0 0 2px var(--refresher-green-ring);
        outline: none;
    }

    &:disabled {
        background-color: var(--refresher-field-disabled-bg);
        color: var(--refresher-field-disabled-text);
        cursor: not-allowed;
    }

    option {
        background-color: var(--refresher-field-bg);
        color: var(--refresher-field-text);
        padding: 4px 8px;

        &:hover {
            background-color: var(--refresher-option-hover);
        }

        &:checked {
            background-color: var(--refresher-green);
            color: white;
        }
    }
}
</style>