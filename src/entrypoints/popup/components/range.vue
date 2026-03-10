<template>
    <div class="refresher-range">
        <input
            v-model="currentValue"
            :data-id="id"
            :data-module="modname"
            :disabled="disabled"
            :max="max"
            :min="min"
            :placeholder="placeholder"
            :step="step"
            type="range"
            @change="handleChange"
        />
        <span class="indicator">{{ displayValue }}</span>
    </div>
</template>

<script lang="ts" setup>
import {computed, ref} from "vue";

interface Props {
    change?: (module: string | undefined, id: string | undefined, value: number) => void;
    placeholder?: string;
    modname?: string;
    id?: string;
    value?: number;
    max?: number;
    min?: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    value: 0,
    min: 0,
    max: 100,
    step: 1,
    unit: "",
    disabled: false
});

const currentValue = ref(props.value);

const displayValue = computed(() => `${currentValue.value}${props.unit}`);

const handleChange = () => {
    props.change?.(props.modname, props.id, Number(currentValue.value));
};
</script>

<style lang="scss" scoped>
.refresher-range {
    align-items: center;
    display: flex;
    gap: 10px;

    input {
        -webkit-appearance: none;
        appearance: none;
        background: #ddd;
        border-radius: 3px;
        flex: 1;
        height: 6px;
        outline: none;
        transition: background 0.25s cubic-bezier(0.19, 1, 0.22, 1);

        &::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            background: #4caf50;
            border-radius: 50%;
            cursor: pointer;
            height: 18px;
            transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);
            width: 18px;

            &:hover {
                box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.2);
                transform: scale(1.1);
            }
        }

        &::-moz-range-thumb {
            background: #4caf50;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            height: 18px;
            transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);
            width: 18px;

            &:hover {
                box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.2);
                transform: scale(1.1);
            }
        }

        &:disabled {
            cursor: not-allowed;
            opacity: 0.5;

            &::-webkit-slider-thumb {
                cursor: not-allowed;

                &:hover {
                    box-shadow: none;
                    transform: none;
                }
            }

            &::-moz-range-thumb {
                cursor: not-allowed;

                &:hover {
                    box-shadow: none;
                    transform: none;
                }
            }
        }
    }

    .indicator {
        color: #a0a0a0;
        font-size: 12px;
        font-weight: 500;
        min-width: 40px;
        text-align: right;
    }
}

@media (prefers-color-scheme: dark) {
    .refresher-range {
        input {
            background: #555;

            &::-webkit-slider-thumb {
                background: #66bb6a;

                &:hover {
                    box-shadow: 0 0 0 4px rgba(102, 187, 106, 0.2);
                }
            }

            &::-moz-range-thumb {
                background: #66bb6a;

                &:hover {
                    box-shadow: 0 0 0 4px rgba(102, 187, 106, 0.2);
                }
            }
        }

        .indicator {
            color: #ccc;
        }
    }
}
</style>