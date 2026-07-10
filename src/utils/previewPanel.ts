import type Frame from "../core/frame";
import type {PreviewRequest} from "./previewRequest";
import {getAssetURL} from "./assetURL";
import toast from "./toast";

const KEY_COUNTS: Record<string, [number, number]> = {};

export interface BlockPreset {
    day: string;
    reason: string;
    delete: boolean;
    user_type: boolean;
}

export const blockPreset: BlockPreset = {
    day: "",
    reason: "",
    delete: false,
    user_type: false
};

let adminKeyPressHandler: ((ev: KeyboardEvent) => void) | null = null;

export const panel = {
    block(
        callback: (
            avoidHour: number,
            avoidReason: number,
            avoidReasonTxt: string,
            delChk: number,
            userType: number
        ) => void,
        closeCallback: () => void
    ): void {
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
            <label><input type="radio" name="duration" value="744" />31일</label>
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

        let avoidHour = 1;
        let avoidReason = 1;

        element.querySelector(".close")?.addEventListener("click", closeCallback);

        element.querySelectorAll("input[type=radio]").forEach((v) => {
            v.addEventListener("click", (ev) => {
                const selected = ev.target as HTMLInputElement;
                if (!selected) return;

                if (selected.getAttribute("name") === "duration") {
                    avoidHour = Number(selected.value);
                }

                if (selected.getAttribute("name") === "reason") {
                    const value = Number(selected.value);
                    const blockReasonInput = element.querySelector<HTMLInputElement>("input[name=reason_text]")!;
                    blockReasonInput.style.display = value ? "none" : "block";
                    avoidReason = value;
                }
            });
        });

        element.querySelector(".go-block")!.addEventListener("click", () => {
            const avoidReasonTxt = element.querySelector<HTMLInputElement>("input[name=reason_text]")!.value;
            const delChk = element.querySelector<HTMLInputElement>("input[name=remove]")!.checked;
            const userType = element.querySelector<HTMLInputElement>("input[name=user-type]")!.checked;

            callback(avoidHour, avoidReason, avoidReasonTxt, delChk ? 1 : 0, userType ? 1 : 0);
        });

        document.body.appendChild(element);
    },

    admin(
        preData: GalleryPreData,
        frame: Frame,
        toggleBlur: boolean,
        eventBus: RefresherEventBus,
        useKeyPress: boolean,
        request: PreviewRequest
    ): HTMLElement {
        document.querySelector(".refresher-block-popup")?.remove();
        document.querySelector(".refresher-management-panel")?.remove();

        let setAsNotice = !preData.notice;
        let setAsRecommend = !preData.recommend;

        const element = document.createElement("div");
        element.id = "refresher-management-panel";
        element.className = "refresher-management-panel";

        if (toggleBlur) element.classList.add("blur");

        element.innerHTML = `
      <div class="button pin">
        <img src="${getAssetURL("pin")}"></img>
        <p>${setAsNotice ? "공지로 등록" : "공지 등록 해제"}</p>
      </div>
      <div class="button recommend">
        <img src="${getAssetURL(setAsRecommend ? "upvote" : "downvote")}"></img>
        <p>${setAsRecommend ? "개념글 등록" : "개념글 해제"}</p>
      </div>
      <div class="button block">
        <img src="${getAssetURL("block")}"></img>
        <p>차단 (B)</p>
      </div>
      <div class="button delete">
        <img src="${getAssetURL("delete")}"></img>
        <p>삭제 (D)</p>
      </div>
      <div class="button bump">
        <img src="${getAssetURL("upvote")}"></img>
        <p>끌올</p>
      </div>
    `;

        const handleResponse = (response: unknown) => {
            eventBus.emit("refreshRequest");

            if (typeof response === "object" && response !== null) {
                const r = response as { msg: string; result: string };
                toast.show(r.msg, r.result === "success" ? "info" : "error");
                return;
            }

            toast.show(String(response), "error");
        };

        const deleteFunction = () => {
            frame.app?.close();
            request.delete(preData).then(handleResponse);
        };

        const blockFunction = () => {
            frame.app?.close();
            request
                .block(preData, Number(blockPreset.day), 0, blockPreset.reason, blockPreset.delete ? 1 : 0, blockPreset.user_type ? 1 : 0)
                .then(handleResponse);
        };

        element.querySelector(".delete")?.addEventListener("click", deleteFunction);

        if (adminKeyPressHandler) {
            document.removeEventListener("keypress", adminKeyPressHandler);
        }

        if (useKeyPress) {
            adminKeyPressHandler = (ev: KeyboardEvent) => {
                if (frame.app?.inputFocus) return;

                if (ev.code !== "KeyB" && ev.code !== "KeyD") return;

                if (!KEY_COUNTS[ev.code]) KEY_COUNTS[ev.code] = [Date.now(), 0];
                if (Date.now() - KEY_COUNTS[ev.code][0] > 1000) KEY_COUNTS[ev.code] = [Date.now(), 0];

                KEY_COUNTS[ev.code][0] = Date.now();
                KEY_COUNTS[ev.code][1]++;

                if (ev.code === "KeyD") {
                    if (KEY_COUNTS[ev.code][1] >= 2) {
                        deleteFunction();
                        KEY_COUNTS[ev.code][1] = 0;
                    } else {
                        toast.show("한번 더 D키를 누르면 게시글을 삭제합니다.", "warning", 1000);
                    }
                } else if (ev.code === "KeyB") {
                    if (KEY_COUNTS[ev.code][1] >= 2) {
                        blockFunction();
                        KEY_COUNTS[ev.code][1] = 0;
                    } else {
                        toast.show("한번 더 B키를 누르면 차단합니다.", "warning", 1000);
                    }
                }
            };

            document.addEventListener("keypress", adminKeyPressHandler);
        }

        element.querySelector(".block")?.addEventListener("click", () => {
            panel.block(
                (avoidHour, avoidReason, avoidReasonTxt, delChk, userType) => {
                    request
                        .block(preData, avoidHour, avoidReason, avoidReasonTxt, delChk, userType)
                        .then((response) => {
                            eventBus.emit("refreshRequest");

                            if (typeof response === "object" && response !== null) {
                                const r = response as { msg: string; result: string };
                                if (r.result === "success") {
                                    toast.show(r.msg);
                                    if (delChk) frame.app?.close();
                                } else {
                                    toast.show(r.msg, "error");
                                }
                                return;
                            }

                            toast.show(String(response), "error");
                        });
                },
                () => document.querySelector(".refresher-block-popup")?.remove()
            );
        });

        const pin = element.querySelector<HTMLElement>(".pin")!;
        pin.addEventListener("click", () => {
            request.setNotice(preData, setAsNotice).then((response) => {
                eventBus.emit("refreshRequest");

                if (typeof response === "object" && response !== null) {
                    const r = response as { msg: string; result: string };
                    if (r.result === "success") {
                        toast.show(r.msg);
                        setAsNotice = !setAsNotice;
                        pin.querySelector<HTMLElement>("p")!.innerHTML = setAsNotice ? "공지로 등록" : "공지 등록 해제";
                    } else {
                        toast.show(r.msg, "error");
                    }
                    return;
                }

                toast.show(String(response), "error");
            });
        });

        const recommend = element.querySelector<HTMLElement>(".recommend")!;
        recommend.addEventListener("click", () => {
            request.setRecommend(preData, setAsRecommend).then((response) => {
                eventBus.emit("refreshRequest");

                if (typeof response === "object" && response !== null) {
                    const r = response as { msg: string; result: string };
                    if (r.result === "success") {
                        toast.show(r.msg);
                        setAsRecommend = !setAsRecommend;
                        const recommendImg = recommend.querySelector("img") as HTMLImageElement;
                        recommendImg.src = getAssetURL(setAsRecommend ? "upvote" : "downvote");
                        recommend.querySelector("p")!.innerHTML = setAsRecommend ? "개념글 등록" : "개념글 해제";
                    } else {
                        toast.show(r.msg, "error");
                    }
                    return;
                }

                toast.show(String(response), "error");
            });
        });

        element.querySelector<HTMLElement>(".bump")?.addEventListener("click", () => {
            request.bump(preData).then(handleResponse);
        });

        document.body.appendChild(element);

        return element;
    },

    async captcha(src: string, callback: (captcha: string) => void): Promise<boolean> {
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

        const inputEvent = () => {
            const input = element.querySelector("input")!.value;
            if (!input) return;
            callback(input);
            element.remove();
        };

        element.querySelector("input")!.addEventListener("keydown", (e) => {
            if (e.key === "Enter") inputEvent();
        });

        element.querySelector(".close")!.addEventListener("click", () => element.remove());
        element.querySelector("button")!.addEventListener("click", inputEvent);

        document.body.appendChild(element);
        setTimeout(() => element.querySelector("input")!.focus(), 0);

        return true;
    }
};

export function removeAdminKeyPressHandler(): void {
    if (adminKeyPressHandler) {
        document.removeEventListener("keypress", adminKeyPressHandler);
        adminKeyPressHandler = null;
    }
}