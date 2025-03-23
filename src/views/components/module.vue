<template>
    <div class="refresher-module">
        <div class="left">
            <p class="title">
                {{ name }}
            </p>
            <p class="desc">
                {{ desc }}
            </p>
            <p class="mute">
요구 유틸 : {{ requirement?.join(", ") || "없음" }}
</p>
        </div>
        <div class="right">
            <refresher-checkbox
                :change="update"
                :checked="enabled"
            />
        </div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import browser from "webextension-polyfill";

import storage from "../../utils/storage";
import checkbox from "./checkbox.vue";

export default Vue.extend({
    name: "RefresherModule",
    components: {
        "refresher-checkbox": checkbox
    },
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
    }
});
</script>
