<template>
  <div class="refresher-write-comment">
    <form
        v-show="editUser"
        class="user"
    >
      <input
          v-model="unsignedUserID"
          placeholder="닉네임"
          type="text"
          @change="(v) => validCheck('id', v.target.value)"
      />
      <input
          v-model="unsignedUserPW"
          placeholder="비밀번호"
          type="password"
          @change="(v) => validCheck('pw', v.target.value)"
      />
    </form>
    <div class="refresher-comment-body">
      <div
          :class="{ focus: focused, disable: disabled }"
          class="refresher-input-wrap"
      >
                <textarea
                    id="comment_main"
                    :disabled="disabled || getDccon().length > 0"
                    :placeholder="!getDccon().length ? '댓글 입력...' : '디시콘이 선택됐습니다.'"
                    autocomplete="new-password"
                    @blur="blur"
                    @focus="focus"
                    @input="updateText"
                    @keydown="type"
                />
      </div>
      <PreviewButton
          id="write"
          :click="write"
          class="refresher-writecomment primary"
          text="작성"
      />
    </div>
    <div
        @mouseleave="hoverUserInfo = false"
        @mouseover="hoverUserInfo = true"
    >
      <div
          :class="{
                    'refresher-comment-util': true,
                    'refresher-comment-util-show': !(hoverUserInfo && !user.id)
                }"
          class="whoami"
      >
        <UserComponent
            v-if="user"
            :me="true"
            :user="user"
        />
        <span>로 {{ reply.commentNo ? "" : "답글" }} {{ !getDccon().length ? "" : "디시콘" }} 작성 중</span>
      </div>
      <div
          :class="{
                    'refresher-comment-util': true,
                    'refresher-comment-util-edit': true,
                    'refresher-comment-util-show': hoverUserInfo && user.isLogout()
                }"
          class="whoami"
      >
                <span @click="toggleEditUser">
                    클릭하면 작성자 정보 수정 모드를 {{ editUser ? "비활성화" : "활성화" }}시킵니다.
                </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import $ from "cash-dom";
import {getCurrentInstance, onMounted, ref, watch} from "vue";
import toast from "../utils/toast";

import {Nullable} from "../utils/types";
import {User} from "../utils/user";
import PreviewButton from "./previewButton.vue";
import UserComponent from "./user.vue";

interface Props {
  func?: (...args: any[]) => Promise<boolean>;
  reply?: { commentNo: string | null; replyNo: string | null };
  getDccon?: () => any[];
  getBigDccon?: () => boolean;
}

const props = withDefaults(defineProps<Props>(), {
  func: undefined,
  reply: () => ({commentNo: null, replyNo: null}),
  getDccon: () => () => [],
  getBigDccon: () => () => false
});

const emit = defineEmits<{
  setDccon: [dccons: any[]];
  setBigDccon: [value: boolean];
  "update:reply": [reply: { commentNo: string | null; replyNo: string | null }];
}>();

// Reactive data
const focused = ref(false);
const disabled = ref(false);
const text = ref("");
const editUser = ref(false);
const fixedUser = ref(false);
const hoverUserInfo = ref(false);
const user = ref<Nullable<User>>(null);
const unsignedUserID = ref(localStorage.nonmember_nick || "ㅇㅇ");
const unsignedUserPW = ref(localStorage.nonmember_pw || Math.random().toString(36).substring(5));

const instance = getCurrentInstance();

watch(unsignedUserID, (value: string) => {
  if (!user.value) return;

  localStorage.setItem("nonmember_nick", value);
  user.value.nick = value;
});

watch(unsignedUserPW, (value: string) => {
  localStorage.setItem("nonmember_pw", value);
});

onMounted(() => {
  const gallogName = document.querySelector("#login_box > .user_info .nickname > em");
  const fixedName = gallogName && gallogName.innerHTML ? gallogName.innerHTML : null;

  if (fixedName) {
    fixedUser.value = true;

    const gallogIcon = document.querySelector("#login_box > .user_info > .writer_nikcon");
    if (gallogIcon) {
      const attribute = gallogIcon.getAttribute("onclick");
      if (attribute) {
        const match = /window\.open\('\/\/gallog\.dcinside\.com\/(\w*)'\);/.exec(attribute);
        if (match && match[1]) {
          const id = match[1];
          const imgElement = gallogIcon.querySelector("img");
          const src = imgElement ? imgElement.src : null;
          user.value = new User(fixedName, id, null, src);
        }
      }
    }
  } else {
    user.value = new User(unsignedUserID.value, null, "127.0.0.1", null);
  }
});

// Methods
const updateText = (ev: InputEvent) => {
  text.value = (ev.target as HTMLTextAreaElement).value;
};

const validCheck = (type: string, value: string): void => {
  if (type === "id" && value.length < 1) {
    toast.show(`아이디는 최소 1자리 이상이어야 합니다. 자동으로 "ㅇㅇ"로 설정합니다.`);
    unsignedUserID.value = "ㅇㅇ";

    return;
  }

  if (type === "pw" && value.length < 2) {
    const random = Math.random().toString(36).substring(5);

    toast.show(`비밀번호는 최소 2자리 이상이어야 합니다. 자동으로 "${random}"로 설정합니다.`);
    unsignedUserPW.value = random;
  }
};

const toggleEditUser = (): void => {
  if (user.value && user.value.isLogout()) {
    editUser.value = !editUser.value;
  }
};

const write = async (): Promise<boolean> => {
  disabled.value = true;

  if (!fixedUser.value && (!unsignedUserID.value || !unsignedUserPW.value)) {
    toast.show("아이디 혹은 비밀번호를 입력하지 않았습니다.", "error");
    disabled.value = false;
    return false;
  }

  if (!props.func) return true;

  const dccons = props.getDccon ? props.getDccon() : [];
  const bigDccon = props.getBigDccon ? props.getBigDccon() : false;

  const result = await props.func(
      !dccons.length ? "text" : "dccon",
      dccons.length ? dccons : text.value,
      props.reply ? props.reply.commentNo : null,
      props.reply ? props.reply.replyNo : null,
      fixedUser.value && user.value
          ? {name: user.value.nick}
          : {
            name: unsignedUserID.value,
            pw: unsignedUserPW.value
          },
      bigDccon
  );

  if (!result) {
    disabled.value = false;
    return false;
  }

  disabled.value = false;

  text.value = "";
  $("#comment_main").val("");

  emit("setDccon", []);
  emit("setBigDccon", false);
  emit("update:reply", {commentNo: null, replyNo: null});

  return result;
};

const focus = (): void => {
  focused.value = true;
  instance.parent.root.exposeProxy.inputFocus = true;
};

const blur = (): void => {
  focused.value = false;
  instance.parent.root.exposeProxy.inputFocus = false;
};

const type = (ev: KeyboardEvent): KeyboardEvent | void => {
  if (ev.shiftKey && ev.key === "Enter") {
    return ev;
  }

  if (ev.key !== "Enter") {
    return ev;
  }

  write();
};
</script>

<style lang="scss" scoped>
.refresher-write-comment {
  display: flex;
  flex-direction: column;
  margin-top: 20px;

  .refresher-comment-util {
    opacity: 0;
    transition: opacity 0.2s cubic-bezier(0.19, 1, 0.22, 1);

    &.refresher-comment-util-show {
      opacity: 1;
    }

    &.refresher-comment-util-edit {
      color: black;
      cursor: pointer;
      margin-left: 15px;
      margin-top: -17px;
    }
  }

  .whoami {
    display: flex;

    & > span {
      letter-spacing: -1px;
      margin-bottom: 1px;
      margin-top: auto;
      opacity: 0.5;
    }
  }

  .refresher-user {
    background-color: initial !important;
    border-radius: initial !important;
    color: initial !important;
    margin-top: 10px;
  }

  .user {
    display: flex;

    input {
      background-color: #fff;
      border: 1px solid #aaa;
      border-radius: 9px;
      font-size: 15px;
      margin-right: 5px;
      width: 150px;
    }
  }

  .refresher-comment-body {
    display: flex;
    margin-top: 30px;
  }

  & > .refresher-writecomment {
    margin: auto;
  }
}

html:has(#css-darkmode) {
  .refresher-write-comment {
    .refresher-comment-util {
      &.refresher-comment-util-edit {
        color: white;
      }
    }

    .user {
      input {
        background-color: #3b3b3b;
        border: 1px solid rgb(90, 90, 90);
      }
    }
  }
}
</style>