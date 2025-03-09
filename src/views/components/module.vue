<template>
    <div class="refresher-module">
        <div class="left">
            <p class="title">{{ name }}</p>
            <p class="desc">{{ desc }}</p>
            <p class="mute">요구 유틸 : {{ requirement?.join(", ") || "없음" }}</p>
        </div>
        <div class="right">
            <refresher-checkbox :change="update" :checked="enabled" />
        </div>
    </div>
</template>

<script lang="ts">
import browser from "webextension-polyfill";
import checkbox from "./checkbox.vue";
import storage from "../../utils/storage";
import Vue from "vue";

export default Vue.extend({
    name: "refresher-module",
    props: {
        name: {
            type: String,
            required: true
        },

        desc: {
            type: String,
            required: true
        },

        requirement: {
            type: Array,
            required: false
        },

        enabled: {
            type: Boolean,
            required: true
        }
    },
    methods: {
        update(_module, _key, value) {
            storage.set(`${this.name}.enable`, value);

            // TODO : 전체 로직 깔끔하게 변경

            if (this.name === "다크 모드") {
                this.$root.$children[0].updateDarkMode(value);
            }

            browser.tabs.query({ active: true }).then((tabs) => {
                for (const tab of tabs) {
                    browser.tabs.sendMessage(tab.id!, {
                        type: "updateModuleStatus",
                        data: {
                            name: this.name,
                            value: value
                        }
                    });
                }
            });
        }
    },
    components: {
        "refresher-checkbox": checkbox
    }
});
</script>
