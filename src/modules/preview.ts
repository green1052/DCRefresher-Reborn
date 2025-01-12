import * as Toast from "../components/toast";
import * as block from "../core/block";
import {submitComment} from "../utils/comment";
import {findNeighbor} from "../utils/dom";
import * as http from "../utils/http";
import {queryString} from "../utils/http";
import {ScrollDetection} from "../utils/scrollDetection";
import {User} from "../utils/user";
import $ from "cash-dom";
import Cookies from "js-cookie";
import ky, {Input, Options} from "ky";
// import Tesseract from "tesseract.js";
import browser from "webextension-polyfill";
import type IFrame from "../core/frame";
import * as storage from "../utils/storage";
import {inject} from "../utils/inject";

const domParser = new DOMParser();

class PostInfo implements IPostInfo {
    id: string;
    header?: string;
    title?: string;
    date?: string;
    expire?: string;
    user?: User;
    views?: string;
    fixedUpvotes?: string;
    upvotes?: string;
    downvotes?: string;
    contents?: string;
    commentId?: string;
    commentNo?: string;
    commentCount?: number;
    isNotice?: boolean;
    isAdult?: boolean;
    requireCaptcha?: boolean;
    requireCommentCaptcha?: boolean;
    disabledDownvote?: boolean;
    v_cur_t?: string;
    randomParam?: { name: string, value: string };
    dom?: Document;

    constructor(id: string) {
        this.id = id;
    }

    static parse(id: string, body: string): PostInfo {
        const postInfo = new PostInfo(id);

        postInfo.dom = domParser.parseFromString(body, "text/html");

        const $dom = $(postInfo.dom);

        postInfo.header = $dom
            .find(".title_headtext")
            .html()
            ?.replace(/(^\[.*]$)/g, "");
        postInfo.title = $dom.find(".title_subject").html();
        postInfo.date = $dom.find(".fl > .gall_date").html();
        postInfo.expire = $dom
            .find(
                ".view_content_wrap div.fl > span.mini_autodeltime > div.pop_tipbox > div"
            )
            .html()
            ?.replace(/\s자동\s삭제/, "");
        postInfo.views = $dom
            .find(".fr > .gall_count")
            .html()
            ?.replace(/조회\s/, "");
        postInfo.upvotes = $dom
            .find(".fr > .gall_reply_num")
            .html()
            ?.replace(/추천\s/, "");
        postInfo.fixedUpvotes = $dom.find(".sup_num > .smallnum").html();
        postInfo.downvotes = $dom
            .find("div.btn_recommend_box .down_num")
            .html();

        const $contentQuery = $dom.find(".writing_view_box");

        const $writeDiv = $contentQuery.find(".write_div");

        const width = $writeDiv.css("width");

        if (width) {
            $writeDiv.css("width", "unset");
            $writeDiv.css("max-width", width);
            $writeDiv.css("overflow", "");
        }

        postInfo.contents = $contentQuery.html();

        const zoomID = body.match(ISSUE_ZOOM_ID);
        const zoomNO = body.match(ISSUE_ZOOM_NO);

        if (zoomID && zoomID[0]) {
            postInfo.commentId = (
                zoomID[0].match(QUOTES) as string[]
            )[1].replace(/'/g, "");
        }

        if (zoomNO && zoomNO[0]) {
            postInfo.commentNo = (
                zoomNO[0].match(QUOTES) as string[]
            )[1].replace(/'/g, "");
        }

        postInfo.commentCount = Number($dom.find(".gall_comment").text().split(" ")[1]);

        const $noticeElement = $dom.find(
            ".user_control .option_box li:first-child"
        );

        postInfo.isNotice = $noticeElement.html() !== "공지 등록";
        postInfo.isAdult = postInfo.dom.head.innerHTML.includes("/error/adult");
        postInfo.requireCaptcha = $dom.find(".recommend_kapcode").length > 0;
        postInfo.requireCommentCaptcha =
            $dom.find(".cmt_write_box input[name=comment_code]").length > 0;

        postInfo.disabledDownvote =
            $dom.find(".btn_recommend_box .down_num").length === 0;

        postInfo.user = User.fromDom(
            postInfo.dom.querySelector(".gallview_head > .gall_writer")
        );

        const randomParam = postInfo.dom.querySelector<HTMLInputElement>("#adult_article + input");

        if (randomParam) {
            postInfo.randomParam = {
                name: randomParam.name,
                value: randomParam.value
            };

            postInfo.v_cur_t = postInfo.dom.querySelector<HTMLInputElement>("input[name=v_cur_t]")!.value;
        }

        return postInfo;
    }
}

interface GalleryHTTPRequestArguments {
    gallery: string;
    id: string;
    commentId?: string;
    commentNo?: string;
    link?: string;
}

let blurConfig = false;
let replyConfig = false;

(async () => {
    if (!await storage.get<boolean>("컨텐츠 차단.enable")) return;

    const [blur, replyRemove] = await Promise.all([
        storage.get<boolean>("컨텐츠 차단.blur"),
        storage.get<boolean>("컨텐츠 차단.replyRemove")
    ]);

    blurConfig = blur;
    replyConfig = replyRemove;
})();

const ISSUE_ZOOM_ID = /\$\(document\)\.data\('comment_id',\s'.+'\);/g;
const ISSUE_ZOOM_NO = /\$\(document\)\.data\('comment_no',\s'.+'\);/g;

const QUOTES = /(["'])(?:(?=(\\?))\2.)*?\1/g;

const kyClient = ky.create({
    method: "POST",
    headers: {
        "X-Requested-With": "XMLHttpRequest"
    }
});

const client = browser.runtime.getManifest().manifest_version === 2
    ? (url: URL | RequestInfo, init?: RequestInit | undefined): Promise<string> => {
        return content.fetch(url, {
            ...init,
            method: "POST",
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
            // @ts-ignore
        }).then(response => response.text());
    }
    : (url: Input, options?: Options): Promise<string> => {
        return kyClient(url, options).text();
    };

const request = {
    async bump(args: GalleryHTTPRequestArguments) {
        const galleryType = http.galleryType(location.href, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", args.gallery);
        params.set("nos[]", args.id);
        params.set("_GALLTYPE_", http.galleryTypeName(location.href));

        const response = await client(
            galleryType === "mini/"
                ? http.urls.manage.bumpMini
                : http.urls.manage.bump,
            {
                body: params
            }
        );

        try {
            return JSON.parse(response);
        } catch {
            return response;
        }
    },

    async vote(
        gall_id: string,
        post_id: string,
        type: number,
        code: string | undefined,
        link: string,
        v_cur_t?: string,
        randomParam?: { name: string, value: string }
    ) {
        Cookies.set(
            `${gall_id}${post_id}_Firstcheck${type ? "" : "_down"}`,
            "Y",
            {
                path: "/",
                domain: "dcinside.com",
                expires: new Date(new Date().getTime() + 3 * 60 * 60 * 1000)
            }
        );

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");

        if (v_cur_t) params.set("v_cur_t", v_cur_t);

        if (randomParam) params.set(randomParam.name, randomParam.value);

        params.set("id", gall_id);
        params.set("no", post_id);
        params.set("mode", type ? "U" : "D");
        params.set("code_recommend", code ?? "");
        params.set("_GALLTYPE_", http.galleryTypeName(link));
        params.set("link_id", gall_id);

        const response = await client(http.urls.vote, {body: params});

        const [result, counts, fixedCounts] = response.split("||");

        return {
            result,
            counts,
            fixedCounts
        };
    },

    async post(
        link: string,
        gallery: string,
        id: string,
        signal: AbortSignal
    ): Promise<PostInfo> {
        const response = await ky
            .get(
                `${http.urls.base}${http.galleryType(link, "/")}${
                    http.urls.view
                }${gallery}&no=${id}`,
                {signal}
            )
            .text();
        return PostInfo.parse(id, response);
    },

    /**
     * 디시인사이드 서버에 댓글을 요청합니다.
     * @param args
     * @param signal
     */
    async comments(args: GalleryHTTPRequestArguments, signal: AbortSignal) {
        if (!args.link)
            throw "link 값이 주어지지 않았습니다. (확장 프로그램 오류)";

        // const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("id", args.gallery);
        params.set("no", args.id);
        params.set("cmt_id", args.commentId ?? args.gallery);
        params.set("cmt_no", args.commentNo ?? args.id);
        params.set("e_s_n_o", $("#e_s_n_o").val() as string);
        params.set("comment_page", "1");
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await client(http.urls.comments, {
            body: params,
            signal
        });

        return JSON.parse(response);
    },

    async delete(args: GalleryHTTPRequestArguments, password?: string) {
        if (!args.link)
            throw "link 값이 주어지지 않았습니다. (확장 프로그램 오류)";

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", args.gallery);
        params.set("nos[]", args.id);
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await client(
            galleryType === "mini/"
                ? http.urls.manage.deleteMini
                : http.urls.manage.delete,
            {
                body: params
            }
        );

        try {
            return JSON.parse(response);
        } catch {
            return response;
        }
    },

    async block(
        args: GalleryHTTPRequestArguments,
        avoid_hour: number,
        avoid_reason: number,
        avoid_reason_txt: string,
        del_chk: number,
        user_type: number
    ) {
        if (!args.link)
            throw "link 값이 주어지지 않았습니다. (확장 프로그램 오류)";

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", args.gallery);
        params.set("nos[]", args.id);
        params.set("parent", "");
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));
        params.set("avoid_hour", avoid_hour.toString());
        params.set("avoid_reason", avoid_reason.toString());
        params.set("avoid_reason_txt", avoid_reason_txt);
        params.set("del_chk", del_chk.toString());
        params.set("avoid_type_chk", user_type.toString());

        const response = await client(
            galleryType == "mini/"
                ? http.urls.manage.blockMini
                : http.urls.manage.block,
            {
                body: params
            }
        );

        try {
            return JSON.parse(response);
        } catch {
            return response;
        }
    },

    async setNotice(args: GalleryHTTPRequestArguments, set: boolean): Promise<string | {
        msg: string,
        result: "success" | "fail"
    }> {
        if (!args.link) {
            throw "link 값이 주어지지 않았습니다. (확장 프로그램 오류)";
        }

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("mode", set ? "SET" : "REL");
        params.set("id", args.gallery);
        params.set("no", args.id);
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await client(
            galleryType == "mini/"
                ? http.urls.manage.setNoticeMini
                : http.urls.manage.setNotice,
            {
                body: params
            }
        );

        try {
            return JSON.parse(response);
        } catch {
            return response;
        }
    },

    async setRecommend(args: GalleryHTTPRequestArguments, set: boolean): Promise<string | {
        msg: string,
        result: "success" | "fail"
    }> {
        if (!args.link)
            throw "link 값이 주어지지 않았습니다. (확장 프로그램 오류)";

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", args.gallery);
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));
        params.set("mode", set ? "SET" : "REL");
        params.set("nos[]", args.id);

        const response = await client(
            galleryType == "mini/"
                ? http.urls.manage.setRecommendMini
                : http.urls.manage.setRecommend,
            {
                body: params
            }
        );

        try {
            return JSON.parse(response);
        } catch {
            return response;
        }
    },

    async captcha(
        args: GalleryHTTPRequestArguments,
        kcaptchaType: "comment" | "recommend"
    ) {
        if (!args.link)
            throw "link 값이 주어지지 않았습니다. (확장 프로그램 오류)";

        // const galleryType = http.galleryType(args.link, "/");
        const galleryTypeName = http.galleryTypeName(args.link);

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("gall_id", args.gallery);
        params.set("kcaptcha_type", kcaptchaType);
        params.set("_GALLTYPE_", galleryTypeName);

        await client(http.urls.captcha, {body: params});

        return (
            "/kcaptcha/image/?gall_id=" +
            args.gallery +
            "&kcaptcha_type=" +
            kcaptchaType +
            "&time=" +
            new Date().getTime() +
            "&_GALLTYPE_=" +
            galleryTypeName
        );
    },

    async adminDeleteComment(
        preData: GalleryPreData,
        commentId: string,
        signal: AbortSignal
    ): Promise<boolean | string> {
        if (!preData.link) return false;

        const typeName = http.galleryTypeName(preData.link);

        if (!typeName.length) return false;

        const url = http.checkMini(preData.link)
            ? http.urls.manage.deleteCommentMini
            : http.urls.manage.deleteComment;

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", preData.gallery);
        params.set("_GALLTYPE_", typeName);
        params.set("pno", preData.id);
        params.set("cmt_nos[]", commentId);

        return client(url, {body: params, signal})
            .then((v) => v)
            .catch(() => false);
    },

    async userDeleteComment(
        preData: GalleryPreData,
        commentId: string,
        signal: AbortSignal,
        password?: string
    ): Promise<boolean | string> {
        if (!preData.link) return false;

        const typeName = http.galleryTypeName(preData.link);

        if (!typeName.length) return false;

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", preData.gallery);
        params.set("re_no", commentId);
        params.set("mode", "del");
        params.set("g-recaptcha-response", "");
        params.set("_GALLTYPE_", typeName);
        params.set("no", preData.id);

        if (password) {
            params.set("re_password", password);
        }

        return client(http.urls.comment_remove, {body: params, signal})
            .then((v) => v)
            .catch(() => false);
    }
};

const KEY_COUNTS: Record<string, [number, number]> = {};
let adminKeyPress: (ev: KeyboardEvent) => void;

const panel = {
    block: (
        callback: (
            avoid_hour: number,
            avoid_reason: number,
            avoid_reason_txt: string,
            del_chk: number,
            userType: number
        ) => void,
        closeCallback: () => void
    ) => {
        const element = document.createElement("div");
        element.className = "refresher-block-popup";

        element.innerHTML = `
      <div class="close">
        <div class="cross"></div>
        <div class="cross"></div>
      </div>
      <div class="contents">
        <div class="block">
          <h3>차단 기간</h3>
          <div class="block_duration">
            <label><input type="radio" name="duration" value="1" checked="checked" />1시간</label>
            <label><input type="radio" name="duration" value="6" />6시간</label>
            <label><input type="radio" name="duration" value="24" />24시간</label>
            <label><input type="radio" name="duration" value="168" />7일</label>
            <label><input type="radio" name="duration" value="336" />14일</label>
            <label><input type="radio" name="duration" value="720" />30일</label>
          </div>
        </div>
        <div class="block">
          <h3>차단 사유</h3>
          <div class="block_reason">
            <label><input type="radio" name="reason" value="1" checked="checked" />음란성</label>
            <label><input type="radio" name="reason" value="2"/>광고</label>
            <label><input type="radio" name="reason" value="3"/>욕설</label>
            <label><input type="radio" name="reason" value="4"/>도배</label>
            <label><input type="radio" name="reason" value="5"/>저작권 침해</label>
            <label><input type="radio" name="reason" value="6"/>명예훼손</label>
            <label><input type="radio" name="reason" value="0"/>직접 입력</label>
          </div>
          <input type="text" name="reason_text" style="display: none;" placeholder="차단 사유 직접 입력 (한글 20자 이내)"></input>
        </div>
        <div class="block">
          <h3>선택한 글 삭제</h3>
          <input type="checkbox" name="remove"></input>
          
          <h3>식별 코드 차단 시 IP 동시 차단</h3>
          <input type="checkbox" name="user-type"></input>
          
          <button class="go-block">차단</button>
        </div>
      </div>
    `;

        let avoid_hour = 1;
        let avoid_reason = 1;

        element.querySelector(".close")?.addEventListener("click", () => {
            closeCallback();
        });

        element.querySelectorAll("input[type=radio]").forEach((v) => {
            v.addEventListener("click", (ev) => {
                const selected = ev.target as HTMLInputElement;

                if (!selected) {
                    return;
                }

                if (selected.getAttribute("name") === "duration") {
                    avoid_hour = Number(selected.value);
                }

                if (selected.getAttribute("name") === "reason") {
                    const value = Number(selected.value);

                    const blockReasonInput = document.querySelector<HTMLInputElement>("input[name=reason_text]")!;

                    blockReasonInput.style.display = value ? "none" : "block";
                    avoid_reason = value;
                }
            });
        });

        element.querySelector(".go-block")!.addEventListener("click", () => {
            const avoid_reason_txt = element.querySelector<HTMLInputElement>(
                `input[name=reason_text]`
            )!.value;
            const del_chk =
                element.querySelector<HTMLInputElement>(
                    `input[name=remove]`
                )!.checked;

            const userType = element.querySelector<HTMLInputElement>(
                "input[name=user-type]"
            )!.checked;

            callback(
                avoid_hour,
                avoid_reason,
                avoid_reason_txt,
                del_chk ? 1 : 0,
                userType ? 1 : 0
            );
        });

        document.body.appendChild(element);
    },

    admin: (
        preData: GalleryPreData,
        frame: IFrame,
        toggleBlur: boolean,
        eventBus: RefresherEventBus,
        useKeyPress: boolean
    ) => {
        const preFoundBlockElement = document.querySelector(
            ".refresher-block-popup"
        );

        preFoundBlockElement?.parentElement?.removeChild(preFoundBlockElement);

        const preFoundElement = document.querySelector(
            ".refresher-management-panel"
        );

        preFoundElement?.parentElement?.removeChild(preFoundElement);

        let setAsNotice = !preData.notice;
        let setAsRecommend = !preData.recommend;

        const element = document.createElement("div");
        element.id = "refresher-management-panel";
        element.className = "refresher-management-panel";

        if (toggleBlur) element.classList.add("blur");

        const upvoteImage = browser.runtime.getURL("/assets/icons/upvote.webp");
        const downvoteImage = browser.runtime.getURL(
            "/assets/icons/downvote.webp"
        );

        element.innerHTML = `
      <div class="button pin">
        <img src="${browser.runtime.getURL("/assets/icons/pin.webp")}"></img>
        <p>${setAsNotice ? "공지로 등록" : "공지 등록 해제"}</p>
      </div>
      <div class="button recommend">
        <img src="${setAsRecommend ? upvoteImage : downvoteImage}"></img>
        <p>${setAsRecommend ? "개념글 등록" : "개념글 해제"}</p>
      </div>
      <div class="button block">
        <img src="${browser.runtime.getURL("/assets/icons/block.webp")}"></img>
        <p>차단 (B)</p>
      </div>
      <div class="button delete">
        <img src="${browser.runtime.getURL("/assets/icons/delete.webp")}"></img>
        <p>삭제 (D)</p>
      </div>
      <div class="button bump">
        <img src="${browser.runtime.getURL("/assets/icons/upvote.webp")}"></img>
        <p>끌올</p>
      </div>
    `;

        const deleteFunction = () => {
            frame.app.close();

            request.delete(preData).then((response) => {
                eventBus.emit("refreshRequest");

                if (typeof response === "object") {
                    if (response.result === "success") {
                        Toast.show(response.msg, false, 3000);
                    } else {
                        Toast.show(response.msg, true, 3000);
                    }

                    return;
                }

                Toast.show(response, true, 3000);
            });
        };

        const blockFunction = () => {
            frame.app.close();

            request
                .block(
                    preData,
                    Number(blockPreset.day),
                    0,
                    blockPreset.reason,
                    blockPreset.delete ? 1 : 0,
                    blockPreset.user_type ? 1 : 0
                )
                .then((response) => {
                    eventBus.emit("refreshRequest");

                    if (typeof response === "object") {
                        if (response.result === "success") {
                            Toast.show(response.msg, false, 3000);
                        } else {
                            Toast.show(response.msg, true, 3000);
                        }

                        return;
                    }

                    Toast.show(response, true, 3000);
                });
        };

        element.querySelector(".delete")?.addEventListener("click", deleteFunction);

        if (adminKeyPress) {
            document.removeEventListener("keypress", adminKeyPress);
        }

        if (useKeyPress) {
            adminKeyPress = (ev: KeyboardEvent) => {
                if (frame.app.inputFocus) {
                    return ev;
                }

                if (ev.code !== "KeyB" && ev.code !== "KeyD") {
                    return ev;
                }

                if (KEY_COUNTS[ev.code]) {
                    if (Date.now() - KEY_COUNTS[ev.code][0] > 1000) {
                        KEY_COUNTS[ev.code] = [Date.now(), 0];
                    }
                } else {
                    KEY_COUNTS[ev.code] = [Date.now(), 0];
                }

                KEY_COUNTS[ev.code][0] = Date.now();
                KEY_COUNTS[ev.code][1]++;

                if (ev.code === "KeyD") {
                    if (KEY_COUNTS[ev.code][1] >= 2) {
                        deleteFunction();
                        KEY_COUNTS[ev.code][1] = 0;
                    } else {
                        Toast.show(
                            "한번 더 D키를 누르면 게시글을 삭제합니다.",
                            true,
                            1000
                        );
                    }
                } else if (ev.code === "KeyB") {
                    if (KEY_COUNTS[ev.code][1] >= 2) {
                        blockFunction();
                        KEY_COUNTS[ev.code][1] = 0;
                    } else {
                        Toast.show(
                            "한번 더 B키를 누르면 차단합니다.",
                            true,
                            1000
                        );
                    }
                }
            };
        }

        document.addEventListener("keypress", adminKeyPress);

        element.querySelector(".block")!.addEventListener("click", () => {
            panel.block(
                (
                    avoid_hour: number,
                    avoid_reason: number,
                    avoid_reason_txt: string,
                    del_chk: number,
                    user_type: number
                ) => {
                    request
                        .block(
                            preData,
                            avoid_hour,
                            avoid_reason,
                            avoid_reason_txt,
                            del_chk,
                            user_type
                        )
                        .then((response) => {
                            eventBus.emit("refreshRequest");

                            if (typeof response === "object") {
                                if (response.result === "success") {
                                    Toast.show(response.msg, false, 3000);

                                    if (del_chk) {
                                        frame.app.close();
                                    }
                                } else {
                                    Toast.show(response.msg, true, 3000);
                                }

                                return;
                            }

                            Toast.show(response, true, 3000);
                        });
                },
                () => document.querySelector(".refresher-block-popup")?.remove()
            );
        });

        const pin = element.querySelector<HTMLElement>(".pin")!;
        pin.addEventListener("click", () => {
            request.setNotice(preData, setAsNotice).then((response) => {
                eventBus.emit("refreshRequest");

                if (typeof response === "object") {
                    if (response.result === "success") {
                        Toast.show(response.msg, false, 3000);

                        setAsNotice = !setAsNotice;

                        const pinP = pin.querySelector<HTMLElement>("p")!;

                        pinP.innerHTML = setAsNotice
                            ? "공지로 등록"
                            : "공지 등록 해제";
                    } else {
                        Toast.show(response.msg, true, 3000);
                    }

                    return;
                }

                Toast.show(response, true, 3000);
            });
        });

        const recommend = element.querySelector<HTMLElement>(".recommend")!;
        recommend.addEventListener("click", () => {
            request.setRecommend(preData, setAsRecommend).then((response) => {
                eventBus.emit("refreshRequest");

                if (typeof response === "object") {
                    if (response.result === "success") {
                        Toast.show(response.msg, false, 3000);

                        setAsRecommend = !setAsRecommend;

                        const recommendImg = recommend.querySelector(
                            "img"
                        ) as HTMLImageElement;
                        recommendImg.src = setAsRecommend
                            ? upvoteImage
                            : downvoteImage;

                        const recommendP = recommend.querySelector(
                            "p"
                        ) as HTMLParagraphElement;
                        recommendP.innerHTML = setAsRecommend
                            ? "개념글 등록"
                            : "개념글 해제";
                    } else {
                        Toast.show(response.msg, true, 3000);
                    }

                    return;
                }

                Toast.show(response, true, 3000);
            });
        });

        const bump = element.querySelector<HTMLElement>(".bump")!;
        bump.addEventListener("click", () => {
            request.bump(preData).then((response) => {
                eventBus.emit("refreshRequest");

                if (typeof response === "object") {
                    if (response.result === "success") {
                        Toast.show(response.msg, false, 3000);
                    } else {
                        Toast.show(response.msg, true, 3000);
                    }

                    return;
                }

                Toast.show(response, true, 3000);
            });
        });

        document.body.appendChild(element);

        return element;
    },

    async captcha(
        src: string,
        callback: (captcha: string) => void,
        bypassCaptcha: boolean
    ): Promise<boolean> {
        const image = await ky.get(`https://gall.dcinside.com/${src}`).blob();
        const url = URL.createObjectURL(image);

        const element = document.createElement("div");
        element.className = "refresher-captcha-popup";

        element.innerHTML = `
    <p>코드 입력</p>
    <div class="close">
      <div class="cross"></div>
      <div class="cross"></div>
    </div>
    <img src="${url}"></img>
    <input type="text"></input>
    <button class="refresher-preview-button primary">
      <p class="refresher-vote-text">전송</p>
    </button>
    `;

        const inputEvent = () => {
            const input = element.querySelector("input")!.value;

            if (!input) return;

            callback(input);
            element.parentElement!.removeChild(element);
        };

        element.querySelector("input")!.addEventListener("keydown", (e) => {
            if (e.key === "Enter") inputEvent();
        });

        element.querySelector(".close")!.addEventListener("click", () => {
            URL.revokeObjectURL(url);
            element.parentElement!.removeChild(element);
        });

        element.querySelector("button")!.addEventListener("click", inputEvent);

        document.body.appendChild(element);

        setTimeout(() => {
            element.querySelector("input")!.focus();
        }, 0);

        // if (bypassCaptcha) {
        //     const worker = await Tesseract.createWorker();
        //
        //     try {
        //         await worker.loadLanguage("eng");
        //         await worker.initialize("eng");
        //         await worker.setParameters({
        //             tessedit_char_whitelist:
        //                 "0123456789abcdefghijklmnopqrstuvwxyz"
        //         });
        //
        //         const {
        //             data: {text}
        //         } = await worker.recognize(image);
        //         element.querySelector("input")!.value = text;
        //     } catch (e) {
        //         Toast.show("자동 인식에 실패했습니다.", true, 3000);
        //     } finally {
        //         await worker.terminate();
        //     }
        // }

        return true;
    }
};

const getRelevantData = (ev: MouseEvent) => {
    const target = ev.target as HTMLElement;
    const isTR = target.tagName === "TR";

    const listID = isTR
        ? target.querySelector<HTMLElement>(".gall_num")
        : findNeighbor(target, ".gall_num", 5, null);

    let id = "";
    let gallery = "";
    let title = "";
    let link = "";
    let notice = false;
    let recommend = false;

    let linkElement: HTMLLinkElement | null;

    if (listID) {
        if (listID.innerText === "공지") {
            let href: string;

            if (isTR) {
                href = document.querySelector("a")?.getAttribute("href") ?? "";
            } else {
                href =
                    findNeighbor(target, "a", 5, null)?.getAttribute("href") ??
                    "";
            }

            id = new URLSearchParams(href).get("no") ?? "";
            notice = true;
        } else {
            id = listID.innerText;
        }

        const emElement = isTR
            ? target.querySelector("em.icon_img")
            : findNeighbor(target, "em.icon_img", 5, null);
        if (emElement) {
            recommend = emElement.classList.contains("icon_recomimg");
        }

        linkElement = isTR
            ? target.querySelector<HTMLLinkElement>("a:not(.reply_numbox)")
            : (findNeighbor(
                target,
                "a:not(.reply_numbox)",
                3,
                null
            ) as HTMLLinkElement);

        if (linkElement) title = linkElement.innerText;
    } else {
        linkElement = isTR
            ? target.querySelector<HTMLLinkElement>("a")
            : (findNeighbor(
                ev.target as HTMLElement,
                "a",
                2,
                null
            ) as HTMLLinkElement);

        const pt = isTR
            ? target.querySelector(".txt_box")
            : findNeighbor(ev.target as HTMLElement, ".txt_box", 2, null);
        if (pt) title = pt.innerHTML;
    }

    if (linkElement) {
        link = linkElement.href;

        const linkNumberMatch = link.match(/&no=.+/);
        const linkIdMatch = link.match(/id=.+/);

        if (!linkNumberMatch || !linkIdMatch) {
            return;
        }

        id = linkNumberMatch[0].replace("&no=", "").replace(/&.+/g, "");
        gallery = linkIdMatch[0].replace(/id=/g, "").replace(/&.+/g, "");
    }

    return {
        id,
        gallery,
        title,
        link,
        notice,
        recommend
    };
};

interface Cache {
    date: number;
    post?: PostInfo;
    comment?: DcinsideComments;
    deleted?: boolean;
}

class PostCache {
    #caches: Record<string, Cache> = {};

    constructor(public maxCacheSize: number = 100) {
    }

    public get(id: string): Cache | undefined {
        const cache = this.#caches[id];

        if (!cache) return undefined;

        // 1분이 지나면 캐시를 삭제합니다.
        if (Date.now() - cache.date > 1000 * 60) {
            this.delete(id);
            return undefined;
        }

        return cache;
    }

    public set(id: string, data: Cache): void {
        if (Object.keys(this.#caches).length > this.maxCacheSize) {
            const lastCache = Object.entries(this.#caches)[0]![0];
            this.delete(lastCache);
        }

        this.#caches[id] = {
            ...(this.get(id) ?? {}),
            ...data
        };
    }

    public delete(id: string): boolean {
        if (!this.#caches[id]) return false;

        delete this.#caches[id];
        return true;
    }
}

const postCaches = new PostCache();

const miniPreview: MiniPreview = {
    element: document.createElement("div"),
    init: false,
    lastRequest: 0,
    controller: new AbortController(),
    lastElement: null,
    lastTimeout: 0,
    shouldOutHandle: false,
    cursorOut: false,
    create(ev, use, hide, interaction) {
        if (!use) return;

        miniPreview.cursorOut = false;

        if (Date.now() - miniPreview.lastRequest < 150) {
            miniPreview.lastRequest = Date.now();
            miniPreview.lastElement = ev.target;

            if (miniPreview.lastTimeout) clearTimeout(miniPreview.lastTimeout);

            miniPreview.lastTimeout = window.setTimeout(() => {
                if (
                    !miniPreview.cursorOut &&
                    miniPreview.lastElement === ev.target
                ) {
                    miniPreview.create(ev, use, hide, interaction);
                }

                miniPreview.cursorOut = false;
            }, 150);

            return;
        }

        miniPreview.lastRequest = Date.now();

        const preData = getRelevantData(ev);

        if (!preData) return;

        miniPreview.element.classList.remove("hide");
        miniPreview.element.classList.add("refresher-mini-preview");

        if (!miniPreview.init) {
            if (interaction) {
                miniPreview.element.style.pointerEvents = "auto";
                miniPreview.element.style.overflow = "auto";
            }

            miniPreview.element.innerHTML = `<h3>${
                preData.title
            }</h3><br><div class="refresher-mini-preview-contents${
                hide ? " media-hide" : ""
            }"></div>${interaction ? "" : "<p class=read-more>더 읽으려면 클릭하세요.</p>"}`;
            document.body.appendChild(miniPreview.element);
            miniPreview.init = true;
        }

        const selector = miniPreview.element.querySelector(
            ".refresher-mini-preview-contents"
        );

        if (!selector) return;

        new Promise<PostInfo>((resolve, reject) => {
            const cache = postCaches.get(`${preData.gallery}${preData.id}`);

            if (cache?.post) {
                resolve(cache.post);
                return;
            }

            request
                .post(
                    preData.link,
                    preData.gallery,
                    preData.id,
                    miniPreview.controller.signal
                )
                .then((response) => {
                    if (!response) {
                        reject();
                        return;
                    }

                    postCaches.set(`${preData.gallery}${preData.id}`, {
                        date: Date.now(),
                        post: response
                    });
                    resolve(response);
                })
                .catch((error) => {
                    reject(error);
                });
        })
            .then((v) => {
                const content = v.contents ?? "";

                selector.innerHTML = block.check("TEXT", content)
                    ? "게시글 내용이 차단됐습니다."
                    : content;
                selector.querySelector(".write_div")?.setAttribute("style", "");
            })
            .catch((error) => {
                selector.innerHTML = error.toString().includes("aborted")
                    ? ""
                    : `게시글을 새로 가져올 수 없습니다: ${error}`;
            });

        miniPreview.element.querySelector("h3")!.innerHTML = preData.title;
    },

    move(ev: MouseEvent, use: boolean, interaction: boolean) {
        if (!use) return;

        const rect = miniPreview.element.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const x = Math.min(interaction ? ev.clientX + 10 : ev.clientX, innerWidth - width - 10);
        const y = Math.min(interaction ? ev.clientY - 50 : ev.clientY, innerHeight - height - 10);

        miniPreview.element.style.transform = `translate(${x}px, ${y}px)`;
    },

    close(use: boolean) {
        if (document.querySelector("div:hover")?.classList.contains("refresher-mini-preview")) return;

        miniPreview.cursorOut = true;

        const h3 = miniPreview.element.querySelector("h3");

        if (h3)
            h3.innerHTML = "로딩 중...";

        const contents = miniPreview.element.querySelector(".refresher-mini-preview-contents");

        if (contents)
            contents.innerHTML = "로딩 중...";

        if (use) {
            miniPreview.controller.abort();
            miniPreview.controller = new AbortController();
        }

        miniPreview.element.classList.add("hide");
    }
};

let frame: IFrame;

const blockPreset = {
    day: "",
    reason: "",
    delete: false,
    user_type: false
};

export default {
    name: "미리보기",
    description: "글을 오른쪽 클릭 했을때 미리보기 창을 만들어줍니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    memory: {
        preventOpen: false,
        lastPress: 0,
        uuid: null,
        popStateHandler: null,
        signal: null,
        historyClose: false,
        titleStore: null,
        urlStore: null,
        refreshIntervalId: null
    },
    enable: true,
    default_enable: true,
    settings: {
        tooltipMode: {
            name: "툴팁 미리보기 표시",
            desc: "마우스를 올려두면 글 내용만 빠르게 볼 수 있는 툴팁을 추가합니다.",
            type: "check",
            default: false
        },
        tooltipMediaHide: {
            name: "툴팁 미리보기 미디어 숨기기",
            desc: "툴팁 미리보기 화면에서 미디어를 숨깁니다.",
            type: "check",
            default: false
        },
        tooltipDelay: {
            name: "툴팁 미리보기 딜레이",
            desc: "툴팁 미리보기가 나타나기까지의 시간을 설정합니다.",
            type: "range",
            default: 0,
            min: 0,
            max: 1000,
            step: 50,
            unit: "ms"
        },
        tooltipInteraction: {
            name: "툴팁 미리보기 상호작용",
            desc: "툴팁 미리보기에서 마우스 클릭이나 휠 스크롤을 가능하게 합니다. (툴팁 미리보기 딜레이 설정 필수)",
            type: "check",
            default: false
        },
        reversePreviewKey: {
            name: "키 반전",
            desc: "오른쪽 버튼 대신 왼쪽 버튼으로 미리보기를 엽니다.",
            type: "check",
            default: false
        },
        longPressDelay: {
            name: "기본 마우스 오른쪽 클릭 딜레이",
            desc: "마우스 오른쪽 버튼을 해당 밀리초 이상 눌러 뗄 때 기본 우클릭 메뉴가 나오게 합니다.",
            type: "range",
            default: 300,
            min: 200,
            max: 2000,
            step: 50,
            unit: "ms"
        },
        scrollToSkip: {
            name: "스크롤하여 게시글 이동",
            desc: "맨 위나 아래로 스크롤하여 다음 게시글로 이동할 수 있게 합니다.",
            type: "check",
            default: true
        },
        colorPreviewLink: {
            name: "게시글 URL 변경",
            desc: "미리보기를 열면 게시글의 URL을 변경하여 브라우저 탐색으로 게시글을 바꿀 수 있게 해줍니다.",
            type: "check",
            default: true
        },
        autoRefreshComment: {
            name: "댓글 자동 새로고침",
            desc: "댓글을 일정 주기마다 자동으로 새로고침합니다.",
            type: "check",
            default: false
        },
        commentRefreshInterval: {
            name: "댓글 자동 새로고침 주기",
            desc: "위의 옵션이 켜져있을 시 댓글을 새로고침할 주기를 설정합니다.",
            type: "range",
            default: 10000,
            min: 1000,
            max: 20000,
            step: 100,
            unit: "ms"
        },
        toggleBlur: {
            name: "게시글 배경 블러 활성화",
            desc: "미리보기 창의 배경을 블러 처리하여 미관을 돋보이게 합니다. (성능 하락 영향 있음)",
            type: "check",
            default: true
        },
        toggleBackgroundBlur: {
            name: "바깥 배경 블러 활성화",
            desc: "미리보기 창의 바깥 배경을 블러 처리하여 미관을 돋보이게 합니다. (성능 하락 영향 있음)",
            type: "check",
            default: false
        },
        toggleAdminPanel: {
            name: "관리 패널 활성화",
            desc: "갤러리에 관리 권한이 있는 경우 창 옆에 관리 패널을 표시합니다.",
            type: "check",
            default: true
        },
        useKeyPress: {
            name: "관리 패널 > 키 제어",
            desc: "관리 패널이 활성화된 경우 단축키를 눌러 빠르게 관리할 수 있습니다.",
            type: "check",
            default: true
        },
        blockPresetDay: {
            name: "관리 패널 > 차단 프리셋 > 차단 기간",
            desc: "차단 시 기본으로 선택할 차단 기간을 설정합니다.",
            type: "option",
            default: "1",
            items: {
                "1": "1시간",
                "6": "6시간",
                "24": "1일",
                "168": "7일",
                "336": "14일",
                "720": "30일"
            }
        },
        blockPresetReason: {
            name: "관리 패널 > 차단 프리셋 > 차단 사유",
            desc: "차단 시 기본으로 선택할 차단 사유를 설정합니다.",
            type: "text",
            default: ""
        },
        blockPresetDelete: {
            name: "관리 패널 > 차단 프리셋 > 선택한 글 삭제",
            desc: "차단 시 선택한 글을 삭제합니다.",
            type: "check",
            default: false
        },
        blockPresetUserType: {
            name: "관리 패널 > 차단 프리셋 > 식별 코드 차단 시 IP 동시 차단",
            desc: "차단 시 선택한 글을 삭제합니다.",
            type: "check",
            default: false
        },
        expandRecognizeRange: {
            name: "게시글 목록 인식 범위 확장",
            desc: "게시글의 오른쪽 클릭을 인식하는 범위를 칸 전체로 확장합니다.",
            type: "check",
            default: false
        },
        experimentalComment: {
            name: "댓글 기능 활성화",
            desc: "댓글을 작성할 수 있습니다.",
            type: "check",
            default: false
        },
        bypassCaptcha: {
            name: "캡차 자동 완성 (비활성화)",
            desc: "캡차를 자동으로 입력합니다.",
            type: "check",
            default: false
        },
        disableCache: {
            name: "캐시 비활성화",
            desc: "캐시를 사용하지 않습니다. (툴팁 미리보기 제외)",
            type: "check",
            default: false
        },
        archiveArticle: {
            name: "삭제된 글 & 댓글 보존",
            desc: "삭제된 글과 댓글을 보존합니다. (캐시 비활성화 시 작동 안함, 글 보존 기능 작동 안함)",
            type: "check",
            default: false
        }
    },
    require: ["filter", "eventBus", "Frame", "http"],
    func(
        filter,
        eventBus,
        Frame,
        http
    ) {
        inject("../assets/js/grecaptcha.js");

        blockPreset.day = this.status.blockPresetDay;
        blockPreset.reason = this.status.blockPresetReason;
        blockPreset.delete = this.status.blockPresetDelete;
        blockPreset.user_type = this.status.blockPresetUserType;

        let postFetchedData: PostInfo;
        const gallery = queryString("id") ?? undefined;

        const makeFirstFrame = (
            frame: RefresherFrame,
            preData: GalleryPreData,
            signal: AbortSignal,
            historySkip?: boolean
        ) => {
            frame.data.load = true;
            frame.title = preData.title!;
            frame.data.buttons = true;

            if (this.status.colorPreviewLink) {
                const title = `${preData.title} - ${document.title
                    .split("-")
                    .slice(-1)[0]
                    .trim()}`;

                if (!historySkip) {
                    history.pushState(
                        {preData, preURL: location.href},
                        title,
                        preData.link
                    );
                }

                document.title = title;
            }

            frame.functions.vote = async (type: number) => {
                if (frame.collapse) {
                    Toast.show(
                        "댓글 보기를 클릭하여 댓글만 표시합니다.",
                        true,
                        3000
                    );
                    return false;
                }

                if (!postFetchedData) {
                    Toast.show(
                        "게시글이 로딩될 때까지 잠시 기다려주세요.",
                        true,
                        3000
                    );
                    return false;
                }

                const codeSrc = postFetchedData.requireCaptcha
                    ? await request.captcha(preData, "recommend")
                    : undefined;

                const req = async (captcha?: string) => {
                    const res = await request.vote(
                        preData.gallery,
                        preData.id,
                        type,
                        captcha ?? undefined,
                        preData.link!,
                        postFetchedData.v_cur_t,
                        postFetchedData.randomParam
                    );

                    if (res.result === "true") {
                        frame[type ? "upvotes" : "downvotes"] = res.counts.replace(
                            /\B(?=(\d{3})+(?!\d))/g,
                            ",");

                        return true;
                    }

                    Toast.show(res.counts, true, 2000);

                    return false;
                };

                return codeSrc
                    ? panel.captcha(codeSrc, req, this.status.bypassCaptcha)
                    : req();
            };

            frame.functions.share = () => {
                navigator.clipboard.writeText(
                    `https://gall.dcinside.com/${http.galleryType(
                        preData.link!
                    )}/board/view/?id=${
                        preData.gallery || http.queryString("id")
                    }&no=${preData.id}`
                );

                Toast.show("클립보드에 복사되었습니다.", false, 3000);

                return true;
            };

            frame.functions.load = async (useCache = true) => {
                frame.data.load = true;
                frame.error = undefined;

                const getPostInfo = async (): Promise<PostInfo> => {
                    if (useCache && !this.status.disableCache) {
                        const cache = postCaches.get(`${preData.gallery}${preData.id}`);

                        if (cache?.post !== undefined) {
                            return cache.post;
                        }
                    }

                    const response = await request
                        .post(
                            preData.link!,
                            preData.gallery,
                            preData.id,
                            signal
                        );

                    if (!response)
                        throw "Can not fetch post data.";

                    postCaches.set(`${preData.gallery}${preData.id}`, {
                        date: Date.now(),
                        post: response
                    });

                    return response;
                };

                try {
                    const postInfo = await getPostInfo();
                    postFetchedData = postInfo;

                    if (this.status.colorPreviewLink) {
                        const title = `${postInfo.title} - ${document.title
                            .split("-")
                            .slice(-1)[0]
                            .trim()}`;

                        if (!historySkip) {
                            preData.title = postInfo.title;
                            history.replaceState(
                                {preData, preURL: location.href},
                                title,
                                preData.link
                            );
                        }

                        document.title = title;
                    }

                    try {
                        if (postInfo.isAdult) {
                            frame.error = {
                                title: "성인 인증이 필요한 게시글입니다.",
                                detail: "성인 인증을 하신 후 다시 시도해주세요."
                            };

                            return;
                        }

                        frame.contents = block.check(
                            "TEXT",
                            postInfo.contents ?? "",
                            gallery
                        )
                            ? "게시글 내용이 차단됐습니다."
                            : postInfo.contents;
                        frame.upvotes = postInfo.upvotes;
                        frame.fixedUpvotes = postInfo.fixedUpvotes;
                        frame.downvotes = postInfo.downvotes;

                        if (frame.title !== postInfo.title)
                            frame.title = postInfo.title!;

                        frame.data.disabledDownvote =
                            postInfo.disabledDownvote ?? false;

                        frame.data.user = postInfo.user;

                        if (postInfo.date) {
                            frame.data.date = new Date(
                                postInfo.date.replace(/\./g, "-")
                            );
                        }

                        if (postInfo.expire) {
                            frame.data.expire = new Date(postInfo.expire);
                        }

                        frame.data.buttons = true;
                        frame.data.views = `조회 ${postInfo.views}회`;
                    } finally {
                        eventBus.emit("RefresherPostDataLoaded", postInfo);
                        eventBus.emit(
                            "RefresherPostCommentIDLoaded",
                            postInfo.commentId,
                            postInfo.commentNo
                        );
                        eventBus.emitNextTick("contentPreview", frame.app.$el);
                    }
                } catch (error) {
                    frame.error = {
                        title: "게시글",
                        detail: String(error)
                    };

                    console.log("Error occured while loading a post.", error);
                } finally {
                    frame.data.load = false;
                }
            };

            frame.functions.retry = (useCache = false) => {
                frame.functions.load(useCache);
            };

            if (!frame.collapse) frame.functions.load();

            frame.functions.openOriginal = () => {
                if (this.status.colorPreviewLink) location.reload();
                else location.href = preData.link!;

                return true;
            };
        };

        const makeSecondFrame = (
            frame: RefresherFrame,
            preData: GalleryPreData,
            signal: AbortSignal
        ) => {
            frame.data.load = true;
            frame.title = "댓글";
            frame.subtitle = "로딩 중...";
            frame.data.useWriteComment = this.status.experimentalComment;

            let postDom: Document;

            new Promise<GalleryPreData>((resolve) => {
                eventBus.on(
                    "RefresherPostCommentIDLoaded",
                    (commentId: string, commentNo: string) =>
                        resolve({
                            gallery: commentId,
                            id: commentNo
                        }),
                    {
                        once: true
                    }
                );
            }).then((postData) => {
                postDom = postFetchedData.dom!;

                frame.functions.writeComment = async (
                    type: "text" | "dccon",
                    memo: string | DcinsideDccon[],
                    reply: string | null,
                    user: { name: string; pw?: string }
                ) => {
                    if (!postFetchedData) {
                        Toast.show(
                            "게시글이 로딩될 때까지 잠시 기다려주세요.",
                            true,
                            3000
                        );
                        return false;
                    }

                    const requireCapCode =
                        postFetchedData.requireCommentCaptcha;

                    const codeSrc = requireCapCode
                        ? await request.captcha(preData, "comment")
                        : undefined;

                    const getGreCaptchaToken = () => new Promise<string>((resolve) => {
                        window.postMessage({
                            type: "refresherGrecaptcha",
                            action: "comment_token"
                        }, "*");

                        window.addEventListener("message", (ev) => {
                            if (ev.data.type !== "refresherGrecaptchaToken") return;
                            resolve(ev.data.token);
                        });
                    });

                    const grecaptcha = await getGreCaptchaToken();

                    const req = async (captcha?: string) => {
                        const res = await submitComment(
                            postData,
                            user,
                            postDom,
                            memo,
                            reply,
                            captcha,
                            grecaptcha
                        );

                        if (
                            res.result === "false" ||
                            res.result === "PreNotWorking"
                        ) {
                            Toast.show(res.message!, true, 3000);
                            return false;
                        } else {
                            return true;
                        }
                    };

                    return codeSrc
                        ? await panel.captcha(
                            codeSrc,
                            req,
                            this.status.bypassCaptcha
                        )
                        : req();
                };

                if (this.memory.refreshIntervalId)
                    clearInterval(this.memory.refreshIntervalId);

                this.memory.refreshIntervalId = window.setInterval(() => {
                    if (this.status.autoRefreshComment) frame.functions.retry(false);
                }, this.status.commentRefreshInterval);
            });

            const deletePressCount: Record<string, number> = {};

            frame.functions.deleteComment = async (
                commentId: string,
                password: string,
                admin: boolean
            ) => {
                if (!preData.link) return false;

                if (!password) {
                    if (deletePressCount[commentId] + 1000 < Date.now()) {
                        deletePressCount[commentId] = 0;
                    }

                    if (!deletePressCount[commentId]) {
                        Toast.show(
                            "한번 더 누르면 댓글을 삭제합니다.",
                            true,
                            1000
                        );

                        deletePressCount[commentId] = Date.now();

                        return false;
                    }

                    deletePressCount[commentId] = 0;
                }

                const typeName = http.galleryTypeName(preData.link);
                if (!typeName.length) return false;

                return (
                    admin && !password
                        ? request.adminDeleteComment(preData, commentId, signal)
                        : request.userDeleteComment(
                            preData,
                            commentId,
                            signal,
                            password
                        )
                )
                    .then((v) => {
                        if (typeof v === "boolean") {
                            if (!v) return false;

                            return v;
                        }

                        if (v.includes("||")) {
                            const parsed = v.split("||");

                            if (parsed[0] !== "true") {
                                Toast.show(parsed[1], true, 3000);

                                return false;
                            }
                        }

                        if (v[0] !== "{") {
                            if (v !== "true") {
                                Toast.show(v, true, 3000);
                                return false;
                            }

                            Toast.show("댓글을 삭제하였습니다.", false, 3000);
                        } else {
                            const parsed = JSON.parse(v);

                            if (parsed.result !== "fail") {
                                Toast.show(
                                    "댓글을 삭제하였습니다.",
                                    false,
                                    3000
                                );
                            } else {
                                Toast.show(parsed.msg, true, 5000);
                            }
                        }

                        frame.functions.retry();

                        return true;
                    })
                    .catch(() => false);
            };

            frame.functions.load = async (useCache = true) => {
                frame.data.load = true;
                frame.error = undefined;

                const getCommentInfo = async (): Promise<DcinsideComments> => {
                    if (useCache && !this.status.disableCache) {
                        const cache = postCaches.get(
                            `${preData.gallery}${preData.id}`
                        );

                        if (cache?.comment && postFetchedData.commentCount === cache.comment.total_cnt) {
                            return cache.comment;
                        }
                    }

                    const response = await request
                        .comments(
                            {
                                link: preData.link!,
                                gallery: preData.gallery,
                                id: preData.id
                            },
                            signal
                        );

                    if (!response)
                        throw "Can not fetch comment data.";

                    return response;
                };

                try {
                    const comments = await getCommentInfo();
                    let threadCounts = 0;
                    let commentCounts = 0;
                    let needRefresh = false;

                    if (comments.comments) {
                        const cache = postCaches.get(`${preData.gallery}${preData.id}`);
                        const cacheComment = cache?.comment?.comments;

                        comments.comments = comments.comments.filter((v: DcinsideCommentObject) => v.nicktype !== "COMMENT_BOY");

                        if (this.status.archiveArticle && cacheComment) {
                            cacheComment.forEach((v: DcinsideCommentObject) => {
                                if (!comments.comments!.find((c: DcinsideCommentObject) => c.no === v.no)) {
                                    needRefresh = true;
                                    v.is_delete = "1";

                                    if (v.depth === 1) {
                                        const copy = [...comments.comments!];

                                        let findReply = false;
                                        let isBig = false;

                                        const parent = copy.reverse().find((c: DcinsideCommentObject) => {
                                            if (c.c_no === v.c_no) {
                                                if (c.no > v.no) {
                                                    isBig = true;
                                                }

                                                findReply = true;
                                                return true;
                                            }

                                            return c.no === v.c_no;
                                        });

                                        comments.comments!.splice(comments.comments!.indexOf(parent!) + (findReply && isBig ? 0 : 1), 0, v);

                                        return;
                                    }

                                    comments.comments!.push(v);
                                }

                                const orgIndex = comments.comments!.findIndex((c: DcinsideCommentObject) => c.no === v.no && c.is_delete !== "0");

                                if (orgIndex !== -1) {
                                    v.is_delete = "2";
                                    comments.comments!.splice(orgIndex, 1, v);
                                }
                            });
                        }

                        postCaches.set(`${preData.gallery}${preData.id}`, {
                            date: Date.now(),
                            comment: comments
                        });

                        comments.comments.map(
                            (v: DcinsideCommentObject) => {
                                v.user = new User(
                                    v.name,
                                    v.user_id || null,
                                    v.ip || null,
                                    domParser
                                        .parseFromString(
                                            v.gallog_icon,
                                            "text/html"
                                        )
                                        .querySelector(
                                            "a.writer_nikcon img"
                                        )
                                        ?.getAttribute("src") || null
                                );
                            }
                        );

                        let parentComment: DcinsideCommentObject | null = null;

                        comments.comments = comments.comments.filter(
                            (comment: DcinsideCommentObject) => {
                                if (replyConfig && comment.c_no === parentComment?.no) {
                                    if (blurConfig) {
                                        comment.memo = "댓글 내용이 차단됐습니다.";
                                        comment.is_delete = "1";
                                    } else {
                                        return false;
                                    }
                                }

                                const check: {
                                    [index in RefresherBlockType]?: string;
                                } = {
                                    NICK: comment.name
                                };

                                if (comment.user_id) {
                                    check.ID = comment.user_id;
                                }

                                if (comment.ip) {
                                    check.IP = comment.ip;
                                }

                                if (
                                    /<(img|video) class=/.test(comment.memo)
                                ) {
                                    check.DCCON =
                                        /https:\/\/dcimg5\.dcinside\.com\/dccon\.php\?no=(\w*)/g.exec(
                                            comment.memo
                                        )![1];
                                } else {
                                    check.COMMENT = comment.memo;
                                }

                                const isBlocked = block.checkAll(check, gallery);

                                if (isBlocked) {
                                    if (replyConfig && comment.c_no === 0) {
                                        parentComment = comment;
                                    }

                                    if (blurConfig) {
                                        comment.memo = "댓글 내용이 차단됐습니다.";
                                        comment.is_delete = "1";
                                    } else {
                                        return false;
                                    }
                                }

                                return true;
                            }
                        );

                        threadCounts = comments.comments.length === 0 ? 0 : comments.comments.map((v: DcinsideCommentObject) => Number(v.depth == 0)).reduce((a: number, b: number) => a + b);
                        commentCounts = comments.comments.length;
                    } else if (this.status.archiveArticle) {
                        const cache = postCaches.get(`${preData.gallery}${preData.id}`);
                        const cacheComment = cache?.comment?.comments;

                        if (cacheComment) {
                            needRefresh = true;

                            cacheComment.forEach((v: DcinsideCommentObject) => {
                                v.is_delete = "1";
                            });

                            comments.comments = cacheComment;
                            threadCounts = comments.comments.length === 0 ? 0 : comments.comments.map((v: DcinsideCommentObject) => Number(v.depth == 0)).reduce((a: number, b: number) => a + b);
                            commentCounts = comments.comments.length;
                        }
                    }

                    frame.subtitle = `${
                        (commentCounts !== threadCounts &&
                            `쓰레드 ${threadCounts}개, 총 댓글`) ||
                        ""
                    } ${commentCounts}개`;

                    frame.data.comments = comments;
                    if (needRefresh) frame.app.$children[0].$children[1].commentKey++;
                } catch (e) {
                    if (frame.data.comments) {
                        Toast.show(String(e), true, 3000);
                    } else {
                        frame.error = {
                            title: "댓글",
                            detail: String(e)
                        };
                    }
                } finally {
                    frame.data.load = false;
                }
            };

            frame.functions.load();
            frame.functions.retry = (useCache = false) => {
                frame.functions.load(useCache);
            };
        };

        const newPostWithData = (
            preData: GalleryPreData,
            historySkip?: boolean
        ) => {
            const firstApp = frame.app.first();
            const secondApp = frame.app.second();

            if (firstApp.data.load) return;

            const params = new URLSearchParams(preData.link);
            params.set("no", preData.id);
            preData.link = decodeURIComponent(params.toString());

            preData.title = "로딩 중...";
            firstApp.contents = "로딩 중...";

            makeFirstFrame(firstApp, preData, this.memory.signal!, historySkip);
            makeSecondFrame(secondApp, preData, this.memory.signal!);

            if (
                this.status.toggleAdminPanel &&
                document.querySelector(".useradmin_btnbox button")
            ) {
                panel.admin(
                    preData,
                    frame,
                    this.status.toggleBlur,
                    eventBus,
                    this.status.useKeyPress
                );
            }
        };

        const previewFrame = (
            ev: MouseEvent | null,
            prd?: GalleryPreData,
            historySkip?: boolean
        ) => {
            if (this.memory.preventOpen) {
                this.memory.preventOpen = false;

                return;
            }

            if ((ev?.target as HTMLElement)?.closest(".ub-writer")) {
                return;
            }

            if (this.status.tooltipMode)
                miniPreview.close(this.status.tooltipMode);

            const preData = ev === null ? prd : getRelevantData(ev);

            if (!preData) return;

            let collapseView = false;

            if (ev?.target instanceof HTMLElement) {
                collapseView = ev.target.className.includes("reply_num");
            }

            if (!historySkip) {
                this.memory.titleStore = document.title;
                this.memory.urlStore = location.href;
            }

            const controller = new AbortController();
            this.memory.signal = controller.signal;

            let appStore: RefresherFrameAppVue;
            let groupStore: HTMLElement;

            let scrolledCount = 0;

            if (!frame) {
                const detector = new ScrollDetection();

                frame = new Frame(
                    [
                        {
                            relative: true,
                            center: true,
                            preview: true,
                            blur: this.status.toggleBlur
                        },
                        {
                            relative: true,
                            center: true,
                            preview: true,
                            blur: this.status.toggleBlur
                        }
                    ],
                    {
                        background: true,
                        stack: true,
                        groupOnce: true,
                        onScroll: (
                            ev: WheelEvent,
                            app: RefresherFrameAppVue,
                            group: HTMLElement
                        ) => {
                            if (!this.status.scrollToSkip) return;

                            appStore = app;
                            groupStore = group;

                            detector.addMouseEvent(ev);
                        },
                        blur: this.status.toggleBackgroundBlur
                    }
                );

                detector.listen("scroll", (ev: WheelEvent) => {
                    const scrolledTop = groupStore.scrollTop === 0;

                    const scroll = Math.floor(
                        groupStore.scrollHeight - groupStore.scrollTop
                    );

                    const scrolledToBottom =
                        scroll === groupStore.clientHeight ||
                        scroll + 1 === groupStore.clientHeight;

                    if (!scrolledTop && !scrolledToBottom) {
                        scrolledCount = 0;
                    }

                    const getNextPost = (direction: "next" | "prev") => {
                        const post = $(`.us-post[data-no="${postFetchedData.id}"]`);

                        if (!post) return;

                        const nextPost = direction === "next"
                            ? post.prev()
                            : post.next();

                        if (!nextPost || nextPost.data("data-type") === "icon_notice") return;

                        const nextPostNo = nextPost.attr("data-no");

                        if (!nextPostNo) return;

                        return nextPostNo;
                    };

                    if (ev.deltaY < 0) {
                        appStore.$data.scrollModeBottom = false;
                        appStore.$data.scrollModeTop = true;

                        if (!scrolledTop) {
                            appStore.$data.scrollModeTop = false;
                            appStore.$data.scrollModeBottom = false;
                        }

                        if (!scrolledTop || !preData) return;

                        if (scrolledCount++ < 1) return;

                        scrolledCount = 0;

                        preData.id = getNextPost("prev") || (Number(postFetchedData.id) - 1).toString();

                        newPostWithData(preData, historySkip);
                        groupStore.scrollTop = 0;
                        appStore.clearScrollMode();
                    } else {
                        appStore.$data.scrollModeTop = false;
                        appStore.$data.scrollModeBottom = true;

                        if (!scrolledToBottom) {
                            appStore.$data.scrollModeTop = false;
                            appStore.$data.scrollModeBottom = false;
                        }

                        if (!scrolledToBottom || !preData) {
                            return;
                        }

                        if (scrolledCount++ < 1) return;

                        scrolledCount = 0;

                        preData.id = getNextPost("next") || (Number(postFetchedData.id) + 1).toString();
                        newPostWithData(preData, historySkip);

                        groupStore.scrollTop = 0;
                        appStore.clearScrollMode();
                    }
                });

                frame.app.$on("close", () => {
                    controller.abort();

                    const blockPopup = document.querySelector(
                        ".refresher-block-popup"
                    );
                    blockPopup?.remove();

                    const captchaPopup = document.querySelector(
                        ".refresher-captcha-popup"
                    );
                    captchaPopup?.remove();

                    const adminPanel = document.querySelector(
                        ".refresher-management-panel"
                    );
                    adminPanel?.remove();

                    if (typeof adminKeyPress === "function") {
                        document.removeEventListener("keypress", adminKeyPress);
                    }

                    if (!this.memory.historyClose && this.memory.titleStore) {
                        history.pushState(
                            null,
                            this.memory.titleStore,
                            this.memory.urlStore
                        );

                        this.memory.historyClose = false;
                    }

                    if (this.memory.titleStore) {
                        document.title = this.memory.titleStore;
                    }

                    appStore?.clearScrollMode();
                    window.clearInterval(this.memory.refreshIntervalId!);
                });
            }

            frame.app.closed = false;

            frame.app.first().collapse = collapseView;

            makeFirstFrame(
                frame.app.first(),
                preData,
                this.memory.signal!,
                historySkip
            );

            makeSecondFrame(frame.app.second(), preData, this.memory.signal!);

            if (
                this.status.toggleAdminPanel &&
                document.querySelector(".useradmin_btnbox button") !== null
            ) {
                panel.admin(
                    preData,
                    frame,
                    this.status.toggleBlur,
                    eventBus,
                    this.status.useKeyPress
                );
            }

            setTimeout(frame.app.fadeIn, 0);

            ev?.preventDefault();
        };

        const handleMousePress = (ev: MouseEvent) => {
            if (ev.button !== 2) {
                return ev;
            }

            if (ev.type === "mousedown") {
                this.memory.lastPress = Date.now();
                return ev;
            }

            if (
                ev.type === "mouseup" &&
                Date.now() - this.status.longPressDelay > this.memory.lastPress
            ) {
                this.memory.preventOpen = true;
                this.memory.lastPress = 0;
                return ev;
            }
        };

        const addHandler = (element: HTMLElement) => {
            if (element.dataset.refresherPreview === "true") return;

            let timer: number | undefined;

            element.dataset.refresherPreview = "true";
            element.addEventListener("mouseup", handleMousePress);
            element.addEventListener("mousedown", handleMousePress);
            element.addEventListener(
                this.status.reversePreviewKey ? "click" : "contextmenu",
                (ev) => {
                    if ($(element).closest(".us-post").hasClass("refresherBlur")) return;

                    if (typeof timer === "number") {
                        window.clearTimeout(timer);
                        timer = undefined;
                    }

                    previewFrame(ev);
                }
            );

            if (this.status.reversePreviewKey) {
                element.addEventListener("contextmenu", (e) => {
                    e.preventDefault();

                    let href = (e.target as HTMLAnchorElement).href;

                    if (!href) {
                        if ((e.target as HTMLElement).tagName === "TR") {
                            href =
                                document
                                    .querySelector("a")
                                    ?.getAttribute("href") ?? "";
                        } else {
                            href =
                                findNeighbor(
                                    e.target as HTMLElement,
                                    "a",
                                    5,
                                    null
                                )?.getAttribute("href") ?? "";
                        }
                    }

                    location.href = href;
                });
            }

            element.addEventListener("mouseenter", (ev) => {
                if (
                    !this.status.tooltipMode ||
                    $(element).closest(".us-post").hasClass("refresherBlur") ||
                    typeof timer === "number"
                ) return;

                timer = window.setTimeout(() => {
                    miniPreview.create(
                        ev,
                        this.status.tooltipMode,
                        this.status.tooltipMediaHide,
                        this.status.tooltipInteraction
                    );

                    if (this.status.tooltipInteraction)
                        miniPreview.move(ev, this.status.tooltipMode, this.status.tooltipInteraction);

                }, this.status.tooltipDelay);
            });

            element.addEventListener("mousemove", (ev) => {
                if (this.status.tooltipMode && !this.status.tooltipInteraction)
                    miniPreview.move(ev, this.status.tooltipMode, this.status.tooltipInteraction);
            });

            element.addEventListener("mouseleave", () => {
                if (!this.status.tooltipMode) return;

                if (typeof timer === "number") {
                    window.clearTimeout(timer);
                    timer = undefined;
                }

                miniPreview.close(this.status.tooltipMode);
            });
        };

        this.memory.uuid = filter.add(
            `.gall_list .ub-content${this.status.expandRecognizeRange ? "" : " .ub-word"}`,
            addHandler,
            {neverExpire: true}
        );

        this.memory.popStateHandler = (ev: PopStateEvent) => {
            if (!ev.state) {
                this.memory.historyClose = true;

                try {
                    frame.app.close();
                } catch {
                    location.reload();
                }

                return;
            }

            this.memory.historyClose = false;

            if (frame.app.closed) {
                previewFrame(null, ev.state.preData, true);
            } else {
                newPostWithData(ev.state.preData, true);
            }
        };

        window.addEventListener("popstate", this.memory.popStateHandler);
    },
    revoke(filter) {
        if (this.memory.uuid) filter.remove(this.memory.uuid, true);

        if (this.memory.popStateHandler)
            window.removeEventListener("popstate", this.memory.popStateHandler);

        if (this.memory.refreshIntervalId)
            window.clearInterval(this.memory.refreshIntervalId);
    }
} as RefresherModule<{
    memory: {
        preventOpen: boolean;
        lastPress: number;
        uuid: string | null;
        popStateHandler: ((ev: PopStateEvent) => void) | null;
        signal: AbortSignal | null;
        historyClose: boolean;
        titleStore: string | null;
        urlStore: string | null;
        refreshIntervalId: number | null;
    };
    settings: {
        tooltipMode: RefresherCheckSettings;
        tooltipMediaHide: RefresherCheckSettings;
        tooltipDelay: RefresherRangeSettings;
        tooltipInteraction: RefresherCheckSettings;
        reversePreviewKey: RefresherCheckSettings;
        longPressDelay: RefresherRangeSettings;
        scrollToSkip: RefresherCheckSettings;
        colorPreviewLink: RefresherCheckSettings;
        autoRefreshComment: RefresherCheckSettings;
        commentRefreshInterval: RefresherRangeSettings;
        toggleBlur: RefresherCheckSettings;
        toggleBackgroundBlur: RefresherCheckSettings;
        toggleAdminPanel: RefresherCheckSettings;
        useKeyPress: RefresherCheckSettings;
        blockPresetDay: RefresherOptionSettings;
        blockPresetReason: RefresherTextSettings;
        blockPresetDelete: RefresherCheckSettings;
        blockPresetUserType: RefresherCheckSettings;
        expandRecognizeRange: RefresherCheckSettings;
        experimentalComment: RefresherCheckSettings;
        bypassCaptcha: RefresherCheckSettings;
        disableCache: RefresherCheckSettings;
        archiveArticle: RefresherCheckSettings;
    };
    require: ["filter", "eventBus", "Frame", "http"];
}>;
