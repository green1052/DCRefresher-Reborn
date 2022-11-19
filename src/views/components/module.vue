<template>
    <div class="refresher-module">
        <div class="left">
            <p class="title">{{ name }}</p>
            <p class="desc">{{ desc }}</p>
            <p class="mute">요구 유틸 : {{ requirement.join(", ") || "없음" }}</p>
        </div>
        <div class="right">
            <refresher-checkbox :checked="enabled" :change="update"></refresher-checkbox>
        </div>
    </div>
</template>

<script>
import browser from "webextension-polyfill";
import checkbox from "./checkbox";
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

        author: {
            type: [String, Object],
            required: false
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
            storage.set(this.name.enable, value);

            // TODO : 전체 로직 깔끔하게 변경

            if (this.name === "다크 모드") {
                this.$root.$children[0].updateDarkMode(value);
            }

            browser.tabs.query({active: true}).then(tabs => {
                tabs.forEach(v => {
                    browser.tabs.sendMessage(v.id, {
                        type: "updateModuleStatus",
                        data: {
                            name: this.name,
                            value: value
                        }
                    });
                });
            });
        },

        openLink(url) {
            if (url) browser.tabs.create(url);
        }
    },
    components: {
        "refresher-checkbox": checkbox
    }
});
</script>