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

                <TimeStamp :date="new Date(date(comment.reg_date))"/>
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
        <div v-if="comment.vr_player">
            <iframe
                v-if="getVoiceData.iframe"
                :src="getVoiceData.src"
                height="54px"
                width="280px"
            />
            <audio
                v-else
                :src="getVoiceData.src"
                controls
            />
            <p v-if="getVoiceData.memo">
                {{ getVoiceData.memo }}
            </p>
        </div>
        <p
            v-else-if="/<(img|video) class=/.test(comment.memo)"
            class="refresher-comment-content dccon"
            @contextmenu="contextMenu"
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
import $ from "cash-dom";
import {computed, onMounted, ref} from "vue";

import eventBus from "../core/eventbus";
import TimeStamp from "./timestamp.vue";
import User from "./user.vue";

interface VoiceDataComputed {
    iframe: boolean;
    src: string;
    memo: string;
}

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

// Reactive data
const currentId = ref("");
const me = ref(false);

// Computed properties
const getVoiceData = computed((): VoiceDataComputed | null => {
    if (!props.comment.vr_player) {
        return null;
    }

    const memo = props.comment.memo.split("@^dc^@");

    return {
        iframe: memo[0].indexOf("iframe") > -1,
        src:
            memo[0].indexOf("iframe") > -1
                ? memo[0].split("src=\"")[1].split("\"")[0]
                : "https://vr.dcinside.com/" + memo[0],
        memo: memo[1]
    };
});

const isAdmin = computed((): boolean => {
    return document.querySelector(".useradmin_btnbox button") !== null;
});

// Lifecycle
onMounted(() => {
    if (!props.comment.user.id) {
        return;
    }

    const fixedNameElement = document.querySelector("#login_box > .user_info .nickname > em");
    const fixedName = fixedNameElement && fixedNameElement.innerHTML ? fixedNameElement.innerHTML : null;

    if (fixedName) {
        const gallogIcon = document.querySelector("#login_box > .user_info > .writer_nikcon");
        if (gallogIcon) {
            const attribute = gallogIcon.getAttribute("onclick");
            if (attribute) {
                const match = /window\.open\('\/\/gallog\.dcinside\.com\/(\w*)'\);/.exec(attribute);
                if (match && match[1]) {
                    const id = match[1];

                    if (props.comment.user.id === id) {
                        me.value = true;
                    }
                }
            }
        }
    }

    const gallogImageElement = document.querySelector<HTMLImageElement>("#login_box .user_info .writer_nikcon > img");

    const click = gallogImageElement && gallogImageElement.getAttribute("onclick");

    if (click) {
        currentId.value = click.replace(/window\.open\('\/\/gallog\.dcinside\.com\//g, "").replace(/'\);/g, "");

        me.value = currentId.value === props.comment.user.id;
    }

    if (!me.value && props.postUser) {
        me.value = props.postUser === props.comment.user.id;
    }

    if (!me.value && !props.postUser) {
        eventBus.on("RefresherPostDataLoaded", (obj: IPostInfo) => {
            me.value = obj.user && obj.user.id === props.comment.user.id;
        });
    }
});

// Methods
const date = (str: string): string => {
    return str.substring(0, 4).match(/\./)
        ? `${new Date().getFullYear()}-${str.replace(/\./g, "-")}`
        : str.replace(/\./g, "-");
};

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

    emit("update:reply", {
        commentNo: props.reply.commentNo === props.comment.c_no ? null : props.comment.c_no || props.comment.no,
        replyNo: props.reply.replyNo === props.comment.no ? null : props.comment.no
    });
};

const contextMenu = (e: MouseEvent): void => {
    if (!e.target) return;
    const $element = $(e.target as HTMLElement);

    if ($element.hasClass("written_dccon")) return;

    const src = $element.attr("src");
    if (!src) return;

    const code = src.replace(/^.*no=/g, "").replace(/^&.*$/g, "");

    eventBus.emit("refresherUserContextMenu", null, null, null, code, null);
};
</script>