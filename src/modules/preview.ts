import {User} from "../utils/user";
import {findNeighbor} from "../utils/dom";
import * as http from "../utils/http";
import browser from "webextension-polyfill";
import * as Toast from "../components/toast";
import {ScrollDetection} from "../utils/scrollDetection";
import {submitComment} from "../utils/comment";
import logger from "../utils/logger";
import Cookies from "js-cookie";

class PostInfo implements PostInfo {
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
    isNotice?: boolean;
    requireCaptcha?: boolean;
    requireCommentCaptcha?: boolean;
    disabledDownvote?: boolean;
    dom?: Document;

    constructor(id: string, data: { [index: string]: unknown }) {
        this.id = id;

        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            this[key] = data[key];
        }
    }
}

interface GalleryHTTPRequestArguments {
    gallery: string;
    id: string;
    commentId?: string;
    commentNo?: string;
    link?: string;
}

const ISSUE_ZOOM_ID = /\$\(document\)\.data\('comment_id',\s'.+'\);/g;
const ISSUE_ZOOM_NO = /\$\(document\)\.data\('comment_no',\s'.+'\);/g;

const QUOTES = /(["'])(?:(?=(\\?))\2.)*?\1/g;

const parse = (id: string, body: string) => {
    const dom = new DOMParser().parseFromString(body, "text/html");

    const header = dom
        .querySelector(".view_content_wrap span.title_headtext")
        ?.innerHTML
        ?.replace(/(\[|\])/g, "");

    const title = dom.querySelector(".view_content_wrap span.title_subject")
        ?.innerHTML;

    const date = dom.querySelector(".view_content_wrap div.fl > span.gall_date")
        ?.innerHTML;

    let expire = dom.querySelector(
        ".view_content_wrap div.fl > span.mini_autodeltime > div.pop_tipbox > div"
    )?.innerHTML;

    if (expire) {
        expire = expire.replace(/\s자동\s삭제/, "");
    }

    const views = dom
        .querySelector(".view_content_wrap div.fr > span.gall_count")
        ?.innerHTML.replace(/조회\s/, "");

    const upvotes = dom
        .querySelector(".view_content_wrap div.fr > span.gall_reply_num")
        ?.innerHTML.replace(/추천\s/, "");

    const fixedUpvotes = dom.querySelector(
        ".view_content_wrap .btn_recommend_box .sup_num .smallnum"
    )?.innerHTML;

    const downvotes = dom.querySelector("div.btn_recommend_box .down_num")
        ?.innerHTML;

    const content_query = dom.querySelector(
        ".view_content_wrap > div > div.inner.clear > div.writing_view_box"
    );

    const writeDiv = content_query?.querySelector(".write_div") as HTMLElement;
    if (writeDiv && writeDiv.style.width) {
        const width = writeDiv.style.width;
        writeDiv.style.width = "unset";
        writeDiv.style.maxWidth = width;
        writeDiv.style.overflow = "";
    }
    const contents = content_query?.innerHTML;

    const zoomID = body.match(ISSUE_ZOOM_ID);
    const zoomNO = body.match(ISSUE_ZOOM_NO);

    let commentId = "";
    let commentNo = "";

    if (zoomID && zoomID[0]) {
        commentId = (zoomID[0].match(QUOTES) as string[])[1].replace(/'/g, "");
    }

    if (zoomNO && zoomNO[0]) {
        commentNo = (zoomNO[0].match(QUOTES) as string[])[1].replace(/'/g, "");
    }

    const noticeElement = dom.querySelector(
        ".user_control .option_box li:first-child"
    );
    const isNotice = noticeElement && noticeElement.innerHTML !== "공지 등록";

    const requireCaptcha = dom.querySelector(".recommend_kapcode") !== null;
    const requireCommentCaptcha =
        dom.querySelector(".cmt_write_box input[name=\"comment_code\"]") !== null;

    const disabledDownvote = dom.querySelector(".icon_recom_down") === null;

    return new PostInfo(id, {
        header,
        title,
        date,
        expire,
        user: new User("", "", "", "").import(
            dom.querySelector(
                "div.view_content_wrap > header > div > div.gall_writer"
            ) || null
        ),
        views,
        upvotes,
        fixedUpvotes,
        downvotes,
        contents,
        commentId,
        commentNo,
        isNotice,
        disabledDownvote,
        requireCaptcha,
        requireCommentCaptcha,
        dom
    });
};

const request = {
    make: (url: string, options?: RequestInit) => {
        return http.make(url, {
            method: "POST",
            headers: {
                Origin: "https://gall.dcinside.com",
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            cache: "no-store",
            ...options
        });
    },

    async vote(
        gall_id: string,
        post_id: string,
        type: string,
        code: string | undefined,
        link: string
    ) {

        Cookies.set(
            gall_id + post_id + "_Firstcheck" + (!type ? "_down" : ""),
            "Y",
            {
                path: "/",
                domain: "dcinside.com",
                expires: new Date(new Date().getTime() + 3 * 60 * 60 * 1000)
            }
        );

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", gall_id);
        params.set("no", post_id);
        params.set("mode", type ? "U" : "D");
        params.set("code_recommend", code ?? "undefined");
        params.set("_GALLTYPE_", http.galleryTypeName(link));
        params.set("link_id", gall_id);

        const response = await this.make(http.urls.vote, {
            referrer: link,
            body: `&${params.toString()}`
        });

        const [result, counts, fixedCounts] = response.split("||");

        return {
            result,
            counts,
            fixedCounts
        };
    },

    post(
        link: string,
        gallery: string,
        id: string,
        signal: AbortSignal,
        noCache: boolean
    ) {
        return http.make(
            `${http.urls.base + http.galleryType(link, "/") + http.urls.view + gallery}&no=${id}`,
            {signal, cache: noCache ? "no-cache" : "default"}
        )
            .then(response => parse(id, response));
    },

    /**
     * 디시인사이드 서버에 댓글을 요청합니다.
     * @param args
     * @param signal
     */
    async comments(args: GalleryHTTPRequestArguments, signal: AbortSignal) {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("id", args.gallery);
        params.set("no", args.id);
        params.set("cmt_id", args.commentId ?? args.gallery);
        params.set("cmt_no", args.commentNo ?? args.id);
        params.set("e_s_n_o", (document.getElementById("e_s_n_o") as HTMLInputElement).value);
        params.set("comment_page", "1");
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await this.make(http.urls.comments, {
            referrer: `https://gall.dcinside.com/${galleryType}board/view/?id=${args.gallery}&no=${args.id}`,
            body: `&${params.toString()}`,
            signal
        });

        return JSON.parse(response);
    },
    async delete(args: GalleryHTTPRequestArguments) {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", args.gallery);
        params.set("nos[]", args.id);
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await this.make(
            galleryType === "mini/"
                ? http.urls.manage.deleteMini
                : http.urls.manage.delete,
            {
                referrer: `https://gall.dcinside.com/${galleryType}board/lists/?id=${args.gallery}`,
                body: `&${params.toString()}`
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
        del_chk: number
    ) {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

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

        const response = await this.make(
            galleryType == "mini/"
                ? http.urls.manage.blockMini
                : http.urls.manage.block,
            {
                referrer: `https://gall.dcinside.com/${galleryType}board/lists/?id=${args.gallery}`,
                body: `&${params.toString()}`
            }
        );

        try {
            return JSON.parse(response);
        } catch {
            return response;
        }
    },

    async setNotice(args: GalleryHTTPRequestArguments, set: boolean) {
        if (!args.link) {
            throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");
        }

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("mode", set ? "SET" : "REL");
        params.set("id", args.gallery);
        params.set("no", args.id);
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await this.make(
            galleryType == "mini/"
                ? http.urls.manage.setNoticeMini
                : http.urls.manage.setNotice,
            {
                referrer: `https://gall.dcinside.com/${galleryType}board/lists/?id=${args.gallery}`,
                body: `&${params.toString()}`
            }
        );

        try {
            return JSON.parse(response);
        } catch {
            return response;
        }
    },

    async setRecommend(args: GalleryHTTPRequestArguments, set: boolean) {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("mode", set ? "SET" : "REL");
        params.set("id", args.gallery);
        params.set("nos[]", args.id);
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await this.make(
            galleryType == "mini/"
                ? http.urls.manage.setRecommendMini
                : http.urls.manage.setRecommend,
            {
                referrer: `https://gall.dcinside.com/${galleryType}board/lists/?id=${args.gallery}`,
                body: `&${params.toString()}`
            }
        );

        try {
            return JSON.parse(response);
        } catch {
            return response;
        }
    },

    async captcha(args: GalleryHTTPRequestArguments, kcaptchaType: string) {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const galleryType = http.galleryType(args.link, "/");
        const galleryTypeName = http.galleryTypeName(args.link);

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("gall_id", args.gallery);
        params.set("kcaptcha_type", kcaptchaType);
        params.set("_GALLTYPE_", galleryTypeName);

        await this.make(http.urls.captcha, {
            referrer: `https://gall.dcinside.com/${galleryType}board/lists/?id=${args.gallery}`,
            body: `&${params.toString()}`
        });

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

        const galleryType = http.galleryType(preData.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", preData.gallery);
        params.set("_GALLTYPE_", typeName);
        params.set("pno", preData.id);
        params.set("cmt_nos[]", commentId);

        return this
            .make(url, {
                referrer: `https://gall.dcinside.com/${galleryType}board/view/?id=${preData.gallery}&no=${preData.id}`,
                body: `&${params.toString()}`,
                signal
            })
            .then(v => {
                return v;
            })
            .catch(() => {
                return false;
            });
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

        const galleryType = http.galleryType(preData.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", preData.gallery);
        params.set("_GALLTYPE_", typeName);
        params.set("mode", "del");
        params.set("re_no", commentId);

        if (password) {
            params.set("re_password", password);
            params.set("&g-recaptcha-response", password);
        }

        return this
            .make(http.urls.comment_remove, {
                referrer: `https://gall.dcinside.com/${galleryType}board/view/?id=${preData.gallery}&no=${preData.id}`,
                body: `&${params.toString()}`,
                signal
            })
            .then(v => {
                return v;
            })
            .catch(() => {
                return false;
            });
    }
};

const KEY_COUNTS: { [index: string]: [number, number] } = {};
let adminKeyPress: (ev: KeyboardEvent) => void;

const panel = {
    block: (
        callback: (
            avoid_hour: number,
            avoid_reason: number,
            avoid_reason_txt: string,
            del_chk: number
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
            <label><input type='radio' name='duration' value='1' checked='checked' />1시간</label>
            <label><input type='radio' name='duration' value='6' />6시간</label>
            <label><input type='radio' name='duration' value='24' />24시간</label>
            <label><input type='radio' name='duration' value='168' />7일</label>
            <label><input type='radio' name='duration' value='336' />14일</label>
            <label><input type='radio' name='duration' value='720' />30일</label>
          </div>
        </div>
        <div class="block">
          <h3>차단 사유</h3>
          <div class="block_reason">
            <label><input type='radio' name='reason' value='1' checked='checked' />음란성</label>
            <label><input type='radio' name='reason' value='2'/>광고</label>
            <label><input type='radio' name='reason' value='3'/>욕설</label>
            <label><input type='radio' name='reason' value='4'/>도배</label>
            <label><input type='radio' name='reason' value='5'/>저작권 침해</label>
            <label><input type='radio' name='reason' value='6'/>명예훼손</label>
            <label><input type='radio' name='reason' value='0'/>직접 입력</label>
          </div>
          <input type='text' name='reason_text' style='display: none;' placeholder="차단 사유 직접 입력 (한글 20자 이내)"></input>
        </div>
        <div class="block">
          <h3>선택한 글 삭제</h3>
          <input type='checkbox' name='remove'></input>
          <button class="go-block">차단</button>
        </div>
      </div>
    `;

        let avoid_hour = 1;
        let avoid_reason = 1;

        element.querySelector(".close")?.addEventListener("click", () => {
            closeCallback();
        });

        element.querySelectorAll("input[type=\"radio\"]").forEach(v => {
            v.addEventListener("click", ev => {
                const selected = ev.target as HTMLInputElement;

                if (!selected) {
                    return;
                }

                if (selected.getAttribute("name") === "duration") {
                    avoid_hour = Number(selected.value);
                }

                if (selected.getAttribute("name") === "reason") {
                    const value = Number(selected.value);

                    const blockReasonInput = document.querySelector(
                        "input[name=\"reason_text\"]"
                    ) as HTMLInputElement;

                    if (!value) {
                        blockReasonInput.style.display = "block";
                    } else {
                        blockReasonInput.style.display = "none";
                    }

                    avoid_reason = value;
                }
            });
        });

        element.querySelector(".go-block")?.addEventListener("click", () => {
            const avoid_reason_txt = (element.querySelector(
                "input[name=\"reason_text\"]"
            ) as HTMLInputElement).value;
            const del_chk = (element.querySelector(
                "input[name=\"remove\"]"
            ) as HTMLInputElement).checked;

            callback(avoid_hour, avoid_reason, avoid_reason_txt, del_chk ? 1 : 0);
        });

        document.querySelector("body")?.appendChild(element);
    },

    admin: (
        preData: GalleryPreData,
        frame: RefresherFrame,
        toggleBlur: boolean,
        eventBus: RefresherEventBus,
        useKeyPress: boolean
    ) => {
        const preFoundBlockElement = document.querySelector(
            ".refresher-block-popup"
        );
        if (preFoundBlockElement) {
            preFoundBlockElement.parentElement?.removeChild(preFoundBlockElement);
        }

        const preFoundElement = document.querySelector(
            ".refresher-management-panel"
        );
        if (preFoundElement) {
            preFoundElement.parentElement?.removeChild(preFoundElement);
        }

        let setAsNotice = !preData.notice;
        let setAsRecommend = !preData.recommend;

        const element = document.createElement("div");
        element.id = "refresher-management-panel";
        element.className = "refresher-management-panel";

        if (toggleBlur) {
            element.className += " blur";
        }

        const upvoteImage = browser.runtime.getURL("/assets/icons/upvote.png");
        const downvoteImage = browser.runtime.getURL("/assets/icons/downvote.png");

        element.innerHTML = `
      <div class="button pin">
        <img src="${browser.runtime.getURL("/assets/icons/pin.png")}"></img>
        <p>${setAsNotice ? "공지로 등록" : "공지 등록 해제"}</p>
      </div>
      <div class="button recommend">
        <img src="${setAsRecommend ? upvoteImage : downvoteImage}"></img>
        <p>${setAsRecommend ? "개념글 등록" : "개념글 해제"}</p>
      </div>
      <div class="button block">
        <img src="${browser.runtime.getURL("/assets/icons/block.png")}"></img>
        <p>차단</p>
      </div>
      <div class="button delete">
        <img src="${browser.runtime.getURL("/assets/icons/delete.png")}"></img>
        <p>삭제 (D)</p>
      </div>
    `;

        const deleteFunction = () => {
            frame.app.close();

            request.delete(preData).then(response => {
                if (typeof response === "object") {
                    if (response.result === "success") {
                        Toast.show("게시글을 삭제했습니다.", false, 600);
                    } else {
                        Toast.show(response.message, true, 600);
                        alert(`${response.result}: ${response.message}`);
                    }

                    return;
                }

                alert(response);
            });
        };

        element.querySelector(".delete")?.addEventListener("click", deleteFunction);

        if (adminKeyPress) {
            document.removeEventListener("keypress", adminKeyPress);
        }

        if (useKeyPress) {
            adminKeyPress = (ev: KeyboardEvent) => {
                if (ev.code !== "KeyB" && ev.code !== "KeyD") {
                    return ev;
                }

                if (frame.app.inputFocus) {
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
                        Toast.show("한번 더 D키를 누르면 게시글을 삭제합니다.", true, 1000);
                    }
                }

                // TODO : 차단 프리셋이 지정된 경우 차단

                // else if (ev.code === 'KeyB') {
                //   if (KEY_COUNTS[ev.code][1] > 2) {
                //     // deleteFunction()
                //   } else {
                //     Toast.show('한번 더 B키를 누르면 차단합니다.', true, 1000)
                //   }
                // }
            };
        }

        document.addEventListener("keypress", adminKeyPress);

        element.querySelector(".block")?.addEventListener("click", () => {
            panel.block(
                (
                    avoid_hour: number,
                    avoid_reason: number,
                    avoid_reason_txt: string,
                    del_chk: number
                ) => {
                    request
                        .block(preData, avoid_hour, avoid_reason, avoid_reason_txt, del_chk)
                        .then(response => {
                            if (typeof response === "object") {
                                if (response.result === "success") {
                                    Toast.show(response.message || response.msg, false, 3000);

                                    if (del_chk) {
                                        frame.app.close();
                                    }
                                } else {
                                    alert(`${response.result}: ${response.message}`);
                                }

                                return;
                            }

                            alert(response);
                        });
                },
                () => {
                    const blockPopup = document.querySelector(".refresher-block-popup");

                    if (blockPopup) {
                        blockPopup.parentElement?.removeChild(blockPopup);
                    }
                }
            );
        });

        const pin = element.querySelector(".pin") as HTMLElement;
        pin.addEventListener("click", () => {
            request.setNotice(preData, setAsNotice).then(response => {
                eventBus.emit("refreshRequest");

                if (typeof response === "object") {
                    if (response.result === "success") {
                        Toast.show(response.message || response.msg, false, 3000);

                        setAsNotice = !setAsNotice;

                        const pinP = pin.querySelector("p") as HTMLElement;
                        pinP.innerHTML = setAsNotice ? "공지로 등록" : "공지 등록 해제";
                    } else {
                        alert(`${response.result}: ${response.message || response.msg}`);
                    }

                    return;
                }

                alert(response);
            });
        });

        const recommend = element.querySelector(".recommend") as HTMLElement;
        recommend.addEventListener("click", () => {
            request.setRecommend(preData, setAsRecommend).then(response => {
                eventBus.emit("refreshRequest");

                if (typeof response === "object") {
                    if (response.result === "success") {
                        Toast.show(response.message || response.msg, false, 3000);

                        setAsRecommend = !setAsRecommend;

                        const recommendImg = recommend.querySelector(
                            "img"
                        ) as HTMLImageElement;
                        recommendImg.src = setAsRecommend ? upvoteImage : downvoteImage;

                        const recommendP = recommend.querySelector(
                            "p"
                        ) as HTMLParagraphElement;
                        recommendP.innerHTML = setAsRecommend
                            ? "개념글 등록"
                            : "개념글 해제";
                    } else {
                        alert(`${response.result}: ${response.message || response.msg}`);
                    }

                    return;
                }

                alert(response);
            });
        });

        document.querySelector("body")?.appendChild(element);

        return element;
    },

    captcha(src: string, callback: (captcha: string) => void): boolean {
        const element = document.createElement("div");
        element.className = "refresher-captcha-popup";

        element.innerHTML = `
    <p>코드 입력</p>
    <div class="close">
      <div class="cross"></div>
      <div class="cross"></div>
    </div>
    <img src="${src}"></img>
    <input type="text"></input>
    <button class="refresher-preview-button primary">
      <p class="refresher-vote-text">전송</p>
    </button>
    `;

        setTimeout(() => {
            element.querySelector("input")?.focus();
        }, 0);

        element.querySelector("input")?.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                const input = (element.querySelector("input") as HTMLInputElement).value;

                callback(input);

                element.parentElement?.removeChild(element);
            }
        });

        element.querySelector(".close")?.addEventListener("click", () => {
            element.parentElement?.removeChild(element);
        });

        element.querySelector("button")?.addEventListener("click", () => {
            const input = (element.querySelector("input") as HTMLInputElement).value;

            callback(input);

            element.parentElement?.removeChild(element);
        });

        document.querySelector("body")?.appendChild(element);

        return true;
    }
};

const getRelevantData = (ev: MouseEvent) => {
    const target = ev.target as HTMLElement;
    const isTR = target.tagName === "TR";

    const listID = (isTR
        ? target.querySelector(".gall_num")
        : findNeighbor(target, ".gall_num", 5, null)) as HTMLElement;

    let id = "";
    let gallery = "";
    let title = "";
    let link = "";
    let notice = false;
    let recommend = false;

    let linkElement: HTMLLinkElement;

    if (listID) {
        if (listID.innerText === "공지") {
            let href = "";

            if (isTR) {
                href = document.querySelector("a")?.getAttribute("href") || "";
            } else {
                href = findNeighbor(target, "a", 5, null)?.getAttribute("href") || "";
            }

            id = new URLSearchParams(href).get("no") || "";
            notice = true;
        } else {
            id = listID.innerText;
        }

        const emElement = isTR
            ? target.querySelector("em.icon_img")
            : findNeighbor(target, "em.icon_img", 5, null);
        if (emElement) {
            recommend = emElement.className.includes("icon_recomimg");
        }

        linkElement = (isTR
            ? target.querySelector("a:not(.reply_numbox)")
            : findNeighbor(
                target,
                "a:not(.reply_numbox)",
                3,
                null
            )) as HTMLLinkElement;

        if (typeof linkElement !== null) {
            title = linkElement.innerText;
        }
    } else {
        linkElement = (isTR
            ? target.querySelector("a")
            : findNeighbor(ev.target as HTMLElement, "a", 2, null)) as HTMLLinkElement;

        const pt = isTR
            ? target.querySelector(".txt_box")
            : findNeighbor(ev.target as HTMLElement, ".txt_box", 2, null);
        if (pt) {
            title = pt.innerHTML;
        }
    }

    if (linkElement) {
        const href = linkElement.href || "";
        const linkNumberMatch = href.match(/&no=.+/);
        const linkIdMatch = href.match(/id=.+/);

        if (!linkNumberMatch || !linkIdMatch) {
            return;
        }

        id = linkNumberMatch[0].replace("&no=", "").replace(/&.+/g, "");
        gallery = linkIdMatch[0].replace(/id=/g, "").replace(/&.+/g, "");
    }

    if (linkElement) {
        link = linkElement.href;
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

const miniPreview: miniPreview = {
    element: document.createElement("div"),
    init: false,
    lastRequest: 0,
    controller: new AbortController(),
    lastElement: null,
    lastTimeout: 0,
    caches: {},
    shouldOutHandle: false,
    cursorOut: false,
    create(ev, use, hide) {
        if (!use) return;

        miniPreview.cursorOut = false;

        if (Date.now() - miniPreview.lastRequest < 150) {
            miniPreview.lastRequest = Date.now();
            miniPreview.lastElement = ev.target;

            if (miniPreview.lastTimeout) clearTimeout(miniPreview.lastTimeout);

            miniPreview.lastTimeout = setTimeout(() => {
                if (!miniPreview.cursorOut && miniPreview.lastElement === ev.target) {
                    miniPreview.create(ev, use, hide);
                }

                miniPreview.cursorOut = false;
            }, 150);

            return;
        }

        miniPreview.lastRequest = Date.now();

        const preData = getRelevantData(ev);

        if (!preData) return;

        if (miniPreview.element.classList.contains("hide")) {
            miniPreview.element.classList.remove("hide");
        }

        if (!miniPreview.element.classList.contains("refresher-mini-preview")) {
            miniPreview.element.classList.add("refresher-mini-preview");
        }

        if (!miniPreview.init) {
            miniPreview.element.innerHTML = `<h3>${preData.title}</h3><br><div class="refresher-mini-preview-contents${hide ? " media-hide" : ""}"></div><p class="read-more">더 읽으려면 클릭하세요.</p>`;

            document.body.appendChild(miniPreview.element);
            miniPreview.init = true;
        }

        const selector = miniPreview.element.querySelector(".refresher-mini-preview-contents");

        if (selector === null) return;

        new Promise<PostInfo>((resolve, reject) => {
            if (Object.keys(miniPreview.caches).length > 50) miniPreview.caches = {};

            const cache = miniPreview.caches[preData.gallery + preData.id];

            if (cache) return resolve(cache as PostInfo);

            try {
                request
                    .post(
                        preData.link,
                        preData.gallery,
                        preData.id,
                        miniPreview.controller.signal,
                        false
                    )
                    .then(result => {
                        miniPreview.caches[preData.gallery + preData.id] = result;
                        resolve(result);
                    })
                    .catch(e => {
                        reject(e);
                    });
            } catch (e) {
                reject(e);
            }
        })
            .then(v => {
                selector.innerHTML = v.contents ?? "";
                selector.querySelector(".write_div")?.setAttribute("style", "");
            })
            .catch(e => {
                const {message} = (e as Error);

                selector.innerHTML =
                    message.includes("aborted")
                        ? ""
                        : `게시글을 새로 가져올 수 없습니다: ${message}`;
            });

        (miniPreview.element.querySelector("h3") as HTMLHeadingElement).innerHTML = preData.title;
    },

    move(ev: MouseEvent, use: boolean) {
        if (!use) return;

        const rect = miniPreview.element.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const x = Math.min(ev.clientX, innerWidth - width - 10);
        const y = Math.min(ev.clientY, innerHeight - height - 10);
        miniPreview.element.style.transform = `translate(${x}px, ${y}px)`;
    },

    close(use: boolean) {
        miniPreview.cursorOut = true;

        if (use) {
            miniPreview.controller.abort();
            miniPreview.controller = new AbortController();
        }

        miniPreview.element.classList.add("hide");
    }
};

let frame: RefresherFrame;

export default {
    name: "미리보기",
    description: "글을 오른쪽 클릭 했을때 미리보기 창을 만들어줍니다.",
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/(view|lists)/g,
    status: {
        longPressDelay: 300,
        scrollToSkip: true,
        noCacheHeader: false,
        toggleBlur: true,
        toggleBackgroundBlur: false,
        toggleAdminPanel: true,
        expandRecognizeRange: false,
        tooltipMode: true,
        tooltipMediaHide: false,
        useKeyPress: true,
        colorPreviewLink: true,
        reversePreviewKey: false,
        autoRefreshComment: true,
        commentRefreshInterval: 10,
        experimentalComment: false
    },
    memory: {
        preventOpen: false,
        lastPress: 0,
        uuid: null,
        uuid2: null,
        popStateHandler: null,
        signal: null,
        historyClose: false,
        titleStore: "",
        urlStore: "",
        dom: null,
        refreshIntervalId: 0
    },
    enable: true,
    default_enable: true,
    settings: {
        tooltipMode: {
            name: "툴팁 미리보기 표시",
            desc: "마우스를 올려두면 글 내용만 빠르게 볼 수 있는 툴팁을 추가합니다.",
            default: false,
            type: "check"
        },
        tooltipMediaHide: {
            name: "툴팁 미리보기 미디어 숨기기",
            desc: "툴팁 미리보기 화면에서 미디어를 숨깁니다.",
            default: false,
            type: "check"
        },
        reversePreviewKey: {
            name: "키 반전",
            desc: "오른쪽 버튼 대신 왼쪽 버튼으로 미리보기를 엽니다.",
            default: false,
            type: "check"
        },
        longPressDelay: {
            name: "기본 마우스 오른쪽 클릭 딜레이",
            desc:
                "마우스 오른쪽 버튼을 해당 밀리초 이상 눌러 뗄 때 기본 우클릭 메뉴가 나오게 합니다.",
            default: 300,
            type: "range",
            min: 200,
            step: 50,
            max: 2000,
            unit: "ms"
        },
        scrollToSkip: {
            name: "스크롤하여 게시글 이동",
            desc: "맨 위나 아래로 스크롤하여 다음 게시글로 이동할 수 있게 합니다.",
            default: true,
            type: "check"
        },
        colorPreviewLink: {
            name: "게시글 URL 변경",
            desc:
                "미리보기를 열면 게시글의 URL을 변경하여 브라우저 탐색으로 게시글을 바꿀 수 있게 해줍니다.",
            default: true,
            type: "check"
        },
        autoRefreshComment: {
            name: "댓글 자동 새로고침",
            desc: "댓글을 일정 주기마다 자동으로 새로고침합니다.",
            default: false,
            type: "check"
        },
        commentRefreshInterval: {
            name: "댓글 자동 새로고침 주기",
            desc: "위의 옵션이 켜져있을 시 댓글을 새로고침할 주기를 설정합니다.",
            default: 10,
            type: "range",
            min: 1,
            step: 1,
            max: 20,
            unit: "s"
        },
        toggleBlur: {
            name: "게시글 배경 블러 활성화",
            desc:
                "미리보기 창의 배경을 블러 처리하여 미관을 돋보이게 합니다. (성능 하락 영향 있음)",
            default: true,
            type: "check"
        },
        toggleBackgroundBlur: {
            name: "바깥 배경 블러 활성화",
            desc:
                "미리보기 창의 바깥 배경을 블러 처리하여 미관을 돋보이게 합니다. (성능 하락 영향 있음)",
            default: false,
            type: "check"
        },
        toggleAdminPanel: {
            name: "관리 패널 활성화",
            desc: "갤러리에 관리 권한이 있는 경우 창 옆에 관리 패널을 표시합니다.",
            default: true,
            type: "check"
        },
        useKeyPress: {
            name: "관리 패널 > 키 제어",
            desc:
                "관리 패널이 활성화된 경우 단축키를 눌러 빠르게 관리할 수 있습니다.",
            default: true,
            type: "check"
        },
        expandRecognizeRange: {
            name: "게시글 목록 인식 범위 확장",
            desc: "게시글의 오른쪽 클릭을 인식하는 범위를 칸 전체로 확장합니다.",
            default: false,
            type: "check"
        },
        noCacheHeader: {
            name: "no-cache 헤더 추가",
            desc: "전송하는 게시글 요청에 no-cache 헤더를 추가합니다.",
            type: "check",
            default: false,
            advanced: true
        },
        experimentalComment: {
            name: "댓글 기능 활성화",
            desc: "댓글을 작성할 수 있습니다.",
            type: "check",
            default: false
        }
    },
    require: ["filter", "eventBus", "Frame", "http", "block"],
    func(
        filter: RefresherFilter,
        eventBus: RefresherEventBus,
        Frame: RefresherFrame,
        http: RefresherHTTP,
        block: RefresherBlock
    ): void {
        let postFetchedData: PostInfo;
        const makeFirstFrame = (
            frame: RefresherFrame,
            preData: GalleryPreData,
            signal: AbortSignal,
            historySkip?: boolean
        ) => {
            frame.data.load = true;
            frame.title = preData.title || "";
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

            frame.functions.vote = async (type: string) => {
                if (!postFetchedData) {
                    Toast.show("게시글이 로딩될 때까지 잠시 기다려주세요.", true, 3000);
                    return;
                }

                const requireCapCode = postFetchedData.requireCaptcha;

                let codeSrc = "";
                if (requireCapCode) {
                    codeSrc = await request.captcha(preData, "recommend");
                }

                const req = async (captcha?: string) => {
                    const res = await request.vote(
                        preData.gallery,
                        preData.id,
                        type,
                        captcha || undefined,
                        preData.link || ""
                    );

                    if (res.result != "true") {
                        Toast.show(res.counts, true, 2000);

                        return false;
                    }

                    frame[type ? "upvotes" : "downvotes"] = res.counts.replace(
                        /\B(?=(\d{3})+(?!\d))/g,
                        ","
                    );

                    return true;
                };

                if (codeSrc) {
                    return panel.captcha(codeSrc, (str: string) => {
                        req(str);
                    });
                }

                return req();
            };

            frame.functions.share = () => {
                if (!navigator.clipboard) {
                    Toast.show(
                        "이 브라우저는 클립보드 복사 기능을 지원하지 않습니다.",
                        true,
                        3000
                    );
                    return false;
                }

                navigator.clipboard.writeText(
                    `https://gall.dcinside.com/${http.galleryType(
                        preData.link || ""
                    )}/board/view/?id=${preData.gallery || http.queryString("id")}&no=${
                        preData.id
                    }`
                );

                Toast.show("클립보드에 복사되었습니다.", false, 3000);

                return true;
            };

            frame.functions.load = () => {
                frame.error = false;
                frame.data = {};
                frame.data.load = true;

                request
                    .post(
                        preData.link || "",
                        preData.gallery || http.queryString("id") || "",
                        preData.id,
                        signal,
                        this.status.noCacheHeader
                    )
                    .then((obj: PostInfo) => {
                        if (!obj) {
                            return;
                        }

                        if (this.status.colorPreviewLink) {
                            const title = `${obj.title} - ${document.title
                                .split("-")
                                .slice(-1)[0]
                                .trim()}`;

                            if (!historySkip) {
                                preData.title = obj.title;
                                history.replaceState(
                                    {preData, preURL: location.href},
                                    title,
                                    preData.link
                                );
                            }
                            document.title = title;
                        }

                        postFetchedData = obj;

                        frame.contents = obj.contents || "";
                        frame.upvotes = obj.upvotes || "-1";
                        frame.fixedUpvotes = obj.fixedUpvotes || "-1";
                        frame.downvotes = obj.downvotes || "-1";

                        frame.data.disabledDownvote = obj.disabledDownvote;

                        if (frame.title !== obj.title) {
                            frame.title = obj.title || "";
                        }

                        frame.data.user = obj.user;

                        if (obj.date) {
                            frame.data.date = new Date(obj.date.replace(/\./g, "-"));
                        }

                        frame.data.expire = obj.expire;
                        frame.data.buttons = true;
                        frame.data.views = `조회 ${obj.views}회`;

                        eventBus.emit("RefresherPostDataLoaded", obj);
                        eventBus.emit(
                            "RefresherPostCommentIDLoaded",
                            obj.commentId,
                            obj.commentNo
                        );
                        eventBus.emitNextTick("contentPreview", frame.app.$el);

                        frame.data.load = false;
                    })
                    .catch((e: Error) => {
                        frame.error = {
                            title: "게시글",
                            detail: e.message || e.stack || "알 수 없는 오류"
                        };

                        logger("Error occured while loading a post.", e);

                        frame.data.load = false;
                    });
            };

            if (!frame.collapse) {
                frame.functions.load();
            }

            frame.functions.retry = frame.functions.load;

            frame.functions.openOriginal = () => {
                if (this.status.colorPreviewLink) location.reload();
                else location.href = preData.link || location.href;

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
            frame.subtitle = "로딩 중";

            frame.data.useWriteComment = this.status.experimentalComment;

            let postDom: Document;

            new Promise<GalleryPreData>(resolve => {
                eventBus.on(
                    "RefresherPostCommentIDLoaded",
                    (commentId: string, commentNo: string) => {
                        resolve({
                            gallery: commentId,
                            id: commentNo
                        });
                    },
                    {
                        once: true
                    }
                );
            }).then(postData => {
                if (postFetchedData) {
                    postDom = postFetchedData.dom as Document;
                } else {
                    eventBus.on(
                        "RefresherPostDataLoaded",
                        (obj: PostInfo) => {
                            postDom = obj.dom as Document;
                        },
                        {
                            once: true
                        }
                    );
                }

                frame.functions.load = async () => {
                    frame.error = false;

                    return request
                        .comments(
                            {
                                link: preData.link || location.href,
                                gallery: preData.gallery,
                                id: preData.id,
                                commentId: postData.gallery,
                                commentNo: postData.id
                            },
                            signal
                        )
                        .then((comments: dcinsideComments) => {
                            if (!comments) {
                                frame.error = {
                                    detail: "No comments"
                                };
                            }

                            let threadCounts = 0;

                            if (comments.comments) {
                                comments.comments = comments.comments.filter(
                                    (v: dcinsideCommentObject) => {
                                        return v.nicktype !== "COMMENT_BOY";
                                    }
                                );

                                comments.comments.map((v: dcinsideCommentObject) => {
                                    v.user = new User(
                                        v.name,
                                        v.user_id,
                                        v.ip || "",
                                        ((new DOMParser()
                                            .parseFromString(v.gallog_icon, "text/html")
                                            .querySelector("a.writer_nikcon img") ||
                                            {}) as HTMLImageElement).src
                                    );
                                });

                                comments.comments = comments.comments.filter(
                                    (comment: dcinsideCommentObject) => {
                                        return !block.checkAll({
                                            NICK: comment.name,
                                            ID: comment.user_id || "",
                                            IP: comment.ip || ""
                                        });
                                    }
                                );

                                threadCounts = comments.comments
                                    .map((v: dcinsideCommentObject) => Number(v.depth == 0))
                                    .reduce((a: number, b: number) => a + b);
                            }

                            frame.subtitle = `${(comments.total_cnt !== threadCounts &&
                                `쓰레드 ${threadCounts}개, 총 댓글`) ||
                            ""} ${comments.total_cnt}개`;

                            frame.data.comments = comments;
                            frame.data.load = false;
                        })
                        .catch((e: Error) => {
                            frame.subtitle = "";

                            frame.error = {
                                title: "댓글",
                                detail: e.message || e || "알 수 없는 오류"
                            };
                        });
                };

                frame.functions.load();
                frame.functions.retry = frame.functions.load;

                frame.functions.writeComment = async (
                    type: string,
                    memo: string,
                    reply: string | null,
                    user?: User
                ): Promise<boolean> => {
                    // TODO : 디시콘 추가시 type 핸들링 (현재 text만)
                    if (!postFetchedData) {
                        Toast.show("게시글이 로딩될 때까지 잠시 기다려주세요.", true, 3000);
                        return false;
                    }

                    const requireCapCode = postFetchedData.requireCommentCaptcha;

                    const codeSrc = requireCapCode
                        ? await request.captcha(preData, "comment")
                        : "";

                    const req = async (captcha?: string) => {
                        const res = await submitComment(
                            postData,
                            user,
                            postDom,
                            memo,
                            reply,
                            captcha
                        );

                        if (res.result === "false" || res.result === "PreNotWorking") {
                            alert(res.message);
                            return false;
                        } else {
                            return true;
                        }
                    };

                    if (codeSrc) {
                        return new Promise(resolve =>
                            panel.captcha(codeSrc, async (str: string) => {
                                resolve(await req(str));
                            })
                        );
                    }

                    return req();
                };

                if (this.memory.refreshIntervalId) {
                    clearInterval(this.memory.refreshIntervalId);
                }

                this.memory.refreshIntervalId = setInterval(() => {
                    if (this.status.autoRefreshComment) {
                        frame.functions.retry();
                    }
                }, this.status.commentRefreshInterval * 1000);
            });

            const deletePressCount: { [index: string]: number } = {};

            frame.functions.deleteComment = async (
                commentId: string,
                password: string,
                admin: boolean
            ): Promise<boolean> => {
                if (!preData.link) {
                    return false;
                }

                if (!password) {
                    if (deletePressCount[commentId] + 1000 < Date.now()) {
                        deletePressCount[commentId] = 0;
                    }

                    if (!deletePressCount[commentId]) {
                        Toast.show("한번 더 누르면 댓글을 삭제합니다.", true, 1000);

                        deletePressCount[commentId] = Date.now();

                        return false;
                    }

                    deletePressCount[commentId] = 0;
                }

                const typeName = http.galleryTypeName(preData.link);
                if (!typeName.length) {
                    return false;
                }

                return (admin && !password
                    ? request.adminDeleteComment(preData, commentId, signal)
                    : request.userDeleteComment(preData, commentId, signal, password)
                )
                    .then(v => {
                        if (typeof v === "boolean") {
                            if (!v) {
                                return false;
                            }

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
                                Toast.show("댓글을 삭제하였습니다.", false, 3000);
                            } else {
                                Toast.show(parsed.msg, true, 5000);
                            }
                        }

                        frame.functions.load();

                        return true;
                    })
                    .catch(() => {
                        return false;
                    });
            };
        };

        const newPostWithData = (
            preData: GalleryPreData,
            historySkip?: boolean
        ) => {
            const firstApp = frame.app.first();
            const secondApp = frame.app.second();

            if (firstApp.data.load) {
                return;
            }

            const params = new URLSearchParams(preData.link);
            params.set("no", preData.id);
            preData.link = unescape(params.toString());

            preData.title = "게시글 로딩 중...";
            firstApp.contents = "";

            makeFirstFrame(firstApp, preData, this.memory.signal, historySkip);
            makeSecondFrame(secondApp, preData, this.memory.signal);

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

            miniPreview.close(this.status.tooltipMode);

            let preData: GalleryPreData | undefined;
            if (ev) {
                preData = getRelevantData(ev);
            } else if (prd) {
                preData = prd;
            }

            if (!preData) {
                return;
            }

            let collapseView = false;

            if (ev && ev.target) {
                collapseView = (ev.target as HTMLElement).className.includes("reply_num");
            }

            if (!historySkip) {
                this.memory.titleStore = document.title;
                this.memory.urlStore = location.href;
            }

            const controller = new AbortController();
            this.memory.signal = controller.signal;

            let appStore: RefresherFrameAppVue;
            let groupStore: HTMLElement;

            const detector = new ScrollDetection();
            let scrolledCount = 0;

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
                        if (!this.status.scrollToSkip) {
                            return;
                        }

                        appStore = app;
                        groupStore = group;

                        detector.addMouseEvent(ev);
                    },
                    blur: this.status.toggleBackgroundBlur
                }
            );

            detector.listen("scroll", (ev: WheelEvent) => {
                // TODO: 다음 게시글이 작동은 안하는데 고치기는 귀찮으니 미래의 나한테 토스

                const scrolledTop = groupStore.scrollTop === 0;
                const scrolledToBottom =
                    groupStore.scrollHeight - groupStore.scrollTop ===
                    groupStore.clientHeight;

                if (!scrolledTop && !scrolledToBottom) {
                    scrolledCount = 0;
                }

                if (ev.deltaY < 0) {
                    appStore.$data.scrollModeBottom = false;
                    appStore.$data.scrollModeTop = true;

                    if (!scrolledTop) {
                        appStore.$data.scrollModeTop = false;
                        appStore.$data.scrollModeBottom = false;
                    }

                    if (!scrolledTop || !preData) {
                        return;
                    }

                    if (scrolledCount < 1) {
                        scrolledCount++;
                        return;
                    }
                    scrolledCount = 0;

                    preData.id = (Number(preData.id) - 1).toString();

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

                    if (scrolledCount < 1) {
                        scrolledCount++;
                        return;
                    }
                    scrolledCount = 0;

                    if (!frame || !frame.app.first().error) {
                        preData.id = (Number(preData.id) + 1).toString();
                    }

                    newPostWithData(preData, historySkip);

                    groupStore.scrollTop = 0;
                    appStore.clearScrollMode();
                }
            });

            frame.app.$on("close", () => {
                controller.abort();

                const blockPopup = document.querySelector(".refresher-block-popup");
                if (blockPopup) {
                    blockPopup.parentElement?.removeChild(blockPopup);
                }

                const captchaPopup = document.querySelector(".refresher-captcha-popup");
                if (captchaPopup) {
                    captchaPopup.parentElement?.removeChild(captchaPopup);
                }

                const adminPanel = document.getElementById("refresher-management-panel");
                if (adminPanel) {
                    adminPanel.parentElement?.removeChild(adminPanel);
                }

                if (adminKeyPress) {
                    document.removeEventListener("keypress", adminKeyPress);
                }

                if (!this.memory.historyClose) {
                    history.pushState(null, this.memory.titleStore, this.memory.urlStore);

                    this.memory.historyClose = false;
                }

                if (this.memory.titleStore) {
                    document.title = this.memory.titleStore;
                }

                clearInterval(this.memory.refreshIntervalId);
            });

            frame.app.frames[0].collapse = collapseView;

            makeFirstFrame(
                frame.app.first(),
                preData,
                this.memory.signal,
                historySkip
            );

            makeSecondFrame(frame.app.second(), preData, this.memory.signal);

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

            setTimeout(() => {
                frame.app.fadeIn();
            }, 0);

            if (ev) {
                ev.preventDefault();
            }
        };

        const handleMousePress = (ev: MouseEvent) => {
            if (ev.button != 2) {
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

        const addHandler = (e: HTMLElement) => {
            e.addEventListener("mouseup", handleMousePress);
            e.addEventListener("mousedown", handleMousePress);
            e.addEventListener(this.status.reversePreviewKey ? "click" : "contextmenu", previewFrame);

            if (this.status.reversePreviewKey) {
                e.addEventListener("contextmenu", e => {
                    e.preventDefault();

                    let href = (e.target as HTMLAnchorElement).href;

                    if (!href) {
                        if ((e.target as HTMLElement).tagName === "TR") {
                            href = document.querySelector("a")?.getAttribute("href") || "";
                        } else {
                            href =
                                findNeighbor(
                                    e.target as HTMLElement,
                                    "a",
                                    5,
                                    null
                                )?.getAttribute("href") || "";
                        }
                    }

                    location.href = href;
                });
            }
            e.addEventListener("mouseenter", ev =>
                miniPreview.create(ev, this.status.tooltipMode, this.status.tooltipMediaHide)
            );
            e.addEventListener("mousemove", ev =>
                miniPreview.move(ev, this.status.tooltipMode)
            );
            e.addEventListener("mouseleave", () =>
                miniPreview.close(this.status.tooltipMode)
            );
        };

        this.memory.uuid = filter.add(
            `.gall_list .us-post${
                this.status.expandRecognizeRange ? "" : " .ub-word"
            }`,
            addHandler,
            {
                neverExpire: true
            }
        );
        this.memory.uuid2 = filter.add("#right_issuezoom", addHandler);

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

    revoke(filter: RefresherFilter): void {
        if (this.memory.uuid) {
            filter.remove(this.memory.uuid, true);
        }

        if (this.memory.uuid2) {
            filter.remove(this.memory.uuid2, true);
        }

        window.removeEventListener("popstate", this.memory.popStateHandler);
        clearInterval(this.memory.refreshIntervalId);
    }
};