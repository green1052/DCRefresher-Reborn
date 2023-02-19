<template>
    <div
        :data-deleted="comment.is_delete !== '0'"
        :data-depth="comment.depth"
        :data-rereply="rereply"
        class="refresher-comment">
        <div class="meta">
            <User
                :me="me"
                :user="comment.user" />
            <div class="float-right">
                <p
                    v-if="comment.depth === 0 && comment.is_delete === '0'"
                    class="refresher-reply"
                    @click="reply">
                    {{
                        this.getReply() === this.comment.no
                            ? "답글 해제"
                            : "답글"
                    }}
                </p>

                <TimeStamp :date="new Date(date(comment.reg_date))" />
                <div
                    v-if="
                        comment.is_delete === '0' &&
                        ((comment.del_btn === 'Y' && comment.my_cmt === 'Y') ||
                            isAdmin ||
                            comment.user.isLogout())
                    "
                    class="delete"
                    @click="this.safeDelete">
                    <svg
                        fill="black"
                        height="14px"
                        viewBox="0 0 24 24"
                        width="14px"
                        xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M0 0h24v24H0z"
                            fill="none" />
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </div>
            </div>
        </div>
        <div v-if="comment.vr_player">
            <iframe
                v-if="getVoiceData.iframe"
                :src="getVoiceData.src"
                height="54px"
                width="280px" />
            <audio
                v-else
                :src="getVoiceData.src"
                controls />
            <p v-if="getVoiceData.memo">{{ getVoiceData.memo }}</p>
        </div>
        <p
            v-else-if="/<(img|video) class=/.test(comment.memo)"
            :class="{ dccon: true }"
            class="refresher-comment-content"
            @contextmenu="contextMenu"
            v-html="comment.memo" />
        <p
            v-else
            class="refresher-comment-content"
            v-html="comment.memo.replaceAll('\n', '<br>')" />
    </div>
</template>

<script lang="ts">
    import { eventBus } from "../core/eventbus";
    import timestamp from "./timestamp.vue";
    import user from "./user.vue";
    import Vue, { PropType } from "vue";

    const NRegex = /(ㄴ)(\s)?([^ ]+)/g;

    interface CommentVueData {
        currentId: string;
        me: boolean;
        rereply: boolean;
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
                me: false,
                rereply: false
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

            postUser: {
                type: String
            },

            delete: {
                type: Function
            },

            getReply: {
                type: Function
            }
        },
        mounted(): void {
          console.log(this.comment);

            this.rereply = this.checkReReply();

            if (!this.comment.user.id) {
                return;
            }

            const gallogImageElement = document.querySelector(
                "#login_box .user_info .writer_nikcon > img"
            ) as HTMLImageElement;

            const click =
                gallogImageElement &&
                gallogImageElement.getAttribute("onclick");

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
                    (obj: IPostInfo) => {
                        this.me =
                            (obj.user && obj.user.id) === this.comment.user.id;
                    },
                    {
                        once: true
                    }
                );
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
                return (
                    document.querySelector(".useradmin_btnbox button") !== null
                );
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
                return match
                    ? match[0].replace(/gallog\.dcinside.com\/|'/g, "")
                    : null;
            },

            checkReReply(): boolean {
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

            safeDelete(): void {
                if (this.delete) {
                    let password: string = "";

                    if (this.comment.ip && this.comment.my_cmt !== "Y") {
                        password = prompt("비밀번호를 입력하세요.") ?? "";

                        if (!password) {
                            return;
                        }
                    }

                    this.delete(
                        this.comment.no,
                        password,
                        this.comment.my_cmt !== "Y" && this.isAdmin
                    );
                }
            },

            reply() {
                this.$emit(
                    "setReply",
                    this.getReply() === this.comment.no ? null : this.comment.no
                );
            },

            contextMenu(e: MouseEvent): void {
                const element = e.target as HTMLElement | null;

                if (!element || element.className !== "written_dccon") return;

                const src = element.getAttribute("src");
                if (!src) return;

                const code = src.replace(/^.*no=/g, "").replace(/^&.*$/g, "");

                eventBus.emit(
                    "refresherUserContextMenu",
                    null,
                    null,
                    null,
                    code,
                    null
                );
            }
        }
    });
</script>
