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
        <FrameError
            v-if="frame.error"
            :error="frame.error"
            :retry="retry"
        />
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
                            @enter="onEnter"
                            @before-enter="beforeEnter"
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
                            @enter="onEnter"
                            @before-enter="beforeEnter"
                        >
                            <span class="refresher-preview-title-mute">{{ frame.subtitle }}</span>
                        </transition>
                    </div>

                    <div
                        v-if="frame.data.comments"
                        class="refresher-comment-controls-container"
                    >
                        <PreviewButton
                            v-if="frame.data.useWriteComment"
                            id="write"
                            :click="toCommentWrite"
                            class="refresher-comment-controls"
                        />
                        <PreviewButton
                            id="refresh"
                            :click="retry"
                            class="refresher-comment-controls"
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
                        <TimeStamp
                            v-if="frame.data.expire"
                            :date="frame.data.expire"
                            mode="remaining"
                        />
                    </div>
                </div>
            </div>

            <div
                v-if="frame.collapse"
                class="refresher-preview-contents"
            >
                <div class="refresher-collapse-text">
                    <h3 @click="expandCollapse">
                        댓글 보기를 클릭하여 댓글만 표시합니다. 여기를 눌러 글을 볼 수 있습니다.
                    </h3>
                </div>
            </div>
            <div
                v-else
                class="refresher-preview-contents"
            >
                <RefresherLoader v-show="showLoader"/>

                <transition
                    v-if="!frame.data.comments"
                    name="refresher-opacity"
                >
                    <div
                        :class="mediaBlockClass"
                        class="refresher-preview-contents-actual"
                        v-html="frame.contents"
                    />
                </transition>
                <div v-else>
                    <div v-if="!hasComments">
                        <div class="refresher-nocomment-wrap">
                            <h3>댓글이 없습니다.</h3>
                        </div>
                    </div>
                    <div
                        v-else
                        class="refresher-preview-comments"
                    >
                        <transition-group
                            :key="commentKey"
                            appear
                            name="refresher-slide-up"
                            @enter="onEnter"
                            @before-enter="beforeEnter"
                        >
                            <Comment
                                v-for="(comment, i) in visibleComments"
                                :key="comment.no"
                                v-model:reply="reply"
                                :collapsed="isCollapsed(comment)"
                                :comment="comment"
                                :delete="frame.functions.deleteComment"
                                :index="i + 1"
                                :last-reply="comment.depth === 1 && isLastReply(comment)"
                                :post-user="frame.data.postUserId"
                                :reply-count="replyCount(comment)"
                                :use-write-comment="frame.data.useWriteComment"
                                @toggle-collapse="toggleCollapse"
                            />
                        </transition-group>
                    </div>

                    <WriteComment
                        v-if="frame.data.useWriteComment"
                        v-model:reply="reply"
                        :func="writeComment"
                        :get-big-dccon="getBigDccon"
                        :get-dccon="getDccon"
                        :renderDcconPopup="renderDcconPopup"
                        @setBigDccon="setBigDccon"
                        @setDccon="setDccon"
                    />
                </div>
            </div>

            <FrameVotes
                v-if="showVotes"
                :disabled-downvote="frame.data.disabledDownvote"
                :downvote="downvote"
                :downvotes="frame.downvotes"
                :fixed-upvotes="frame.fixedUpvotes"
                :original="openOriginal"
                :share="share"
                :upvote="upvote"
                :upvotes="frame.upvotes"
            />
        </div>
    </div>
</template>

<script lang="ts" setup>
import {computed, onMounted, ref} from "vue";

import type {PreviewFrame} from "../../frame";
import Comment from "../comment/comment.vue";
import TimeStamp from "@/components/timestamp.vue";
import FrameError from "./frameError.vue";
import FrameVotes from "./frameVotes.vue";
import RefresherLoader from "@/components/loader.vue";
import PreviewButton from "@/components/previewButton.vue";
import User from "@/components/user.vue";
import WriteComment from "../comment/write_comment.vue";
import {useDcconPopup} from "@/entrypoints/content/composables/useDcconPopup";

interface Props {
    frame: PreviewFrame;
    index: number;
}

const props = defineProps<Props>();

const reply = ref({
    commentNo: null as string | null,
    replyNo: null as string | null
});
const commentKey = ref(0);

const {dccon, bigDccon, renderDcconPopup, closeDccon, setDccon, setBigDccon, getDccon, getBigDccon} = useDcconPopup();

const showLoader = computed(() =>
    props.frame.data.comments &&
    (!props.frame.data.comments.comments || props.frame.data.comments.comments.length === 0) &&
    props.frame.data.load
);

const mediaBlockClass = computed(() =>
    props.frame.data.useImageBlock && props.frame.data.type === "icon_txt"
        ? "refresher-preview-block-media"
        : ""
);

const hasComments = computed(() =>
    props.frame.data.comments?.comments && props.frame.data.comments.comments.length > 0
);

// ponytail: Map for collapse state. Set when collapse toggled; per-post reset via commentKey.
const collapsedParents = ref(new Set<string>());

const allComments = computed<DcinsideCommentObject[]>(() =>
    props.frame.data.comments?.comments ?? []
);

// 부모 no -> 마지막 답글 no 맵 (선 끝 처리용)
const lastReplyByParent = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const c of allComments.value) {
        if (c.depth === 1 && c.c_no) {
            map[c.c_no] = c.no;
        }
    }
    return map;
});

const replyCount = (comment: DcinsideCommentObject): number =>
    comment.depth === 0
        ? allComments.value.filter((c) => c.depth === 1 && c.c_no === comment.no).length
        : 0;

const isCollapsed = (comment: DcinsideCommentObject): boolean =>
    comment.depth === 0 && collapsedParents.value.has(comment.no);

const isLastReply = (comment: DcinsideCommentObject): boolean =>
    comment.depth === 1 && !!comment.c_no && lastReplyByParent.value[comment.c_no] === comment.no;

const toggleCollapse = (no: string) => {
    const next = new Set(collapsedParents.value);
    if (next.has(no)) next.delete(no);
    else next.add(no);
    collapsedParents.value = next;
};

const visibleComments = computed<DcinsideCommentObject[]>(() => {
    const list = allComments.value;
    if (list.length === 0) return list;
    const collapsed = collapsedParents.value;
    if (collapsed.size === 0) return list;
    return list.filter((c) =>
        c.depth === 0 || !collapsed.has(c.c_no as string)
    );
});

const showVotes = computed(() =>
    props.frame.data.comments === undefined && props.frame.data.buttons
);

const beforeEnter = (el: Element) => {
    (el as HTMLElement).style.transitionDelay = `${45 * Number((el as HTMLElement).dataset.index)}ms`;
};

const onEnter = (el: Element) => {
    (el as HTMLElement).style.transitionDelay = "";
};

const upvote = () => props.frame.functions.vote(1);
const downvote = () => props.frame.functions.vote(0);
const share = () => props.frame.functions.share();

const openOriginal = async (): Promise<boolean> => {
    void props.frame.functions.openOriginal();
    return true;
};

// 댓글 새로고침 (retry 래핑)
const retry = (): Promise<boolean> => {
    void props.frame.functions.retry(false);
    return Promise.resolve(true);
};

// 댓글 작성 영역으로 포커스 이동
const toCommentWrite = (): Promise<boolean> => {
    document.querySelector<HTMLElement>("#comment_main")?.focus();
    return Promise.resolve(true);
};

// 접힌 상태 펼치기
const expandCollapse = () => {
    props.frame.collapse = false;
    void props.frame.functions.load();
};

// 댓글 작성 후 새로고침
const writeComment = async (
    type: "text" | "dccon",
    memo: string | DcinsideDccon[],
    commentNo: string | null,
    replyNo: string | null,
    user: { name: string; pw?: string },
    selectedBigDccon: boolean
): Promise<boolean> => {
    try {
        // 실패(false)를 그대로 돌려줘야 write_comment가 입력 내용을 비우지 않는다
        const ok = await props.frame.functions.writeComment(type, memo, commentNo, replyNo, user, selectedBigDccon);
        if (ok) void retry();
        return ok;
    } catch {
        return false;
    }
};

// 프레임 닫힘 시 상태 초기화
const resetFrameState = () => {
    props.frame.reset();
    reply.value = {commentNo: null, replyNo: null};
    dccon.value = [];
    bigDccon.value = false;
    closeDccon();
    commentKey.value = 0;
    collapsedParents.value = new Set();
};

onMounted(() => {
    props.frame.onClose(resetFrameState);
});

const incrementCommentKey = () => {
    commentKey.value++;
    collapsedParents.value = new Set();
};

defineExpose({incrementCommentKey});
</script>

<style lang="scss">
@use "@/assets/styles/tokens" as *;

.refresher-frame {
    background-color: var(--refresher-bg);
    border-radius: $radius-md;
    box-shadow: $shadow-2dp;
    display: block;
    max-width: 700px;
    min-height: 100px;
    min-width: 100px;
    overflow: hidden;
    padding: 3vh 2.5vw;
    pointer-events: all;
    position: absolute;
    transform: translateY(10px);
    width: 70%;

    @media screen and (max-width: 900px) {
        max-width: 90%;
        padding: 3vh 4vw;
    }

    &.blur {
        backdrop-filter: blur(5px) saturate(150%);
        background-color: var(--refresher-bg-blur);
    }

    &.center {
        margin: auto;
    }

    &.preview {
        min-height: 100px;
        min-width: 30vw;
    }

    &.relative {
        margin-bottom: 10px;
        position: relative;
    }

    &.x-center {
        margin-left: auto;
        margin-right: auto;
    }

    &.y-center {
        margin-bottom: auto;
        margin-top: auto;
    }
}
</style>