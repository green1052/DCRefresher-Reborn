<template>
    <div class="refresher-range">
        <input
            :data-id="id"
            :data-module="modname"
            :disabled="disabled"
            :max="max"
            :min="min"
            :placeholder="placeholder"
            :step="step"
            :value="value"
            type="range"
            @change="handleChange"
            @input="handleInput"
        />
        <span
            ref="indicatorRef"
            class="indicator"
            >{{ displayValue }}</span
        >
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

interface Props {
    change?: (module: string | undefined, id: string | undefined, value: number) => void;
    placeholder?: number;
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

const indicatorRef = ref<HTMLElement>();
const currentValue = ref(props.value);

const displayValue = computed(() => `${currentValue.value}${props.unit}`);

const handleInput = async (ev: Event) => {
    const target = ev.target as HTMLInputElement;
    const value = Number(target.value);
    currentValue.value = value;

    await nextTick();
    if (indicatorRef.value) {
        indicatorRef.value.textContent = `${value}${props.unit}`;
    }
};

const handleChange = (ev: Event) => {
    const target = ev.target as HTMLInputElement;
    const value = Number(target.value);
    props.change?.(target.dataset.module, target.dataset.id, value);
};
</script>

<style lang="scss" scoped>
.refresher-range {
    display: flex;
    align-items: center;
    gap: 10px;

    input[type="range"] {
        flex: 1;
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        border-radius: 3px;
        background: #ddd;
        outline: none;
        transition: background 0.25s cubic-bezier(0.19, 1, 0.22, 1);

        &::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #4caf50;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);

            &:hover {
                transform: scale(1.1);
                box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.2);
            }
        }

        &::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #4caf50;
            cursor: pointer;
            border: none;
            transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);

            &:hover {
                transform: scale(1.1);
                box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.2);
            }
        }

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;

            &::-webkit-slider-thumb {
                cursor: not-allowed;
                
                &:hover {
                    transform: none;
                    box-shadow: none;
                }
            }

            &::-moz-range-thumb {
                cursor: not-allowed;
                
                &:hover {
                    transform: none;
                    box-shadow: none;
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
        input[type="range"] {
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
