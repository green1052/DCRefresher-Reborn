<template>
    <div :class="{cursor: !!this.user.id}" :data-me="me" :title="title" class="refresher-user"
         v-on:click="clickHandle" v-on:contextmenu="contextMenu">
        <div class="refresher-user-content">
            <span :data-icon="user.icon" :data-type="user.type" class="refresher-user-icon"/>
            <span class="refresher-user-nick">{{ user.nick }}</span>
            <span v-if="user.memo" :style="{color: user.memo.color}"
                  class="refresher-user-memo">{{ user.memo.text }}</span>
            <span class="refresher-user-info">{{ userInfo }}</span>
        </div>
    </div>
</template>

<script lang="ts">
import {eventBus} from "../core/eventbus";
import Vue from "vue";

export default Vue.extend({
    name: "refresher-user",
    props: {
        user: {
            type: Object,
            required: true
        },

        me: {
            type: Boolean,
            required: false
        },

        click: {
            type: Function
        }
    },
    computed: {
        title(): string {
            return (this.user.id
                    ? "(" + this.user.id + ")"
                    : this.user.ip
                        ? "(" +
                        this.user.ip +
                        (this.user.ip_data ? ", " + this.user.ip_data : "") +
                        ")"
                        : ""
            )
                .replace("\\n", " ")
                .replace(/  +/g, " ");
        },

        userInfo(): string {
            let data = "";

            data += this.user.id
                ? "(" + this.user.id + ")"
                : this.user.ip
                    ? "(" +
                    this.user.ip +
                    (this.user.ip_data
                        ? ", " +
                        (this.user.ip_data.length > 100
                            ? this.user.ip_data.substring(0, 97) + "..."
                            : this.user.ip_data)
                        : "") +
                    ")"
                    : "";

            return data;
        }
    },
    methods: {
        openLink(url: string): void {
            window.open(url, "_blank");
        },

        clickHandle(): void {
            if (typeof this.click === "function") {
                return this.click(this.user);
            }

            if (this.user.id) {
                this.openLink("https://gallog.dcinside.com/" + this.user.id);
            }
        },

        contextMenu(): void {
            eventBus.emit(
                "refresherUserContextMenu",
                this.user.nick,
                this.user.id,
                this.user.ip
            );
        }
    }
});
</script>