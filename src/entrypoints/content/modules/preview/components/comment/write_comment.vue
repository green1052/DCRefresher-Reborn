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
                @change="(v: Event) => validCheck('id', (v.target as HTMLInputElement).value)"
            />
            <input
                v-model="unsignedUserPW"
                placeholder="비밀번호"
                type="password"
                @change="(v: Event) => validCheck('pw', (v.target as HTMLInputElement).value)"
            />
        </form>
        <div class="refresher-comment-body">
            <div
                :class="{ focus: focused, disable: disabled }"
                class="refresher-input-wrap"
            >
                <textarea
                    id="comment_main"
                    :disabled="disabled || dcconCount > 0"
                    :placeholder="dcconCount > 0 ? '디시콘이 선택됐습니다.' : '댓글 입력...'"
                    autocomplete="new-password"
                    @blur="blur"
                    @focus="focus"
                    @input="updateText"
                    @keydown="onKeyDown"
                />
            </div>
            <PreviewButton
                id="dccon"
                :click="renderDcconPopup"
                class="refresher-writecomment"
            />
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
                    'refresher-comment-util-show': !(hoverUserInfo && !user?.id)
                }"
                class="whoami"
            >
                <UserComponent
                    v-if="user"
                    :me="true"
                    :user="user"
                />
                <span>로 {{ reply?.commentNo ? "답글" : "" }} {{ dcconCount > 0 ? "디시콘" : "" }} 작성 중</span>
            </div>
            <div
                :class="{
                    'refresher-comment-util': true,
                    'refresher-comment-util-edit': true,
                    'refresher-comment-util-show': hoverUserInfo && user?.isLogout()
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
import {computed, inject, ref, type Ref} from "vue";
import toast from "@/utils/toast";

import PreviewButton from "@/components/previewButton.vue";
import UserComponent from "@/components/user.vue";
import {useCommentUser} from "../../composables/useCommentUser";

interface Props {
    func?: (
        type: "text" | "dccon",
        memo: string | DcinsideDccon[],
        commentNo: string | null,
        replyNo: string | null,
        user: { name: string; pw?: string },
        bigDccon: boolean
    ) => Promise<boolean>;
    reply?: { commentNo: string | null; replyNo: string | null };
    renderDcconPopup?: () => boolean;
    getDccon?: () => DcinsideDccon[];
    getBigDccon?: () => boolean;
}

const props = withDefaults(defineProps<Props>(), {
    func: undefined,
    reply: () => ({commentNo: null, replyNo: null}),
    renderDcconPopup: () => false,
    // 함수 타입 prop의 default는 팩토리가 아니라 값 그대로 쓰인다
    getDccon: () => [],
    getBigDccon: () => false
});

const emit = defineEmits<{
    setDccon: [dccons: DcinsideDccon[]];
    setBigDccon: [value: boolean];
    "update:reply": [reply: { commentNo: string | null; replyNo: string | null }];
}>();

const {user, unsignedUserID, unsignedUserPW, fixedUser, editUser, toggleEditUser, validCheck} = useCommentUser();

const focused = ref(false);
const disabled = ref(false);
const text = ref("");
const hoverUserInfo = ref(false);

const inputFocusRef = inject<Ref<boolean>>("refresherInputFocus", ref(false));

const dcconCount = computed(() => props.getDccon().length);

const updateText = (ev: InputEvent) => {
    text.value = (ev.target as HTMLTextAreaElement).value;
};

const renderDcconPopup = (): boolean => props.renderDcconPopup();

const write = async (): Promise<boolean> => {
    disabled.value = true;

    if (!fixedUser.value && (!unsignedUserID.value || !unsignedUserPW.value)) {
        toast.show("아이디 혹은 비밀번호를 입력하지 않았습니다.", "error");
        disabled.value = false;
        return false;
    }

    if (!props.func) return true;

    const dccons = props.getDccon();
    const bigDccon = props.getBigDccon();

    try {
        const result = await props.func(
            dccons.length > 0 ? "dccon" : "text",
            dccons.length > 0 ? dccons : text.value,
            props.reply?.commentNo ?? null,
            props.reply?.replyNo ?? null,
            fixedUser.value && user.value
                ? {name: user.value.nick}
                : {
                    name: unsignedUserID.value,
                    pw: unsignedUserPW.value
                },
            bigDccon
        );

        if (!result) {
            return false;
        }

        text.value = "";
        const commentMain = document.querySelector<HTMLInputElement>("#comment_main");
        if (commentMain) commentMain.value = "";

        emit("setDccon", []);
        emit("setBigDccon", false);
        emit("update:reply", {commentNo: null, replyNo: null});

        return result;
    } finally {
        disabled.value = false;
    }
};

const focus = (): void => {
    focused.value = true;
    inputFocusRef.value = true;
};

const blur = (): void => {
    focused.value = false;
    inputFocusRef.value = false;
};

const onKeyDown = (ev: KeyboardEvent): KeyboardEvent | void => {
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

        .refresher-input-wrap {
            &.disable {
                input {
                    color: rgb(63, 63, 63);
                }

                &::after {
                    background-color: rgb(38, 55, 73);
                }
            }

            textarea {
                border-bottom: 1px solid #fff;
                color: #fff;

                &:disabled {
                    border-bottom: 1px solid rgb(63, 63, 63);
                }
            }
        }
    }
}

.refresher-input-wrap {
    height: 45px;
    margin-right: 20px;
    min-width: 400px;
    position: relative;
    width: 80%;

    &.focus {
        &::after {
            width: calc(100% + 4px);
        }
    }

    &.disable {
        input {
            color: rgb(110, 110, 110);
        }

        &::after {
            background-color: rgb(38, 55, 73);
        }
    }

    &:has(textarea) {
        &::after {
            bottom: -6px;
        }
    }

    &:has(input) {
        &::after {
            bottom: -3px;
        }
    }

    &::after {
        background-color: var(--refresher-input-focus);
        content: " ";
        height: 2px;
        left: 0;
        position: absolute;
        transition: 0.3s all cubic-bezier(0.19, 1, 0.22, 1);
        width: 0;
        z-index: 10;
    }

    input,
    textarea {
        background: transparent;
        border: 0;
        border-bottom: 1px solid var(--refresher-input-border);
        color: var(--refresher-text);
        font-size: 14px;
        height: 100%;
        outline: none;
        transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
        width: 100%;
    }
}
</style>