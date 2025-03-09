import * as http from "./http";
import $ from "cash-dom";
import ky from "ky";
import type { Nullable } from "./types";
import browser from "webextension-polyfill";

const rKey = "yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBs1Ct2D3uE4Fv5G6wHl78xJ9K";
const rRegex = /[^A-Za-z0-9+/=]/g;

const decode = (r: string) => {
    let a;
    let e;
    let n;
    let t;
    let f;
    let d;
    let h;
    let o = "";
    let c = 0;

    for (r = r.replace(rRegex, ""); c < r.length; ) {
        t = rKey.indexOf(r.charAt(c++));
        f = rKey.indexOf(r.charAt(c++));
        d = rKey.indexOf(r.charAt(c++));
        h = rKey.indexOf(r.charAt(c++));
        a = (t << 2) | (f >> 4);
        e = ((15 & f) << 4) | (d >> 2);
        n = ((3 & d) << 6) | h;
        o += String.fromCharCode(a);

        if (d !== 64) o += String.fromCharCode(e);

        if (h !== 64) o += String.fromCharCode(n);
    }

    return o;
};

const requestBeforeServiceCode = (dom: Document) => {
    const $dom = $(dom);

    const script = $dom.find("#reply-setting-tmpl + script");

    if (!script.length) throw "_r 값을 찾을 수 없습니다.";

    const dValue = script.html().match(/_d\('(.*)'\)/)?.[1];

    if (!dValue) throw "_d 값을 찾을 수 없습니다.";

    let _r = decode(dValue);

    if (!_r) throw "_r이 적절한 값이 아닙니다.";

    let fi = parseInt(_r.slice(0, 1));
    fi = fi > 5 ? fi - 5 : fi + 4;

    _r = _r.replace(/^./, fi.toString());

    const r = $dom.find("input[name=service_code]").val() as string;

    const _rs = _r.split(",");

    let t = "";

    for (let e = 0; e < _rs.length; e++) {
        t += String.fromCharCode((2 * (Number(_rs[e]) - e - 1)) / (13 - e - 1));
    }

    return r.replace(/(.{10})$/, t);
};

const secretKey = (dom: Document): URLSearchParams => {
    const params = new URLSearchParams();
    params.set("t_vch2", "");
    params.set("t_vch2_chk", "");

    for (const element of $(dom).find("#focus_cmt > input")) {
        const $element = $(element);

        const id = $element.attr("name") ?? $element.attr("id")!;

        if (!["service_code", "gallery_no", "clickbutton"].includes(id))
            params.set(id, $element.val() as string);
    }

    return params;
};

interface CommentResult {
    result: string;
    message: Nullable<string>;
}

export async function submitComment(
    preData: GalleryPreData,
    user: { name: string; pw?: string },
    dom: Document,
    memo: string | DcinsideDccon[],
    reply: string | null,
    captcha?: string,
    grecaptcha?: string
): Promise<CommentResult> {
    let code: string;

    try {
        code = requestBeforeServiceCode(dom);
    } catch (e) {
        return {
            result: "PreNotWorking",
            message: (e as string) || "사전에 정의되지 않은 오류."
        };
    }

    const params = new URLSearchParams(secretKey(dom));
    params.set("service_code", code);
    params.set("c_gall_id", preData.gallery);
    params.set("c_gall_no", preData.id);

    params.set("id", preData.gallery);
    params.set("no", preData.id);

    if (reply) params.set("c_no", reply);

    params.set("name", user.name);
    if (user.pw) params.set("password", user.pw);
    params.set("use_gall_nick", "N");

    if (captcha) params.set("code", captcha);

    if (grecaptcha) {
        params.set("g-recaptcha-response", grecaptcha);
    }

    if (typeof memo === "string") {
        params.set("memo", memo);
    } else {
        params.set("input_type", "comment");

        if (memo.length > 1) params.set("double_con_chk", "1");
        params.set("package_idx", memo.map((dccon) => dccon.package_idx).join(","));
        params.set("detail_idx", memo.map((dccon) => dccon.detail_idx).join(","));
    }

    const url =
        typeof memo === "string" ? http.urls.comments_submit : http.urls.dccon_comments_submit;
    const options = {
        method: "POST",
        headers: {
            "X-Requested-With": "XMLHttpRequest"
        },
        body: params
    };

    const response =
        browser.runtime.getManifest().manifest_version === 2
            ? await content.fetch(url, options).then((response) => response.text())
            : await ky(url, options).text();

    const [result, message] = response.split("||");

    return {
        result,
        message
    };
}
