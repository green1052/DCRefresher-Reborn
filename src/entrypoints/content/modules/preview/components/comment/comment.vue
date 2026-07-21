<template>
  <div
      :data-deleted="comment.is_delete !== '0'"
      :data-depth="comment.depth"
      class="refresher-comment"
  >
    <div class="meta">
      <User
          :me="me"
          :user="comment.user"
      />
      <div class="float-right">
        <p
            v-if="useWriteComment"
            class="refresher-reply"
            @click="setReply"
        >
          {{ reply.replyNo === comment.no ? "답글 해제" : "답글" }}
        </p>

        <TimeStamp :date="new Date(parsedDate)"/>
        <div
            v-if="
                        comment.is_delete === '0' &&
                        (comment.del_btn === 'Y' || comment.my_cmt === 'Y' || isAdmin || comment.user.isLogout())
                    "
            class="delete"
            @click="safeDelete"
        >
          <svg
              fill="black"
              height="14px"
              viewBox="0 0 24 24"
              width="14px"
              xmlns="http://www.w3.org/2000/svg"
          >
            <path
                d="M0 0h24v24H0z"
                fill="none"
            />
            <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </div>
      </div>
    </div>
    <div v-if="comment.vr_player && voiceData">
      <iframe
          v-if="voiceData.iframe"
          :src="voiceData.src"
          height="54px"
          width="280px"
      />
      <audio
          v-else
          :src="voiceData.src"
          controls
      />
      <p v-if="voiceData.memo">
        {{ voiceData.memo }}
      </p>
    </div>
    <p
        v-else-if="/<(img|video) class=/.test(comment.memo)"
        class="refresher-comment-content dccon"
        @contextmenu="handleDcconContextMenu"
        v-html="comment.memo.replace(/(?<!(dc|<))img/gi, '/><img')"
    />
    <p
        v-else
        class="refresher-comment-content"
        v-html="comment.memo.replaceAll('\n', '<br>')"
    />
  </div>
</template>

<script lang="ts" setup>
import {computed, ref} from "vue";

import {useMeDetection} from "@/entrypoints/content/composables/useMeDetection";
import TimeStamp from "@/components/timestamp.vue";
import User from "@/components/user.vue";
import {handleDcconContextMenu, parseCommentDate, parseVoiceData} from "../../commentUtils";

interface Props {
  comment: DcinsideCommentObject;
  index?: number;
  useWriteComment?: boolean;
  postUser?: string;
  delete?: (no: string, password: string, isAdmin: boolean) => void;
  reply?: { commentNo: string | null; replyNo: string | null };
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  useWriteComment: false,
  postUser: "",
  delete: undefined,
  reply: () => ({commentNo: null, replyNo: null})
});

const emit = defineEmits<{
  "update:reply": [reply: { commentNo: string | null; replyNo: string | null }];
}>();

const isAdmin = ref(!!document.querySelector(".useradmin_btnbox button"));

const {me} = useMeDetection({
  userId: props.comment.user.id ?? "",
  postUser: props.postUser || undefined
});

const parsedDate = computed(() => parseCommentDate(props.comment.reg_date));

const voiceData = computed(() => {
    if (!props.comment.vr_player) return null;
    return parseVoiceData(props.comment.memo);
});

const safeDelete = (): void => {
  if (!props.delete) return;

  let password: string = "";

  if (!isAdmin.value && props.comment.my_cmt === "N") {
    password = prompt("비밀번호를 입력하세요.") ?? "";

    if (!password) return;
  }

  props.delete(props.comment.no, password, props.comment.my_cmt === "N" && isAdmin.value);
};

const setReply = () => {
  if (!props.reply) return;

  if (props.reply.replyNo === props.comment.no) {
    emit("update:reply", {
      commentNo: null,
      replyNo: null
    });

    return;
  }

  emit("update:reply", {
    commentNo: props.reply.commentNo === props.comment.c_no ? null : props.comment.c_no || props.comment.no,
    replyNo: props.reply.replyNo === props.comment.no ? null : props.comment.no
  });
};
</script>

<style lang="scss" scoped>
@use "@/assets/styles/variables" as *;

.refresher-comment {
  position: relative;

  &[data-deleted="true"] {
    opacity: 0.4;
  }

  .meta {
    display: flex;

    .refresher-reply {
      cursor: pointer;
      font-size: 12px;
      opacity: 0.6;
    }

    .float-right {
      display: flex;
      margin-left: auto;
    }
  }

  .refresher-timestamp {
    margin-left: 2vw;
    white-space: nowrap;
  }

  .delete {
    background-color: rgba(170, 170, 170, 0.32);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    height: 20px;
    margin-left: 10px;
    width: 20px;

    &:hover {
      background-color: rgba(170, 170, 170, 0.45);
    }

    &:active {
      background-color: rgba(170, 170, 170, 0.6);
    }

    svg {
      margin: auto;
    }
  }
}
</style>