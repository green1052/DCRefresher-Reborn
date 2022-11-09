<template>
    <div class="refresher-comment" :data-depth="comment.depth" :data-rereply="rereply"
         :data-deleted="comment.del_yn === 'Y'">
        <div class="meta">
            <User :user="comment.user" :me="me"></User>
            <div class="float-right">
                <p v-if="comment.depth === 0 && comment.del_yn === 'N'" class="refresher-reply" v-on:click="reply">
                    {{ this.getReply() === this.comment.no ? "답글 해제" : "답글" }}</p>

                <TimeStamp :date="new Date(date(comment.reg_date))"></TimeStamp>
                <div class="delete"
                     v-if="comment.del_yn === 'N'"
                     v-on:click="this.safeDelete">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black" width="14px" height="14px">
                        <path d="M0 0h24v24H0z" fill="none"/>
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </div>
            </div>
        </div>
        <div v-if="comment.vr_player">
            <iframe v-if="getVoiceData.iframe" :src="getVoiceData.src" width="280px" height="54px"></iframe>
            <audio v-else :src="getVoiceData.src" controls></audio>
            <p v-if="getVoiceData.memo">{{ getVoiceData.memo }}</p>
        </div>
        <!--<p v-else-if="comment.memo.includes('<img class=') || comment.memo.includes('<video class=')"></p> -->
        <p v-else class="refresher-comment-content"
           :class="{dccon: comment.memo.indexOf('<img class=') > -1 || comment.memo.indexOf('<video class=') > -1}"
           v-html="comment.memo.replaceAll('\n', '<br/>')"></p>
    </div>
</template>

<script lang="ts">
import {eventBus} from "../core/eventbus";
import timestamp from "./timestamp.vue";
import user from "./user.vue";

const NRegex = /(ㄴ)(\s)?([^ ]+)/g;

interface CommentVueData {
    currentId: string;
    me: boolean;
    rereply: boolean;
}

interface CommentVueMethods {
    checkReReply: () => boolean;
}

interface CommentClass extends CommentVueData, CommentVueMethods {
    comment: dcinsideCommentObject;
    index: number;
    postUser: string;
    delete: (id: string, password: string, admin: boolean) => void;
    getReply: () => string | null;
}

interface VoiceDataComputed {
    iframe: boolean;
    src: string;
    memo: string;
}

export default {
    name: "refresher-comment",
    components: {
        User: user,
        TimeStamp: timestamp
    },
    data(): CommentVueData {
        return {
            currentId: "",
            me: false,
            rereply: false
        };
    },
    props: {
        comment: {
            type: Object,
            required: true
        },

        index: {
            type: Number
        },

        postUser: {
            type: String
        },

        delete: {
            type: [Function, Boolean]
        },

        getReply: {
            type: Function
        }
    },
    mounted(this: CommentClass): void {
        this.rereply = this.checkReReply();

        if (!this.comment.user.id) {
            return;
        }

        const gallogImageElement = document.querySelector(
            "#login_box .user_info .writer_nikcon > img"
        ) as HTMLImageElement;

        const click =
            gallogImageElement && gallogImageElement.getAttribute("onclick");

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
            eventBus.on(
                "RefresherPostDataLoaded",
                (obj: PostInfo) => {
                    this.me = (obj.user && obj.user.id) === this.comment.user.id;
                },
                {
                    once: true
                }
            );
        }
    },
    computed: {
        getVoiceData(this: CommentClass): VoiceDataComputed | null {
            if (!this.comment.vr_player) {
                return null;
            }

            const memo = this.comment.memo.split("@^dc^@");

            return {
                iframe: memo[0].indexOf("iframe") > -1,
                src:
                    memo[0].indexOf("iframe") > -1
                        ? memo[0].split("src=\"")[1].split("\"")[0]
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

        extractID(str: string): string | null {
            const match = str.match(/gallog\.dcinside.com\/.+'/g);
            return match ? match[0].replace(/gallog\.dcinside.com\/|'/g, "") : null;
        },

        checkReReply(this: CommentClass): boolean {
            const content = this.comment.memo;
            const depth = this.comment.depth;

            if (depth < 1) {
                return false;
            }

            if (
                !NRegex.test(content) ||
                content.indexOf("ㄴ") !== 0 ||
                content.indexOf("ㄴㄴ") === 0
            ) {
                return false;
            }

            return true;
        },

        safeDelete(this: CommentClass): void {
            if (this.delete) {
                let password = "";

                if (this.comment.ip && this.comment.my_cmt !== "Y") {
                    password = prompt("비밀번호를 입력하세요.") || "";

                    if (!password) {
                        return;
                    }
                }

                this.delete(
                    this.comment.no,
                    password,
                    this.comment.my_cmt !== "Y" &&
                    document.querySelector(".useradmin_btnbox button") !== null
                );
            }
        },

        reply(this: CommentClass) {
            this.$emit("setReply", this.getReply() === this.comment.no ? null : this.comment.no);
        }
    }
};
</script>