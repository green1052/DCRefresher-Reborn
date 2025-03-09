<template>
    <div
        :data-deleted="comment.is_delete !== '0'"
        :data-depth="comment.depth"
        class="refresher-comment"
    >
        <div class="meta">
            <User :me="me" :user="comment.user" />
            <div class="float-right">
                <p
                    v-if="useWriteComment && comment.depth === 0"
                    class="refresher-reply"
                    @click="setReply"
                >
                    {{ reply === comment.no ? "답글 해제" : "답글" }}
                </p>

                <TimeStamp :date="new Date(date(comment.reg_date))" />
                <div
                    v-if="
                        comment.is_delete === '0' &&
                        (comment.del_btn === 'Y' ||
                            comment.my_cmt === 'Y' ||
                            isAdmin ||
                            comment.user.isLogout())
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
                        <path d="M0 0h24v24H0z" fill="none" />
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
            <audio v-else :src="getVoiceData.src" controls />
            <p v-if="getVoiceData.memo">{{ getVoiceData.memo }}</p>
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

<script lang="ts">
import { eventBus } from "../core/eventbus";
import timestamp from "./timestamp.vue";
import user from "./user.vue";
import $ from "cash-dom";
import Vue, { PropType } from "vue";

interface CommentVueData {
    currentId: string;
    me: boolean;
}

interface VoiceDataComputed {
    iframe: boolean;
    src: string;
    memo: string;
}

export default Vue.extend({
    name: "refresher-comment",
    components: {
        User: user,
        TimeStamp: timestamp
    },
    data(): CommentVueData {
        return {
            currentId: "",
            me: false
        };
    },
    props: {
        comment: {
            type: Object as PropType<DcinsideCommentObject>,
            required: true
        },

        index: {
            type: Number
        },

        useWriteComment: {
            type: Boolean
        },

        postUser: {
            type: String
        },

        delete: {
            type: Function
        },

        reply: {
            type: String
        }
    },
    mounted() {
        if (!this.comment.user.id) {
            return;
        }

        const fixedName = document.querySelector(
            "#login_box > .user_info .nickname > em"
        )?.innerHTML;

        if (fixedName) {
            const gallogIcon = document.querySelector("#login_box > .user_info > .writer_nikcon")!;
            const attribute = gallogIcon.getAttribute("onclick")!;
            const id = /window\.open\('\/\/gallog\.dcinside\.com\/(\w*)'\);/.exec(attribute)![1];

            if (this.comment.user.id === id) {
                this.me = true;
            }
        }

        const gallogImageElement = document.querySelector<HTMLImageElement>(
            "#login_box .user_info .writer_nikcon > img"
        );

        const click = gallogImageElement && gallogImageElement.getAttribute("onclick");

        if (click) {
            this.currentId = click
                .replace(/window\.open\('\/\/gallog\.dcinside\.com\//g, "")
                .replace(/'\);/g, "");

            this.me = this.currentId === this.comment.user.id;
        }

        if (!this.me && this.postUser) {
            this.me = this.postUser === this.comment.user.id;
        }

        if (!this.me && !this.postUser) {
            eventBus.on("RefresherPostDataLoaded", (obj: IPostInfo) => {
                this.me = obj.user?.id === this.comment.user.id;
            });
        }
    },
    computed: {
        getVoiceData(this): VoiceDataComputed | null {
            if (!this.comment.vr_player) {
                return null;
            }

            const memo = this.comment.memo.split("@^dc^@");

            return {
                iframe: memo[0].indexOf("iframe") > -1,
                src:
                    memo[0].indexOf("iframe") > -1
                        ? memo[0].split('src="')[1].split('"')[0]
                        : "https://vr.dcinside.com/" + memo[0],
                memo: memo[1]
            };
        },

        isAdmin(): boolean {
            return document.querySelector(".useradmin_btnbox button") !== null;
        }
    },
    methods: {
        date(str: string): string {
            return str.substring(0, 4).match(/\./)
                ? `${new Date().getFullYear()}-${str.replace(/\./g, "-")}`
                : str.replace(/\./g, "-");
        },

        safeDelete(): void {
            if (!this.delete) return;

            let password: string = "";

            if (!this.isAdmin && this.comment.my_cmt === "N") {
                password = prompt("비밀번호를 입력하세요.") ?? "";

                if (!password) return;
            }

            this.delete(this.comment.no, password, this.comment.my_cmt === "N" && this.isAdmin);
        },

        setReply() {
            this.$emit("update:reply", this.reply === this.comment.no ? null : this.comment.no);
        },

        contextMenu(e: MouseEvent): void {
            if (!e.target) return;
            const $element = $(e.target as HTMLElement);

            if ($element.hasClass("written_dccon")) return;

            const src = $element.attr("src");
            if (!src) return;

            const code = src.replace(/^.*no=/g, "").replace(/^&.*$/g, "");

            eventBus.emit("refresherUserContextMenu", null, null, null, code, null);
        }
    }
});
</script>
