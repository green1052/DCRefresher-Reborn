import type {NullableProperties} from "./types";

export interface MemoAskResult {
    text: string;
    color: string;
    type: RefresherMemoType;
    value: string;
}

export function memoAsk(
    selected: NullableProperties<Record<RefresherMemoType, string>>,
    memo: RefresherMemo,
    type: RefresherMemoType,
    value: string
): Promise<MemoAskResult> {
    const win = document.createElement("div");
    win.className = "refresher-frame-outer center background";

    let currentType = type;
    let currentValue = value;

    const frame = document.createElement("div");
    frame.className = "refresher-frame refresher-memo-frame center";
    frame.innerHTML = `
  <h3 class="head">메모 종류 선택 <span class="refresher-memo-type mute"></span></h3>
  <div class="memo-row memo-user-type">
    <div class="user-type nick" data-type="NICK">
      <p>닉네임</p>
    </div>
    <div class="user-type uid" data-type="UID">
      <p>아이디</p>
    </div>
    <div class="user-type ip" data-type="IP">
      <p>IP</p>
    </div>
  </div>
  <div class="memo-row">
    <p>메모</p>
    <div class="refresher-input-wrap focus">
      <input id="refresher_memo" type="text" maxlength="160" placeholder="메모를 입력해주세요 (160자 제한)"></input>
    </div>
  </div>
  <div class="memo-row">
    <p>색상</p>
    <br>
    <input type="color" id="refresher_memo_color"></input>
  </div>
  <div class="button-wrap">
    <div class="refresher-preview-button primary" data-update="true"><p>추가</p></div>
    <div class="refresher-preview-button sub" data-clear="true"><p>삭제</p></div>
  </div>
  `;

    win.appendChild(frame);
    document.body.appendChild(win);

    let onDismiss: (() => void) | null = null;
    let closed = false;

    const removeWindow = () => {
        if (closed) return;
        closed = true;

        window.removeEventListener("keydown", removeWindowKey);
        win.classList.remove("fadeIn");
        win.classList.add("fadeOut");

        setTimeout(() => win.remove(), 300);

        if (onDismiss) {
            onDismiss();
            onDismiss = null;
        }
    };

    const removeWindowKey = (ev: KeyboardEvent) => {
        if (ev.code === "Escape") removeWindow();
    };

    win.addEventListener("click", (ev) => {
        if (ev.target === win) removeWindow();
    });

    window.addEventListener("keydown", removeWindowKey);

    requestAnimationFrame(() => win.classList.add("fadeIn"));

    const memoElement = frame.querySelector<HTMLInputElement>("#refresher_memo")!;
    const colorElement = frame.querySelector<HTMLInputElement>("#refresher_memo_color")!;

    const randomColor = () => {
        colorElement.value = `#${Math.random().toString(16).slice(2, 8).padStart(6, "0")}`;
    };

    const updateType = () => {
        frame.querySelector(".refresher-memo-type")!.innerHTML = `${memo.TYPE_NAMES[currentType]}: ${currentValue}`;

        memoElement.value = "";
        colorElement.value = "";
        randomColor();

        const previous = memo.get(currentType, currentValue);
        if (previous) {
            memoElement.value = previous.text;
            colorElement.value = previous.color;
        }
    };

    frame.querySelectorAll<HTMLElement>(".user-type").forEach((userType) => {
        userType.classList.remove("active");

        const userTypeKey = userType.dataset.type as RefresherMemoType;

        if (userTypeKey === currentType) userType.classList.add("active");
        if (!selected[userTypeKey]) userType.classList.add("disable");

        userType.addEventListener("click", () => {
            if (userType.classList.contains("disable")) return;

            frame.querySelectorAll(".user-type").forEach((ut) => ut.classList.remove("active"));
            userType.classList.add("active");

            currentType = userTypeKey ?? "NICK";
            currentValue = selected[currentType] ?? "";

            updateType();
        });
    });

    updateType();

    memoElement.addEventListener("keyup", (e) => {
        if (e.code === "Enter") {
            frame.querySelector<HTMLDivElement>(".refresher-preview-button[data-update=true]")!.click();
        }
    });

    return new Promise<MemoAskResult>((resolve, reject) => {
        onDismiss = () => reject(new Error("Dialog dismissed"));

        frame.querySelector(".refresher-preview-button[data-update=true]")?.addEventListener("click", () => {
            onDismiss = null;
            if (memoElement.value.length > 160) {
                alert("160자를 초과할 수 없습니다.");
                return;
            }

            removeWindow();
            resolve({text: memoElement.value, color: colorElement.value, type: currentType, value: currentValue});
        });

        frame.querySelector(".refresher-preview-button[data-clear=true]")?.addEventListener("click", () => {
            onDismiss = null;
            removeWindow();
            resolve({text: "", color: "", type: currentType, value: currentValue});
        });
    });
}