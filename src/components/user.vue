<template>
    <div
        :class="{ cursor: !!this.user.id }"
        :data-me="me"
        :title="title"
        class="refresher-user"
        @click="clickHandle"
        @contextmenu="contextMenu"
    >
        <div class="refresher-user-content">
            <span :data-icon="user.icon" :data-type="user.type" class="refresher-user-icon" />
            <span class="refresher-user-nick">{{ user.nick }}</span>
            <span v-if="user.memo" :style="{ color: user.memo.color }" class="refresher-user-memo"
                >[{{ user.memo.text }}]</span
            >
            <span class="refresher-user-info">{{ userInfo }}</span>
        </div>
    </div>
</template>

<script lang="ts">
import { eventBus } from "../core/eventbus";
import Vue, { PropType } from "vue";
import { User } from "../utils/user";

export default Vue.extend({
    name: "refresher-user",
    props: {
        user: {
            type: Object as PropType<User>,
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
            if (this.user.isMember()) {
                const ban = this.user.ban;
                const ratio = this.user.ratio;

                return `(${this.user.id})${ban ? ` [${ban}]` : ""}${ratio ? ` [${ratio}]` : ""}`;
            }

            return `(${this.user.ip})${this.user.ip_data ? ` [${this.user.ip_data}]` : ""}`;
        },

        userInfo(): string {
            if (this.user.isMember()) {
                const ban = this.user.ban;
                const ratio = this.user.ratio;

                return `(${this.user.id})${ban ? ` [${ban}]` : ""}${ratio ? ` [${ratio}]` : ""}`;
            }

            return `(${this.user.ip})${this.user.ip_data ? ` [${this.user.ip_data}]` : ""}`;
        }
    },
    methods: {
        openLink(url: string): void {
            window.open(url, "_blank");
        },

        clickHandle(): void {
            if (typeof this.click === "function") {
                this.click(this.user);
                return;
            }

            if (this.user.id) this.openLink(`https://gallog.dcinside.com/${this.user.id}`);
        },

        contextMenu(): void {
            eventBus.emit(
                "refresherUserContextMenu",
                this.user.nick,
                this.user.id,
                this.user.ip,
                null,
                null
            );
        }
    }
});
</script>
