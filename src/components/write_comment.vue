<template>
    <div class="refresher-write-comment">
        <div v-show="editUser" class="user">
            <input v-model="unsignedUserID" placeholder="닉네임" type="text"
                   @change="(v) => validCheck('id', v.target.value)"/>
            <div/>
            <input v-model="unsignedUserPW" placeholder="비밀번호" type="password"
                   @change="(v) => validCheck('pw', v.target.value)"/>
        </div>
        <div class="refresher-comment-body">
            <div :class="{focus: focused, disable: disabled}" class="refresher-input-wrap">
                <input id="comment_main" v-model="text" :disabled="disabled"
                       :placeholder="this.getDccon() === null ? '댓글 입력...' : '디시콘이 선택됐습니다, 댓글 내용이 무시됩니다.'"
                       autocomplete="off" @blur="blur"
                       @focus="focus" @keydown="type"/>
            </div>
            <PreviewButton id="write" :click="write" class="refresher-writecomment primary" text="작성"/>
        </div>
        <div @mouseleave="hoverUserInfo = false" @mouseover="hoverUserInfo = true">
            <div class="whoami"
                 v-bind:class="{'refresher-comment-util': true, 'refresher-comment-util-show': !(hoverUserInfo && !this.user.id)}">
                <UserComponent :user="user"/>
                <span>
                    로 {{ this.getReply() === null ? "" : "답글" }} {{ this.getDccon() === null ? "" : "디시콘" }} 작성 중
                </span>
            </div>
            <div class="whoami"
                 v-bind:class="{'refresher-comment-util': true, 'refresher-comment-util-edit': true, 'refresher-comment-util-show': hoverUserInfo && !this.user.id}">
                <span @click="toggleEditUser">클릭하면 작성자 정보 수정 모드를 {{ editUser ? "비활성화" : "활성화" }}시킵니다.</span>
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
    data() {
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
        },

        getDccon: {
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
        const gallogName = document.querySelector("#login_box > .user_info .nickname > em");
        const fixedName = gallogName?.innerHTML;

        if (fixedName) {
            this.fixedUser = true;

            const gallogIcon = document.querySelector("#login_box > .user_info > .writer_nikcon")!;
            const attribute = gallogIcon.getAttribute("onclick")!;

            const id = /window\.open\('\/\/gallog\.dcinside\.com\/(\w*)'\);/.exec(attribute)![1];

            this.user = new User(fixedName, id, null, gallogIcon.querySelector("img")!.src);
        } else {
            this.user = new User(this.unsignedUserID, null, "localhost", null);
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
                    `비밀번호는 최소 2자리 이상이어야 합니다. 자동으로 "${random}" 으로 설정합니다.`,
                    false,
                    8000
                );
                this.unsignedUserPW = random;
            }
        },

        toggleEditUser(): void {
            if (this.user.isLogout())
                this.editUser = !this.editUser;
        },

        async write(): Promise<boolean> {
            this.disabled = true;

            if (!this.unsignedUserID || !this.unsignedUserPW) {
                Toast.show("아이디 혹은 비밀번호를 입력하지 않았습니다.", true, 2000);
                return false;
            }

            if (this.func) {
                const result = await this.func(
                    this.getDccon() === null ? "text" : "dccon",
                    this.getDccon() === null ? this.text : this.getDccon(),
                    this.getReply(),
                    this.fixedUser
                        ? {name: this.user.nick}
                        : {name: this.unsignedUserID, pw: this.unsignedUserPW}
                );

                this.disabled = false;
                this.text = "";
                this.$emit("setDccon", null);
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
