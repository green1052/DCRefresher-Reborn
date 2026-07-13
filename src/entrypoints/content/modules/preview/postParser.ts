import {User} from "@/utils/user";

const domParser = new DOMParser();

const ISSUE_ZOOM_ID = /\$\(document\)\.data\('comment_id',\s'.+'\);/g;
const ISSUE_ZOOM_NO = /\$\(document\)\.data\('comment_no',\s'.+'\);/g;
const QUOTES = /(["'])(?:(?=(\\?))\2.)*?\1/g;

export function parsePostInfo(id: string, body: string): IPostInfo {
    const dom = domParser.parseFromString(body, "text/html");
    const postInfo: IPostInfo = {id};

    postInfo.dom = dom;
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

    postInfo.contents = contentQuery?.innerHTML ?? undefined;

    const zoomID = body.match(ISSUE_ZOOM_ID);
    const zoomNO = body.match(ISSUE_ZOOM_NO);

    if (zoomID && zoomID[0]) {
        postInfo.commentId = (zoomID[0].match(QUOTES) as string[])[1].replace(/'/g, "");
    }

    if (zoomNO && zoomNO[0]) {
        postInfo.commentNo = (zoomNO[0].match(QUOTES) as string[])[1].replace(/'/g, "");
    }

    postInfo.commentCount = Number(dom.querySelector<HTMLElement>(".gall_comment")?.textContent?.split(" ")[1]);

    const noticeElement = dom.querySelector<HTMLElement>(".user_control .option_box li:first-child");
    postInfo.isNotice = noticeElement?.innerHTML !== "공지 등록";
    postInfo.isAdult = dom.head.innerHTML.includes("/error/adult");
    postInfo.requireCaptcha = !!dom.querySelector(".recommend_kapcode");
    postInfo.requireCommentCaptcha = !!dom.querySelector(".cmt_write_box input[name=comment_code]");
    postInfo.disabledDownvote = !dom.querySelector(".btn_recommend_box .down_num");
    postInfo.user = User.fromDom(dom.querySelector(".gallview_head > .gall_writer"));

    const randomParam = dom.querySelector<HTMLInputElement>("#adult_article + input");
    if (randomParam) {
        postInfo.randomParam = {name: randomParam.name, value: randomParam.value};
        postInfo.v_cur_t = dom.querySelector<HTMLInputElement>("input[name=v_cur_t]")?.value;
    }

    return postInfo;
}