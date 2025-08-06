<template>
    <select
        :data-id="id"
        :data-module="modname"
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
    change?: (module: string | undefined, id: string | undefined, value: string) => void;
    modname?: string;
    options?: Record<string, string>;
    id?: string;
    value?: string;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    options: () => ({}),
    value: "",
    disabled: false
});

const emit = defineEmits<{
    "update:value": [value: string];
}>();

const handleChange = (ev: Event) => {
    const target = ev.target as HTMLSelectElement;
    emit("update:value", target.value);
    props.change?.(target.dataset.module, target.dataset.id, target.value);
};
</script>

<style lang="scss" scoped>
.refresher-options {
    position: relative;
    display: inline-block;
    width: 150px;
    height: 25px;
    font-size: 15px;
    border: 1px solid #ccc;
    border-radius: 4px;
    overflow: hidden;
    background-color: white;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);

    &:focus {
        outline: none;
        border-color: #4caf50;
        box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }

    &:disabled {
        background-color: #f5f5f5;
        color: #999;
        cursor: not-allowed;
    }

    option {
        padding: 4px 8px;
        background-color: white;
        color: black;

        &:hover {
            background-color: #f0f0f0;
        }

        &:selected {
            background-color: #4caf50;
            color: white;
        }
    }
}

@media (prefers-color-scheme: dark) {
    .refresher-options {
        background-color: #3b3b3b;
        border-color: rgb(90, 90, 90);
        color: white;

        &:focus {
            border-color: #66bb6a;
            box-shadow: 0 0 0 2px rgba(102, 187, 106, 0.2);
        }

        &:disabled {
            background-color: #2a2a2a;
            color: #666;
        }

        option {
            background-color: #3b3b3b;
            color: white;

            &:hover {
                background-color: #4a4a4a;
            }

            &:selected {
                background-color: #66bb6a;
            }
        }
    }
}
</style>
