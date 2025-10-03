<template>
    <div
        class="refresher-preview-button"
        @click="safeClick"
    >
        <transition v-if="id" name="refresher-shake">
            <img
                :key="error"
                :src="getURL(`/assets/${id}.webp`)"
            />
        </transition>
        <transition v-if="text" name="refresher-shake">
            <p
                :id="`refresher-${id}-counts`"
                :key="error + 1"
                class="refresher-vote-text"
            >
                {{ text }}
            </p>
        </transition>
    </div>
</template>

<script lang="ts" setup>
import {ref} from "vue";

import getURL from "../utils/getURL";

interface Props {
    id?: string | number;
    text?: string;
    click?: () => Promise<boolean>;
}

const props = withDefaults(defineProps<Props>(), {
    id: "",
    text: "",
    click: undefined
});

const error = ref(0);

const safeClick = async (): Promise<boolean> => {
    if (props.click) {
        const result = await props.click();

        if (!result) {
            error.value = Math.random();
        }

        return result || false;
    }

    return false;
};
</script>

<style lang="scss">
$shadow-0dp: none;
$shadow-1dp: 0px 0px 16px rgba(0, 0, 0, 0.08);
$shadow-2dp: 0px 0px 16px rgba(0, 0, 0, 0.12);
$shadow-3dp: 0px 0px 16px rgba(0, 0, 0, 0.24);

.refresher-preview-button {
    background-color: transparent;
    border-radius: 15px;
    display: flex;
    margin-right: 15px;

    transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);
    user-select: none;



    &.primary {
        backdrop-filter: blur(10px) saturate(180%);
        background-color: rgba(0, 110, 255, 0.8);

        p {
            color: rgba(255, 255, 255, 0.87);
            filter: saturate(130%);
            font-weight: 500;
        }

        * {
            filter: invert(1);
        }
    }

    &.sub {
        backdrop-filter: blur(10px) saturate(180%);
        background-color: rgba(106, 122, 143, 0.8);

        p {
            color: rgba(255, 255, 255, 0.87);
            filter: saturate(130%);
            font-weight: 500;
        }

        * {
            filter: invert(1);
        }
    }

    &.refresher-writecomment img {
        background-color: transparent !important;
    }

    &:hover {
        backdrop-filter: blur(10px) saturate(200%);
        background-color: rgba(0, 110, 255, 0.7);

        box-shadow: $shadow-2dp;

        cursor: pointer;

        *:not(img) {
            filter: invert(1);
        }
    }

    &:active {
        backdrop-filter: blur(10px) saturate(220%);
        background-color: rgba(0, 110, 255, 0.6);
        box-shadow: $shadow-1dp;

        * {
            filter: invert(1);
        }
    }

    &:has(> p) {
        height: 38px;
        width: 120px;

        img {
            margin: auto 0 auto auto;
        }
    }

    img {
        height: 30px;
        margin-top: 5px;
        width: 30px;
    }

    p {
        color: #000;
        font-size: 16px;
        font-weight: lighter;

        letter-spacing: -1px;
        margin: auto auto auto 0;
    }
}

// Dark mode support
html:has(#css-darkmode) {
    .refresher-preview-button {
        box-shadow: none;

        &.primary {
            background-color: rgba(0, 110, 255, 0.32);

            &:hover {
                background-color: rgba(0, 110, 255, 0.28);
            }

            &:active {
                background-color: rgba(0, 110, 255, 0.22);
            }
        }

        &:hover {
            background-color: rgba(255, 255, 255, 0.08);
            box-shadow: none;
            color: white;

            p {
                filter: invert(0);
            }
        }

        &:active {
            background-color: rgba(255, 255, 255, 0.12);
            box-shadow: none;

            p {
                filter: invert(0);
            }
        }

        p {
            color: #ccc;
        }

        img {
            filter: invert(1);
        }
    }
}
</style>