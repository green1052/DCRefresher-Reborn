<template>
    <div class="refresher-write-comment">
        <div v-show="editUser" class="user">
            <input
                v-model="unsignedUserID"
                placeholder="닉네임"
                type="text"
                @change="(v) => validCheck('id', v.target.value)"
            />
            <div />
            <input
                v-model="unsignedUserPW"
                placeholder="비밀번호"
                type="password"
                @change="(v) => validCheck('pw', v.target.value)"
            />
        </div>
        <div class="refresher-comment-body">
            <div :class="{ focus: focused, disable: disabled }" class="refresher-input-wrap">
                <textarea
                    id="comment_main"
                    :disabled="disabled || this.getDccon().length > 0"
                    :placeholder="
                        !this.getDccon().length ? '댓글 입력...' : '디시콘이 선택됐습니다.'
                    "
                    autocomplete="off"
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
        <div @mouseleave="hoverUserInfo = false" @mouseover="hoverUserInfo = true">
            <div
                class="whoami"
                v-bind:class="{
                    'refresher-comment-util': true,
                    'refresher-comment-util-show': !(hoverUserInfo && !this.user.id)
                }"
            >
                <UserComponent v-if="user" :user="user" />
                <span
                    >로 {{ reply === null ? "" : "답글"
                    }}{{ !this.getDccon().length ? "" : "디시콘" }} 작성 중</span
                >
            </div>
            <div
                class="whoami"
                v-bind:class="{
                    'refresher-comment-util': true,
                    'refresher-comment-util-edit': true,
                    'refresher-comment-util-show': hoverUserInfo && this.user.isLogout()
                }"
            >
                <span @click="toggleEditUser"
                    >클릭하면 작성자 정보 수정 모드를
                    {{ editUser ? "비활성화" : "활성화" }}시킵니다.</span
                >
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { User } from "../utils/user";
import * as Toast from "./toast";
import button from "./button.vue";
import user from "./user.vue";
import Vue from "vue";
import { Nullable } from "../utils/types";
import $ from "cash-dom";

interface WriteCommentData {
    focused: boolean;
    disabled: boolean;
    text: string;
    editUser: boolean;
    fixedUser: boolean;
    hoverUserInfo: boolean;
    user: Nullable<User>;
    unsignedUserID: string;
    unsignedUserPW: string;
}

export default Vue.extend({
    name: "write_comment",
    components: {
        PreviewButton: button,
        UserComponent: user
    },
    data(): WriteCommentData {
        return {
            focused: false,
            disabled: false,
            text: "",
            editUser: false,
            fixedUser: false,
            hoverUserInfo: false,
            user: null,
            unsignedUserID: localStorage.nonmember_nick || "ㅇㅇ",
            unsignedUserPW: localStorage.nonmember_pw || Math.random().toString(36).substring(5)
        };
    },
    props: {
        func: {
            type: Function
        },

        reply: {
            type: String
        },

        getDccon: {
            type: Function
        }
    },
    watch: {
        unsignedUserID(value: string): void {
            if (!this.user) return;

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
            this.user = new User(this.unsignedUserID, null, "127.0.0.1", null);
        }
    },
    methods: {
        updateText(ev: InputEvent) {
            this.text = (ev.target as HTMLTextAreaElement).value;
        },

        validCheck(type: string, value: string): void {
            if (type === "id" && value.length < 1) {
                Toast.show(
                    `아이디는 최소 1자리 이상이어야 합니다. 자동으로 "ㅇㅇ"로 설정합니다.`,
                    false,
                    5000
                );
                this.unsignedUserID = "ㅇㅇ";
            }

            if (type === "pw" && value.length < 2) {
                const random = Math.random().toString(36).substring(5);

                Toast.show(
                    `비밀번호는 최소 2자리 이상이어야 합니다. 자동으로 "${random}"로 설정합니다.`,
                    false,
                    5000
                );
                this.unsignedUserPW = random;
            }
        },

        toggleEditUser(): void {
            if (this.user?.isLogout()) this.editUser = !this.editUser;
        },

        async write(): Promise<boolean> {
            this.disabled = true;

            if (!this.fixedUser && (!this.unsignedUserID || !this.unsignedUserPW)) {
                Toast.show("아이디 혹은 비밀번호를 입력하지 않았습니다.", true, 2000);
                return false;
            }

            if (!this.func) return true;

            const result = await this.func(
                !this.getDccon().length ? "text" : "dccon",
                this.getDccon().length ? this.getDccon() : this.text,
                this.reply,
                this.fixedUser
                    ? { name: this.user!.nick }
                    : {
                          name: this.unsignedUserID,
                          pw: this.unsignedUserPW
                      }
            );

            if (!result) {
                this.disabled = false;
                return false;
            }

            this.disabled = false;

            this.text = "";
            $("#comment_main").val("");

            this.$emit("setDccon", []);
            this.$emit("update:reply", null);

            return result;
        },

        focus(): void {
            this.focused = true;
            this.$root.$children[0].$data.inputFocus = true;
        },

        blur(): void {
            this.focused = false;
            this.$root.$children[0].$data.inputFocus = false;
        },

        type(ev: KeyboardEvent): KeyboardEvent | void {
            if (ev.shiftKey && ev.key === "Enter") {
                return ev;
            }

            if (ev.key !== "Enter") {
                return ev;
            }

            this.write();
        }
    }
});
</script>
