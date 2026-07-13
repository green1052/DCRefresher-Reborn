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

import eventBus from "@/core/eventbus";
import {User} from "@/utils/user";

interface Props {
  user: User;
  me?: boolean;
  click?: (user: User) => void;
}

const props = withDefaults(defineProps<Props>(), {
  me: false,
  click: undefined
});

const userDescription = computed(() => {
  if (props.user.isMember()) {
    const ban = props.user.ban;
    const ratio = props.user.ratio;

    return `${ban ? `[${ban}] ` : ""}${ratio ? ` [${ratio}] ` : ""}(${props.user.id})`;
  }

  return `(${props.user.ip})${props.user.ip_data ? ` [${props.user.ip_data}]` : ""}`;
});

const title = userDescription;
const userInfo = userDescription;

const clickHandle = (): void => {
  if (typeof props.click === "function") {
    props.click(props.user);
    return;
  }

  if (props.user.id) {
    window.open(`https://gallog.dcinside.com/${props.user.id}`, "_blank");
  }
};

const contextMenu = (): void => {
  eventBus.emit("refresherUserContextMenu", props.user.nick, props.user.id, props.user.ip, null, null);
};
</script>

<style lang="scss" scoped>
@use "@/assets/styles/variables" as *;

.refresher-user {
  max-width: calc(100% - 170px);

  .refresher-user-content {
    display: flex;
    padding: 2px 4px;
    width: 100%;
  }

  &.cursor {
    cursor: pointer;
  }

  &[data-me=true] {
    background-color: var(--refresher-user-me-bg);
    border-radius: 5px;
    color: white;
  }

  .refresher-user-icon,
  .refresher-user-nick,
  .refresher-user-info,
  .refresher-user-memo {
    margin-bottom: auto;
    margin-top: auto;
  }

  .refresher-user-icon,
  .refresher-user-nick {
    margin-right: 5px;
    white-space: nowrap;
  }

  .refresher-user-icon {
    background-color: var(--refresher-accent-gray);
    border-radius: 50%;
    box-shadow: $shadow-3dp;
    display: block;
    height: 9px;
    width: 9px;

    &[data-type="UNFIXED"] {
      background-color: rgb(241, 241, 241);
    }

    &[data-type="HALF_FIXED"] {
      background-color: var(--refresher-accent-gray);
    }

    &[data-type="FIXED"] {
      background-color: var(--refresher-accent-yellow);
    }

    &[data-type="HALF_FIXED_SUB_MANAGER"],
    &[data-type="FIXED_SUB_MANAGER"] {
      background-color: var(--refresher-accent-blue);
    }

    &[data-type="HALF_FIXED_MANAGER"],
    &[data-type="FIXED_MANAGER"] {
      background-color: var(--refresher-accent-orange);
    }
  }

  .refresher-user-nick {
    font-size: 14px;
    font-weight: bold;
  }

  .refresher-user-info {
    font-size: 12px;
    max-width: 100%;
    opacity: 0.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-wrap: normal;
  }

  .refresher-user-memo {
    font-size: 12px;
    margin-right: 5px;
  }
}
</style>