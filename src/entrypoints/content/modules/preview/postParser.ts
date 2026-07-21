import {User} from "@/utils/user";

const domParser = new DOMParser();

const ISSUE_ZOOM_ID = /\$\(document\)\.data\('comment_id',\s'.+'\);/g;
const ISSUE_ZOOM_NO = /\$\(document\)\.data\('comment_no',\s'.+'\);/g;
const QUOTES = /(["'])(?:(?=(\\?))\2.)*?\1/g;

// 게시글 메타데이터 추출
function parseMetadata(dom: Document, postInfo: IPostInfo): void {
    postInfo.header = dom.querySelector<HTMLElement>(".title_headtext")?.innerHTML?.replace(/(^\[.*]$)/g, "");
    postInfo.title = dom.querySelector<HTMLElement>(".title_subject")?.innerHTML ?? undefined;
    postInfo.date = dom.querySelector<HTMLElement>(".fl > .gall_date")?.innerHTML ?? undefined;
    postInfo.expire = dom
        .querySelector<HTMLElement>(".view_content_wrap div.fl > span.mini_autodeltime > div.pop_tipbox > div")
        ?.innerHTML?.replace(/\s자동\s삭제/, "");
    postInfo.views = dom
        .querySelector<HTMLElement>(".fr > .gall_count")
        ?.innerHTML?.replace(/조회\s/, "");
    postInfo.upvotes = dom
        .querySelector<HTMLElement>(".fr > .gall_reply_num")
        ?.innerHTML?.replace(/추천\s/, "");
    postInfo.fixedUpvotes = dom.querySelector<HTMLElement>(".sup_num > .smallnum")?.innerHTML ?? undefined;
    postInfo.downvotes = dom.querySelector<HTMLElement>("div.btn_recommend_box .down_num")?.innerHTML ?? undefined;
}

// 게시글 콘텐츠 추출 (writeDiv width 처리)
function parseContent(dom: Document): string | undefined {
    const contentQuery = dom.querySelector<HTMLElement>(".writing_view_box");
    const writeDiv = contentQuery?.querySelector<HTMLElement>(".write_div");

    if (writeDiv) {
        const width = writeDiv.style.width;
        if (width) {
            writeDiv.style.width = "unset";
            writeDiv.style.maxWidth = width;
            writeDiv.style.overflow = "";
        }
    }

    return contentQuery?.innerHTML ?? undefined;
}

// 댓글 정보 추출 (commentId, commentNo, commentCount)
function parseCommentInfo(body: string, dom: Document, postInfo: IPostInfo): void {
    const zoomID = body.match(ISSUE_ZOOM_ID);
    const zoomNO = body.match(ISSUE_ZOOM_NO);

    if (zoomID?.[0]) {
        const quotes = zoomID[0].match(QUOTES);
        if (quotes?.[1]) postInfo.commentId = quotes[1].replace(/'/g, "");
    }

    if (zoomNO?.[0]) {
        const quotes = zoomNO[0].match(QUOTES);
        if (quotes?.[1]) postInfo.commentNo = quotes[1].replace(/'/g, "");
    }

    postInfo.commentCount = Number(dom.querySelector<HTMLElement>(".gall_comment")?.textContent?.split(" ")[1]) || 0;
}

// 상태 플래그 및 사용자 정보 추출
function parseFlagsAndUser(dom: Document, postInfo: IPostInfo): void {
    const noticeElement = dom.querySelector<HTMLElement>(".user_control .option_box li:first-child");
    postInfo.isNotice = noticeElement?.innerHTML !== "공지 등록";
    postInfo.isAdult = dom.head.innerHTML.includes("/error/adult");
    postInfo.requireCaptcha = !!dom.querySelector(".recommend_kapcode");
    postInfo.requireCommentCaptcha = !!dom.querySelector(".cmt_write_box input[name=comment_code]");
    postInfo.disabledDownvote = !dom.querySelector(".btn_recommend_box .down_num");
    postInfo.user = User.fromDom(dom.querySelector(".gallview_head > .gall_writer"));
}

// 랜덤 파라미터 추출 (captcha 관련)
function parseRandomParams(dom: Document, postInfo: IPostInfo): void {
    const randomParam = dom.querySelector<HTMLInputElement>("#adult_article + input");
    if (randomParam) {
        postInfo.randomParam = {name: randomParam.name, value: randomParam.value};
        postInfo.v_cur_t = dom.querySelector<HTMLInputElement>("input[name=v_cur_t]")?.value;
    }
}

export function parsePostInfo(id: string, body: string): IPostInfo {
    const dom = domParser.parseFromString(body, "text/html");
    const postInfo: IPostInfo = {id};

    postInfo.dom = dom;

    parseMetadata(dom, postInfo);
    postInfo.contents = parseContent(dom);
    parseCommentInfo(body, dom, postInfo);
    parseFlagsAndUser(dom, postInfo);
    parseRandomParams(dom, postInfo);

    return postInfo;
}