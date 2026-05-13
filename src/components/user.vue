<template>
    <div
        :class="{ cursor: !!user.id }"
        :data-me="me"
        :title="title"
        class="refresher-user"
        @click="clickHandle"
        @contextmenu="contextMenu"
    >
        <div class="refresher-user-content">
            <span
                :data-icon="user.icon"
                :data-type="user.type"
                class="refresher-user-icon"
            />
            <span class="refresher-user-nick">{{ user.nick }}</span>
            <span
                v-if="user.memo"
                :style="{ color: user.memo.color }"
                class="refresher-user-memo"
            >
                [{{ user.memo.text }}]
            </span>
            <span
                v-if="!(me && user.isLogout())"
                class="refresher-user-info"
            >
                {{ userInfo }}
            </span>
        </div>
    </div>
</template>

<script lang="ts" setup>
import {computed} from "vue";

import eventBus from "../core/eventbus";
import {User} from "../utils/user";

interface Props {
    user: User;
    me?: boolean;
    click?: (user: User) => void;
}

const props = withDefaults(defineProps<Props>(), {
    me: false,
    click: undefined
});

const title = computed(() => {
    if (props.user.isMember()) {
        const ban = props.user.ban;
        const ratio = props.user.ratio;

        return `${ban ? `[${ban}] ` : ""}${ratio ? ` [${ratio}] ` : ""}(${props.user.id})`;
    }

    return `(${props.user.ip})${props.user.ip_data ? ` [${props.user.ip_data}]` : ""}`;
});

const userInfo = computed(() => {
    if (props.user.isMember()) {
        const ban = props.user.ban;
        const ratio = props.user.ratio;

        return `${ban ? `[${ban}] ` : ""}${ratio ? ` [${ratio}] ` : ""}(${props.user.id})`;
    }

    return `(${props.user.ip})${props.user.ip_data ? ` [${props.user.ip_data}]` : ""}`;
});

const openLink = (url: string): void => {
    window.open(url, "_blank");
};

const clickHandle = (): void => {
    if (typeof props.click === "function") {
        props.click(props.user);
        return;
    }

    if (props.user.id) {
        openLink(`https://gallog.dcinside.com/${props.user.id}`);
    }
};

const contextMenu = (): void => {
    eventBus.emit("refresherUserContextMenu", props.user.nick, props.user.id, props.user.ip, null, null);
};
</script>