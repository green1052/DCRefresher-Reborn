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
    const overlay = document.createElement("div");
    overlay.className = "refresher-memo-overlay";

    document.querySelector(".refresher-memo-overlay")?.remove();

    let currentType = type;
    let currentValue = value;

    const dialog = document.createElement("div");
    dialog.className = "refresher-memo-dialog";
    dialog.innerHTML = `
  <div class="refresher-memo-header">
    <h3>메모 추가</h3>
    <button type="button" class="refresher-memo-close" aria-label="닫기"></button>
  </div>
  <div class="refresher-memo-target">
    <span class="refresher-memo-target-label">대상</span>
    <span class="refresher-memo-target-value"></span>
  </div>
  <div class="refresher-memo-segment">
    <button type="button" class="refresher-memo-seg" data-type="NICK">닉네임</button>
    <button type="button" class="refresher-memo-seg" data-type="UID">아이디</button>
    <button type="button" class="refresher-memo-seg" data-type="IP">IP</button>
  </div>
  <div class="refresher-memo-field">
    <label for="refresher_memo">메모</label>
    <input id="refresher_memo" type="text" maxlength="160" placeholder="메모를 입력해주세요 (160자 제한)">
  </div>
  <div class="refresher-memo-field refresher-memo-color-field">
    <label for="refresher_memo_color">색상</label>
    <div class="refresher-memo-color-wrap">
      <input type="color" id="refresher_memo_color">
      <button type="button" class="refresher-memo-color-random" title="랜덤 색상">랜덤</button>
    </div>
  </div>
  <div class="refresher-memo-actions">
    <button type="button" class="refresher-memo-btn danger" data-clear="true">삭제</button>
    <button type="button" class="refresher-memo-btn primary" data-update="true">추가</button>
  </div>
  `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    let onDismiss: (() => void) | null = null;
    let closed = false;

    const close = () => {
        if (closed) return;
        closed = true;

        window.removeEventListener("keydown", onKeydown);
        overlay.classList.add("leaving");

        setTimeout(() => overlay.remove(), 200);

        if (onDismiss) {
            onDismiss();
            onDismiss = null;
        }
    };

    const onKeydown = (ev: KeyboardEvent) => {
        if (ev.code === "Escape") close();
    };

    overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) close();
    });
    dialog.querySelector(".refresher-memo-close")!.addEventListener("click", close);
    window.addEventListener("keydown", onKeydown);

    requestAnimationFrame(() => overlay.classList.add("visible"));

    const memoInput = dialog.querySelector<HTMLInputElement>("#refresher_memo")!;
    const colorInput = dialog.querySelector<HTMLInputElement>("#refresher_memo_color")!;
    const targetValue = dialog.querySelector<HTMLSpanElement>(".refresher-memo-target-value")!;
    const randomBtn = dialog.querySelector<HTMLButtonElement>(".refresher-memo-color-random")!;

    const randomColor = () => {
        colorInput.value = `#${Math.random().toString(16).slice(2, 8).padStart(6, "0")}`;
    };

    const updateType = () => {
        targetValue.textContent = `${memo.TYPE_NAMES[currentType]}: ${currentValue}`;

        memoInput.value = "";
        colorInput.value = "";
        randomColor();

        const previous = memo.get(currentType, currentValue);
        if (previous) {
            memoInput.value = previous.text;
            colorInput.value = previous.color;
        }
    };

    dialog.querySelectorAll<HTMLButtonElement>(".refresher-memo-seg").forEach((seg) => {
        const segType = seg.dataset.type as RefresherMemoType;

        if (!selected[segType]) seg.classList.add("disabled");
        if (segType === currentType) seg.classList.add("active");

        seg.addEventListener("click", () => {
            if (seg.classList.contains("disabled")) return;

            dialog.querySelectorAll(".refresher-memo-seg").forEach((s) => s.classList.remove("active"));
            seg.classList.add("active");

            currentType = segType ?? "NICK";
            currentValue = selected[currentType] ?? "";

            updateType();
        });
    });

    updateType();

    randomBtn.addEventListener("click", randomColor);

    memoInput.addEventListener("keydown", (e) => {
        if (e.code === "Enter") {
            dialog.querySelector<HTMLButtonElement>(".refresher-memo-btn[data-update=true]")!.click();
        }
    });

    return new Promise<MemoAskResult>((resolve, reject) => {
        onDismiss = () => reject(new Error("Dialog dismissed"));

        dialog.querySelector<HTMLButtonElement>(".refresher-memo-btn[data-update=true]")!.addEventListener("click", () => {
            onDismiss = null;
            if (memoInput.value.length > 160) {
                alert("160자를 초과할 수 없습니다.");
                return;
            }

            close();
            resolve({text: memoInput.value, color: colorInput.value, type: currentType, value: currentValue});
        });

        dialog.querySelector<HTMLButtonElement>(".refresher-memo-btn[data-clear=true]")!.addEventListener("click", () => {
            onDismiss = null;
            close();
            resolve({text: "", color: "", type: currentType, value: currentValue});
        });
    });
}