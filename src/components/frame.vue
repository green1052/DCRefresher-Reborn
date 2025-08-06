<template>
    <div
        :class="{
            relative: frame.options.relative,
            blur: frame.options.blur,
            preview: frame.options.preview,
            center: frame.options.center
        }"
        class="refresher-frame"
    >
        <div
            v-if="frame.error"
            class="refresher-preview-contents refresher-error"
        >
            <h3>{{ frame.error.title || "알 수 없는 오류" }}</h3>
            <br />
            <br />
            <br />
            <p>가능한 경우:</p>

            <ul v-if="!frame.error.detail">
                <li>알 수 없는 오류가 발생했습니다.</li>
            </ul>
            <ul v-else-if="frame.error.detail.includes('Failed to fetch')">
                <li>연결 오류, 서버 오류일 가능성도 있습니다.</li>
                <li>브라우저 오류, 대부분 구현 오류로 확장 프로그램 업데이트가 필요합니다.</li>
                <li>서버 구조 변경으로 인한 잘못된 방식으로 요청. 지속될 경우 개발자에게 문의하세요.</li>
            </ul>
            <ul v-else-if="frame.error.detail.includes('40')">
                <li>게시글이 이미 삭제됨</li>
                <li>게시글이 없음</li>
                <li>서버 구조 변경으로 인한 잘못된 값으로 요청. 지속될 경우 개발자에게 문의하세요.</li>
            </ul>
            <ul v-else-if="frame.error.detail.includes('50')">
                <li>서버가 불안정합니다. 페이지를 다시 고쳐보세요.</li>
                <li>서버 구조 변경으로 인한 내용 해석 실패. 지속될 경우 개발자에게 문의하세요.</li>
                <li>네트워크 방화벽에 의해 차단되지는 않았는지 확인해보세요.</li>
            </ul>
            <ul v-else>
                <li>알 수 없는 오류입니다. 아래 코드를 복사하여 개발자에게 문의해주세요.</li>
            </ul>
            <br />
            <span class="refresher-mute">{{ frame.error.detail }}</span>
            <br />
            <br />
            <PreviewButton
                id="refresh"
                :click="retry"
                class="refresher-writecomment primary"
                text="다시 시도"
            />
        </div>
        <div v-else>
            <div class="refresher-preview-info">
                <div class="refresher-preview-title-zone">
                    <div
                        :class="{
                            'refresher-preview-title-text': true,
                            'refresher-title-post': frame.data.buttons
                        }"
                    >
                        <transition
                            appear
                            name="refresher-slide-up"
                            @before-enter="beforeEnter"
                            @after-enter="afterEnter"
                        >
                            <div
                                :key="frame.title"
                                :data-index="index + 1"
                                class="refresher-preview-title"
                                v-html="frame.title"
                            />
                        </transition>
                        <transition
                            appear
                            name="refresher-slide-up"
                            @before-enter="beforeEnter"
                            @after-enter="afterEnter"
                        >
                            <span
                                class="refresher-preview-title-mute"
                                v-html="frame.subtitle"
                            />
                        </transition>
                    </div>

                    <div
                        v-if="frame.data.comments"
                        class="refresher-comment-controls-container"
                    >
                        <template v-if="frame.data.useWriteComment">
                            <PreviewButton
                                id="dccon"
                                :click="renderDcconPopup"
                                class="refresher-comment-controls"
                                text="디시콘"
                            />

                            <PreviewButton
                                id="write"
                                :click="toCommentWrite"
                                class="refresher-comment-controls"
                                text="댓글 쓰기"
                            />
                        </template>

                        <PreviewButton
                            id="refresh"
                            :click="refresh"
                            class="refresher-comment-controls"
                            text="새로고침"
                        />
                    </div>
                </div>

                <div class="refresher-preview-meta">
                    <User
                        v-if="frame.data.user"
                        :user="frame.data.user"
                    />

                    <div class="float-right">
                        <div class="date-views">
                            <TimeStamp
                                v-if="frame.data.date"
                                :date="frame.data.date"
                            />
                            <span
                                class="refresher-views"
                                v-text="frame.data.views"
                            />
                        </div>
                        <CountDown
                            v-if="frame.data.expire"
                            :date="frame.data.expire"
                        />
                    </div>
                </div>
            </div>

            <div
                v-if="frame.collapse"
                class="refresher-preview-contents"
            >
                <div class="refresher-collapse-text">
                    <h3
                        @click="
                            () => {
                                frame.collapse = false;
                                frame.functions.load();
                            }
                        "
                    >
                        댓글 보기를 클릭하여 댓글만 표시합니다. 여기를 눌러 글을 볼 수 있습니다.
                    </h3>
                </div>
            </div>
            <div
                v-else
                class="refresher-preview-contents"
            >
                <RefresherLoader v-show="frame.data.load" />

                <transition
                    v-if="!frame.data.comments"
                    name="refresher-opacity"
                >
                    <div
                        :key="frame.contents"
                        :class="
                            frame.data.useImageBlock &&
                            frame.data.type === 'icon_txt' &&
                            'refresher-preview-block-media'
                        "
                        class="refresher-preview-contents-actual"
                        v-html="frame.contents"
                    />
                </transition>
                <div v-else>
                    <div v-if="!frame.data.comments.comments || frame.data.comments.comments.length === 0">
                        <div class="refresher-nocomment-wrap">
                            <img :src="getURL('/assets/icons/empty_comment.webp')" />
                            <h3>댓글이 없습니다.</h3>
                        </div>
                        <br />
                    </div>
                    <div
                        v-else
                        class="refresher-preview-comments"
                    >
                        <transition-group
                            :key="commentKey"
                            appear
                            name="refresher-slide-up"
                            @before-enter="beforeEnter"
                            @after-enter="afterEnter"
                        >
                            <Comment
                                v-for="(comment, i) in frame.data.comments.comments"
                                :key="comment.no"
                                :comment="comment"
                                :delete="frame.functions.deleteComment"
                                :index="i + 1"
                                :post-user="frame.data.postUserId"
                                :reply.sync="reply"
                                :use-write-comment="frame.data.useWriteComment"
                            />
                        </transition-group>
                    </div>

                    <div v-if="frame.data.useWriteComment">
                        <WriteComment
                            :func="writeComment"
                            :get-big-dccon="getBigDccon"
                            :get-dccon="getDccon"
                            :reply.sync="reply"
                            @setBigDccon="setBigDccon"
                            @setDccon="setDccon"
                        />
                    </div>
                </div>
            </div>
            <div
                v-if="frame.data.comments === undefined && frame.data.buttons"
                class="refresher-preview-votes"
            >
                <div>
                    <PreviewButton
                        id="upvote"
                        :click="upvote"
                        :text="
                            frame.upvotes === undefined && frame.fixedUpvotes === undefined
                                ? 'X'
                                : `${frame.upvotes} (${frame.fixedUpvotes})`
                        "
                        class="refresher-upvote"
                    />
                    <PreviewButton
                        v-if="!frame.data.disabledDownvote"
                        id="downvote"
                        :click="downvote"
                        :text="frame.downvotes ?? 'X'"
                        class="refresher-downvote"
                    />
                    <PreviewButton
                        id="share"
                        :click="share"
                        class="refresher-share primary"
                        text="공유"
                    />
                    <PreviewButton
                        id="newtab"
                        :click="original"
                        text="원본 보기"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import Vue, { getCurrentInstance, onBeforeUnmount, onMounted, ref } from "vue";

import getURL from "../utils/getURL";
import PreviewButton from "./button.vue";
import Comment from "./comment.vue";
import CountDown from "./countdown.vue";
import RefresherDcconPopup from "./dccon.vue";
import RefresherLoader from "./loader.vue";
import TimeStamp from "./timestamp.vue";
import User from "./user.vue";
import WriteComment from "./write_comment.vue";

interface Props {
    frame: RefresherFrame;
    index: number;
}

const props = defineProps<Props>();
const instance = getCurrentInstance();

const memoText = ref("");
const reply = ref({
    commentNo: null as string | null,
    replyNo: null as string | null
});
const dccon = ref<DcinsideDccon[]>([]);
const bigDccon = ref(false);
const dcconRender = ref<any>(null);
const commentKey = ref(0);

const beforeEnter = (el: HTMLElement) => {
    el.style.transitionDelay = `${45 * Number(el.dataset.index)}ms`;
};

const afterEnter = (el: HTMLElement) => {
    el.style.transitionDelay = "";
};

const upvote = () => {
    return props.frame.functions.vote(1);
};

const downvote = () => {
    return props.frame.functions.vote(0);
};

const share = () => {
    return props.frame.functions.share();
};

const retry = () => {
    return props.frame.functions.retry(false);
};

const writeComment = async (...args: any[]) => {
    try {
        await props.frame.functions.writeComment(...args);
        retry();
        return true;
    } catch {
        return false;
    }
};

const toCommentWrite = () => {
    const commentElement = document.querySelector<HTMLElement>("#comment_main");
    if (commentElement) {
        commentElement.focus();
    }
    return true;
};

const refresh = () => {
    retry();
    return true;
};

const renderDcconPopup = () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    dcconRender.value = new Vue({
        render: (h: any) =>
            h(RefresherDcconPopup, {
                on: {
                    clickDccon: clickDccon,
                    closeDccon: closeDccon
                }
            })
    }).$mount(element);

    return true;
};

const clickDccon = (selectedDccon: DcinsideDccon[], selectedBigDccon: boolean) => {
    dccon.value = selectedDccon;
    bigDccon.value = selectedBigDccon;
    closeDccon();
};

const closeDccon = () => {
    if (dcconRender.value) {
        dcconRender.value.$destroy();
        dcconRender.value.$el.remove();
        dcconRender.value = null;
    }
};

const setDccon = (value: DcinsideDccon[]) => {
    dccon.value = value;
};

const setBigDccon = (value: boolean) => {
    bigDccon.value = value;
};

const getDccon = () => {
    return dccon.value;
};

const getBigDccon = () => {
    return bigDccon.value;
};

const original = () => {
    props.frame.functions.openOriginal();
    return true;
};

onMounted(() => {
    props.frame.app.$on("close", () => {
        props.frame.title = "";
        props.frame.subtitle = "";
        props.frame.contents = undefined;
        props.frame.upvotes = undefined;
        props.frame.fixedUpvotes = undefined;
        props.frame.downvotes = undefined;
        props.frame.error = undefined;
        props.frame.collapse = undefined;
        props.frame.data = {};
        props.frame.functions = {};
        reply.value = {
            commentNo: null,
            replyNo: null
        };
        dccon.value = [];
        bigDccon.value = false;
        closeDccon();
        commentKey.value = 0;
    });
});

onBeforeUnmount(() => {
    closeDccon();
});
</script>
