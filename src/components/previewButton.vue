<template>
    <div
        class="refresher-preview-button"
        @click="safeClick"
    >
        <transition v-if="iconComp" name="refresher-shake">
            <component
                :is="iconComp"
                :key="error"
                class="refresher-preview-icon"
            />
        </transition>
        <transition v-else-if="id === 'dccon'" name="refresher-shake">
            <img
                :key="error"
                :src="dcconSrc"
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
import {type Component, computed, ref} from "vue";

import {ChevronDown, ChevronUp, ExternalLink, PencilLine, RefreshCw, Share2} from "lucide-vue-next";
import dcconIcon from "@/assets/icons/dccon.webp?no-inline";

interface Props {
    id?: string | number;
    text?: string;
    click?: () => boolean | Promise<boolean>;
}

const props = withDefaults(defineProps<Props>(), {
    id: "",
    text: "",
    click: undefined
});

const error = ref(0);

const iconMap: Record<string, Component> = {
    upvote: ChevronUp,
    downvote: ChevronDown,
    share: Share2,
    newtab: ExternalLink,
    write: PencilLine,
    refresh: RefreshCw
};

const iconComp = computed(() => iconMap[String(props.id)]);
const dcconSrc = browser.runtime.getURL(dcconIcon as never);

const safeClick = async (): Promise<boolean> => {
    if (!props.click) return false;

    const result = await props.click();

    if (!result) {
        error.value = Math.random();
    }

    return result;
};
</script>

<style lang="scss">
@use "@/assets/styles/variables" as *;

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

        img,
        .refresher-preview-icon {
            margin: auto 0 auto auto;
        }
    }

    img {
        height: 30px;
        margin-top: 5px;
        width: 30px;
    }

    .refresher-preview-icon {
        height: 24px;
        margin: auto;
        width: 24px;
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
            color: $dark-text-color-bright;

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
            color: $dark-text-color;
        }

        img {
            filter: invert(1);
        }

        .refresher-preview-icon {
            color: $dark-text-color-bright;
        }
    }
}
</style>