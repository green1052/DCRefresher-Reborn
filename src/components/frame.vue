<template>
    <div
        :class="{relative: frame.options.relative, blur: frame.options.blur, preview: frame.options.preview, center: frame.options.center}"
        class="refresher-frame">
        <div v-if="!frame.error" class="refresher-preview-info">
            <div class="refresher-preview-title-zone">
                <div :class="{'refresher-preview-title-text': true, 'refresher-title-post': frame.data.buttons}">
                    <transition appear name="refresher-slide-up" @before-enter="beforeEnter" @after-enter="afterEnter">
                        <div :key="frame.title" :data-index="index + 1" class="refresher-preview-title"
                             v-html="frame.title"/>
                    </transition>
                    <transition appear name="refresher-slide-up" @before-enter="beforeEnter" @after-enter="afterEnter">
                        <span class="refresher-preview-title-mute" v-html="frame.subtitle"/>
                    </transition>
                    <transition appear name="refresher-slide-up" @before-enter="beforeEnter" @after-enter="afterEnter"/>
                </div>
                <div v-if="frame.data.comments" class="refresher-comment-controls-container">
                    <PreviewButton v-if="frame.data.useWriteComment" :id="'dccon'" :click="renderDcconPopup"
                                   :text="'디시콘'"
                                   class="refresher-comment-controls"/>

                    <PreviewButton v-if="frame.data.useWriteComment" :id="'write'" :click="toCommentWrite"
                                   :text="'댓글 쓰기'"
                                   class="refresher-comment-controls"/>

                    <PreviewButton :id="'refresh'" :click="refresh" :text="'새로고침'" class="refresher-comment-controls"/>
                </div>
            </div>
            <div class="refresher-preview-meta">
                <User v-if="frame.data.user" :user="frame.data.user"/>
                <div class="float-right">
                    <div class="date-views">
                        <TimeStamp v-if="frame.data.date" :date="frame.data.date"/>
                        <span class="refresher-views" v-html="frame.data.views"/>
                    </div>
                    <CountDown v-if="frame.data.expire" :date="frame.data.expire"/>
                </div>
            </div>
        </div>
        <div v-if="!frame.error" :class="{collapse: frame.collapse}" class="refresher-preview-contents">
            <refresher-loader v-show="frame.data.load"/>
            <transition name="refresher-opacity">
                <div :key="frame.contents" class="refresher-preview-contents-actual" v-html="frame.contents"/>
            </transition>

            <div v-if="frame.data.comments && frame.data.comments.comments" class="refresher-preview-comments">
                <transition-group appear name="refresher-slide-up" @before-enter="beforeEnter"
                                  @after-enter="afterEnter">
                    <Comment v-for="(comment, i) in frame.data.comments.comments" :key="`cmt_${comment.no}`"
                             :comment="comment" :delete="frame.functions.deleteComment" :getReply="getReply"
                             :index="i + 1"
                             :postUser="frame.data.postUserId"
                             @setReply="setReply"/>
                </transition-group>
            </div>
            <div v-if="frame.data.comments && !frame.data.comments.comments">
                <div class="refresher-nocomment-wrap">
                    <img :src="getURL('/assets/icons/empty_comment.png')"/>
                    <h3>댓글이 없습니다.</h3>
                </div>
                <br>
            </div>
            <div v-if="frame.data.comments && frame.data.useWriteComment">
                <WriteComment :func="writeComment" :getDccon="getDccon" :getReply="getReply" @setDccon="setDccon"
                              @setReply="setReply"/>
            </div>
        </div>
        <div v-if="frame.collapse" class="refresher-collapse-text">
            <h3 @click="() => {frame.collapse = !frame.collapse; frame.functions.load()}">
                댓글 보기를 클릭하여 댓글만 표시합니다. 여기를 눌러 글을 볼 수 있습니다.
            </h3>
        </div>
        <div v-if="frame.error" class="refresher-preview-contents refresher-error">
            <h3>{{ frame.error.title }}을 불러올 수 없습니다.</h3>
            <br>
            <p>가능한 경우:</p>
            <ul v-if="frame.error.detail.includes('50')">
                <li>서버가 불안정합니다. 페이지를 다시 고쳐보세요.</li>
                <li>서버 구조 변경으로 인한 내용 해석 실패. 지속될 경우 개발자에게 문의하세요.</li>
                <li>네트워크 방화벽에 의해 차단되지는 않았는지 확인해보세요.</li>
            </ul>
            <ul v-else-if="frame.error.detail.includes('40')">
                <li>게시글이 이미 삭제됨</li>
                <li>게시글이 없음</li>
                <li>서버 구조 변경으로 인한 잘못된 값으로 요청. 지속될 경우 개발자에게 문의하세요.</li>
            </ul>
            <ul v-else-if="frame.error.detail.includes('Failed to fetch')">
                <li>연결 오류, 서버 오류일 가능성도 있습니다.</li>
                <li>브라우저 오류, 대부분 구현 오류로 확장 프로그램 업데이트가 필요합니다.</li>
                <li>서버 구조 변경으로 인한 잘못된 방식으로 요청. 지속될 경우 개발자에게 문의하세요.</li>
            </ul>
            <ul v-else>
                <li>알 수 없는 오류입니다. 아래 코드를 복사하여 개발자에게 문의해주세요.</li>
            </ul>
            <br>
            <PreviewButton id="refresh" :click="retry" class="refresher-writecomment primary"
                           text="다시 시도"/>
            <br>
            <span class="refresher-mute">{{ frame.error.detail }}</span>
        </div>
        <div v-if="frame.data.buttons && !frame.collapse" class="refresher-preview-votes">
            <div>
                <PreviewButton :id="'upvote'" :click="upvote"
                               :text="`${frame.upvotes} (${frame.fixedUpvotes})`" class="refresher-upvote"/>
                <PreviewButton v-if="!frame.data.disabledDownvote" :id="'downvote'" :click="downvote"
                               :text="frame.downvotes || '0'" class="refresher-downvote"/>
                <PreviewButton :id="'share'" :click="share" :text="'공유'" class="refresher-share primary"/>
                <PreviewButton :id="'newtab'" :click="original" :text="'원본 보기'"/>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import PreviewButton from "./button.vue";
import TimeStamp from "./timestamp.vue";
import CountDown from "./countdown.vue";
import User from "./user.vue";
import Comment from "./comment.vue";
import WriteComment from "./write_comment.vue";
import Icon from "./icon.vue";
import loader from "./loader.vue";
import Vue, {PropType} from "vue";
import browser from "webextension-polyfill";
import dccon from "./dccon.vue";

interface FrameData {
    memoText: string;
    reply: string | null;
    dccon: DcinsideDccon | null;
    dcconRender: Vue | null;
}

export default Vue.extend({
    name: "refresher-frame",
    components: {
        PreviewButton,
        TimeStamp,
        CountDown,
        User,
        Comment,
        WriteComment,
        Icon,
        "refresher-loader": loader
    },
    props: {
        frame: {
            type: Object as PropType<RefresherFrame>,
            required: true
        },
        index: {
            type: Number,
            required: true
        },
    },
    data: (): FrameData => {
        return {
            memoText: "",
            reply: null,
            dccon: null,
            dcconRender: null
        };
    },
    methods: {
        beforeEnter(el: HTMLElement) {
            el.style.transitionDelay = `${45 * Number(el.dataset.index)}ms`;
        },

        afterEnter(el: HTMLElement) {
            el.style.transitionDelay = "";
        },

        upvote() {
            return this.frame.functions.vote(1);
        },

        downvote() {
            return this.frame.functions.vote(0);
        },

        share() {
            return this.frame.functions.share();
        },

        retry() {
            return this.frame.functions.retry();
        },

        async writeComment(...args: any[]) {
            let result = false;

            if (this.frame.functions.writeComment) {
                result = await this.frame.functions.writeComment(...args);
            }

            this.frame.functions.retry();

            return result;
        },

        toCommentWrite() {
            document.getElementById("comment_main")?.focus();
            return true;
        },

        refresh() {
            this.frame.functions.retry();
            return true;
        },

        renderDcconPopup() {
            const element = document.createElement("div");
            document.body.appendChild(element);

            this.dcconRender = new Vue({
                el: element,
                render: h => h(dccon, {
                    on: {
                        clickDccon: this.clickDccon,
                        closeDccon: this.closeDccon
                    }
                })
            });
        },

        clickDccon(dccon: DcinsideDccon) {
            this.dccon = dccon;
            this.closeDccon();
        },

        closeDccon() {
            this.dcconRender?.$destroy();
            this.dcconRender?.$el.remove();

            this.dcconRender = null;
        },

        setDccon(value: DcinsideDccon | null) {
            this.dccon = value;
        },

        getDccon() {
            return this.dccon;
        },

        makeVoteRequest() {
        },

        original() {
            this.frame.functions.openOriginal();
            return true;
        },

        setReply(value: string | null) {
            this.reply = value;
        },

        getReply() {
            return this.reply;
        },

        getURL(u: string): string {
            return browser.runtime.getURL(u);
        }
    },
    created() {
        this.frame.app.$on("close", () => {
            this.reply = null;
            this.dccon = null;
            this.closeDccon();
        });
    }
});
</script>