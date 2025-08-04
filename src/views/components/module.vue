<template>
    <div class="refresher-module">
        <div class="left">
            <p class="title">
                {{ name }}
            </p>
            <p class="desc">
                {{ desc }}
            </p>
            <p class="mute">요구 유틸 : {{ requirementText }}</p>
        </div>
        <div class="right">
            <RefresherCheckbox
                :change="handleToggle"
                :checked="enabled"
            />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import browser from "webextension-polyfill";

import storage from "../../utils/storage";
import RefresherCheckbox from "./checkbox.vue";

interface Props {
    name: string;
    desc: string;
    requirement?: string[];
    enabled: boolean;
}

const props = defineProps<Props>();

const requirementText = computed(() => (props.requirement?.length ? props.requirement.join(", ") : "없음"));

const handleToggle = async (_module: string | undefined, _id: string | undefined, value: boolean) => {
    try {
        await storage.set(`${props.name}.enable`, value);

        const tabs = await browser.tabs.query({ active: true });

        const updatePromises = tabs.map((tab) => {
            if (!tab.id) return Promise.resolve();

            return browser.tabs
                .sendMessage(tab.id, {
                    type: "updateModuleStatus",
                    data: {
                        name: props.name,
                        value
                    }
                })
                .catch((error) => {
                    console.warn(`Failed to send message to tab ${tab.id}:`, error);
                });
        });

        await Promise.all(updatePromises);
    } catch (error) {
        console.error("Failed to update module status:", error);
    }
};
</script>

<style lang="scss" scoped>
.refresher-module {
    position: relative;
    display: flex;
    background-color: #f8f8f8;
    border-radius: 13.3px;
    padding: 13px 23px;
    margin-bottom: 5px;
    transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);

    &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &.highlight {
        animation: highlight-blink 1s;
    }

    .left {
        flex: 1;
        letter-spacing: -0.66px;

        .title {
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 4px;
            color: #333;
        }

        .desc {
            font-size: 14px;
            color: #666;
            margin-bottom: 4px;
            line-height: 1.4;
        }

        .mute {
            color: #a0a0a0;
            font-size: 12px;
            letter-spacing: -0.66px;

            .link {
                border-bottom: 1px solid #a0a0a0;
                cursor: pointer;
                transition: color 0.25s cubic-bezier(0.19, 1, 0.22, 1);

                &:hover {
                    color: #4caf50;
                    border-bottom-color: #4caf50;
                }
            }
        }
    }

    .right {
        margin-left: auto;
        margin-top: auto;
        margin-bottom: auto;
        display: flex;
        align-items: center;
    }
}

@keyframes highlight-blink {
    0%,
    50% {
        background-color: #afdbff;
    }

    40%,
    100% {
        background-color: #f8f8f8;
    }
}

@keyframes highlight-blink-dark {
    0%,
    50% {
        background-color: #223957;
    }

    40%,
    100% {
        background-color: #2c2c2c;
    }
}

@media (prefers-color-scheme: dark) {
    .refresher-module {
        background-color: #2c2c2c;

        &:hover {
            box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
        }

        &.highlight {
            animation: highlight-blink-dark 1s;
        }

        .left {
            .title {
                color: #e0e0e0;
            }

            .desc {
                color: #b0b0b0;
            }

            .mute {
                color: #888;

                .link {
                    &:hover {
                        color: #66bb6a;
                        border-bottom-color: #66bb6a;
                    }
                }
            }
        }
    }
}
</style>
