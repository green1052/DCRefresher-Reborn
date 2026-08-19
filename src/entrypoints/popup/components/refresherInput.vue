<template>
    <div class="refresher-input">
        <input
            :disabled="disabled"
            :placeholder="placeholder"
            :value="value"
            type="text"
            @change="handleChange"
            @input="handleInput"
        />
    </div>
</template>

<script lang="ts" setup>
interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
    value: "",
    disabled: false
});

const emit = defineEmits<{
    "update:value": [value: string];
    change: [value: string];
}>();

const handleInput = (ev: Event) => {
    const target = ev.target as HTMLInputElement;
    emit("update:value", target.value);
};

const handleChange = (ev: Event) => {
    const target = ev.target as HTMLInputElement;
    emit("change", target.value);
};
</script>

<style lang="scss" scoped>
@use "@/assets/styles/tokens" as *;

.refresher-input {
    align-items: center;
    display: flex;

    input {
        background-color: var(--refresher-field-bg);
        border: 1px solid var(--refresher-field-border);
        border-radius: 9px;
        color: var(--refresher-field-text);
        font-size: 15px;
        min-width: 150px;
        padding: 4px 16px;
        transition: all 0.25s $ease-out-expo;

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

        &::placeholder {
            color: var(--refresher-field-disabled-text);
        }
    }
}
</style>