<template>
    <div class="refresher-write-comment">
        <div class="user" v-show="editUser">
            <input type="text" v-model="unsignedUserID" v-on:change="(v) => validCheck('id', v.target.value)"
                   placeholder="닉네임"/>
            <div></div>
            <input type="password" v-model="unsignedUserPW" v-on:change="(v) => validCheck('pw', v.target.value)"
                   placeholder="비밀번호"/>
        </div>
        <div class="refresher-comment-body">
            <div class="refresher-input-wrap" :class="{focus: focused, disable: disabled}">
                <input id="comment_main" placeholder="댓글 입력..." v-model="text" v-on:focus="focus" v-on:blur="blur" v-on:keydown="type" :disabled="disabled"/>
            </div>
            <PreviewButton class="refresher-writecomment primary" id="write" text="작성" :click="write"></PreviewButton>
        </div>
        <div @mouseover="hoverUserInfo = true" @mouseleave="hoverUserInfo = false">
            <div class="whoami"
                 v-bind:class="{'refresher-comment-util': true, 'refresher-comment-util-show': !(hoverUserInfo && !this.user.id)}">
                <UserComponent :user="user"></UserComponent>
                <span>로 {{ this.getReply() === null ? "" : "답글" }} 작성 중</span>
            </div>
            <div class="whoami"
                 v-bind:class="{'refresher-comment-util': true, 'refresher-comment-util-edit': true, 'refresher-comment-util-show': hoverUserInfo && !this.user.id}">
                <span v-on:click="toggleEditUser">클릭하면 작성자 정보 수정 모드를 {{ editUser ? "비활성화" : "활성화" }}시킵니다.</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import {User} from "../utils/user";
import * as Toast from "./toast";
import button from "./button.vue";
import user from "./user.vue";
import Vue from "vue";

export default Vue.extend({
    name: "write_comment",
    components: {
        PreviewButton: button,
        UserComponent: user,
    },
    data(): { [index: string]: unknown } {
        return {
            focused: false,
            disabled: false,
            text: "",
            editUser: false,
            fixedUser: false,
            hoverUserInfo: false,
            user: new User("", null, null, null),
            unsignedUserID: localStorage.nonmember_nick || "ㅇㅇ",
            unsignedUserPW:
                localStorage.nonmember_pw ||
                Math.random()
                    .toString(36)
                    .substring(5)
        };
    },
    props: {
        func: {
            type: Function
        },

        getReply: {
            type: Function
        }
    },
    watch: {
        unsignedUserID(value: string): void {
            localStorage.setItem("nonmember_nick", value);
            this.user.nick = value;
        },

        unsignedUserPW(value: string): void {
            localStorage.setItem("nonmember_pw", value);
        }
    },
    mounted(): void {
        const gallogName = document.querySelector(
            "#login_box .user_info .nickname em"
        ) as HTMLElement;

        const fixedName = gallogName && gallogName.innerHTML;

        if (fixedName) {
            this.fixedUser = true;

            const gallogIcon = document.querySelector(
                "#login_box .user_info .writer_nikcon img"
            ) as HTMLImageElement;

            const attribute = gallogIcon.getAttribute("onclick") as string;

            const id = attribute
                .replace(/window\.open\('\/\/gallog\.dcinside\.com\//g, "")
                .replace(/'\\;/g, "");

            this.user = new User(fixedName, id, null, gallogIcon.src);
        } else {
            this.user = new User(this.unsignedUserID ?? "ㅇㅇ", null, "*.*", null);
        }
    },
    methods: {
        validCheck(type: string, value: string): void {
            if (type === "id" && (!value || value.length < 2)) {
                Toast.show("아이디는 최소 2자리 이상이어야 합니다.", true, 2000);
                this.unsignedUserID = "ㅇㅇ";
            }

            if (type === "pw" && (!value || value.length < 2)) {
                const random = Math.random()
                    .toString(36)
                    .substring(5);

                Toast.show(
                    "비밀번호는 최소 2자리 이상이어야 합니다. 자동으로 \"" +
                    random +
                    "\" 으로 설정합니다.",
                    false,
                    8000
                );
                this.unsignedUserPW = random;
            }
        },

        toggleEditUser(): void {
            if (!this.user.id) {
                this.editUser = !this.editUser;
            }
        },

        async write(): Promise<boolean> {
            this.disabled = true;

            if (!this.unsignedUserID || !this.unsignedUserPW) {
                Toast.show("아이디 혹은 비밀번호를 입력하지 않았습니다.", true, 2000);
                return false;
            }

            if (this.func) {
                const result = await this.func(
                    "text",
                    this.text,
                    this.getReply(),
                    this.fixedUser
                        ? {name: this.user.nick}
                        : {name: this.unsignedUserID, pw: this.unsignedUserPW}
                );

                this.disabled = false;
                this.text = "";
                this.$emit("setReply", null);

                return result;
            }

            return true;
        },

        focus(): void {
            this.focused = true;
            this.$root.inputFocus = true;
        },

        blur(): void {
            this.focused = false;
            this.$root.inputFocus = false;
        },

        type(ev: KeyboardEvent): KeyboardEvent | void {
            if (ev.key !== "Enter") {
                return ev;
            }

            this.write();
        }
    }
});
</script>