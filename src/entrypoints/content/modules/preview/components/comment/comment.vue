<template>
    <div
        :data-collapsed="collapsed"
        :data-deleted="comment.is_delete !== '0'"
        :data-depth="comment.depth"
        :data-has-replies="comment.depth === 0 && replyCount > 0"
        :data-last-reply="lastReply"
        class="refresher-comment"
    >
        <div class="meta">
            <User
                :me="me"
                :user="comment.user"
            />
            <div
                v-if="comment.depth === 0 && replyCount > 1"
                class="refresher-reply-toggle"
                @click="toggleCollapse"
            >
                <ChevronDown class="toggle-icon"/>
            </div>
            <div class="float-right">
                <div
                    v-if="useWriteComment"
                    :class="{ active: reply.replyNo === comment.no }"
                    class="refresher-reply"
                    @click="setReply"
                >
                    <Check v-if="reply.replyNo === comment.no" class="reply-icon"/>
                    <Reply v-else class="reply-icon"/>
                </div>

                <TimeStamp :date="new Date(parsedDate)"/>
                <div
                    v-if="
                        comment.is_delete === '0' &&
                        (comment.del_btn === 'Y' || comment.my_cmt === 'Y' || isAdmin || comment.user.isLogout())
                    "
                    class="delete"
                    @click="safeDelete"
                >
                    <X class="delete-icon"/>
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

import {Check, ChevronDown, Reply, X} from "lucide-vue-next";
import {useMeDetection} from "@/entrypoints/content/composables/useMeDetection";
import TimeStamp from "@/components/timestamp.vue";
import User from "@/components/user.vue";
import {handleDcconContextMenu, parseCommentDate, parseVoiceData} from "../../comments";

interface Props {
    comment: DcinsideCommentObject;
    index?: number;
    useWriteComment?: boolean;
    postUser?: string;
    delete?: (no: string, password: string, isAdmin: boolean) => void;
    reply?: { commentNo: string | null; replyNo: string | null };
    replyCount?: number;
    lastReply?: boolean;
    collapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    index: 0,
    useWriteComment: false,
    postUser: "",
    delete: undefined,
    reply: () => ({commentNo: null, replyNo: null}),
    replyCount: 0,
    lastReply: false,
    collapsed: false
});

const emit = defineEmits<{
    "update:reply": [reply: { commentNo: string | null; replyNo: string | null }];
    "toggle-collapse": [no: string];
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

const toggleCollapse = () => {
    emit("toggle-collapse", props.comment.no);
};
</script>

<style lang="scss" scoped>
@use "@/assets/styles/variables" as *;

.refresher-comment {
    position: relative;

    &[data-deleted="true"] {
        opacity: 0.4;
    }

    // 부모 댓글: 답글 있으면 마진 제거 (첫 답글과 붙게)
    &[data-depth="0"][data-has-replies="true"] {
        margin-bottom: 0;
    }

    // 대댓글: ㄴ 트리 라인. 부모 왼쪽에서 자식 중앙까지 선.
    &[data-depth="1"] {
        margin-bottom: 0;
        margin-left: 0;
        padding-left: 14px;
        padding-top: 2vh;
    }

    // 첫 답글: 부모와 붙게
    &[data-depth="1"]:first-of-type {
        padding-top: 0;
    }

    // ㄴ 꺾임: 수직선 위쪽 ~ 자식 중앙, 수평선.
    &[data-depth="1"]::before {
        border-bottom: 2px solid var(--refresher-border-light);
        border-left: 2px solid var(--refresher-border-light);
        content: "";
        height: 50%;
        left: 0;
        position: absolute;
        top: 0;
        width: 12px;
    }

    // 첫 답글: 부모와 붙어 선 연결
    &[data-depth="1"]:first-of-type::before {
        top: 0;
    }

    // 수직선 아래쪽: 자식 중앙 ~ 다음 답글
    &[data-depth="1"]::after {
        border-left: 2px solid var(--refresher-border-light);
        content: "";
        height: 50%;
        left: 0;
        position: absolute;
        top: 50%;
        width: 0;
    }

    // 마지막 답글: 아래 수직선 없음 + 다음 부모와 간격
    &[data-depth="1"][data-last-reply="true"] {
        margin-bottom: 2vh;

        &::after {
            display: none;
        }
    }

    .refresher-reply-toggle {
        align-items: center;
        background: rgba(170, 170, 170, 0.2);
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        line-height: 1;
        margin-left: 6px;
        opacity: 0.7;
        padding: 2px;

        &:hover {
            opacity: 1;
        }

        svg {
            transition: transform 0.2s ease;
        }
    }

    &[data-collapsed="true"] .refresher-reply-toggle svg {
        transform: rotate(-90deg);
    }

    .meta {
        align-items: center;
        display: flex;

        .refresher-reply {
            align-items: center;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            opacity: 0.6;

            &:hover {
                opacity: 1;
            }

            &.active {
                background: rgba(170, 170, 170, 0.2);
                opacity: 1;
            }
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