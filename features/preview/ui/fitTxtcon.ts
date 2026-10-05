import {graphemes, wrapTxtcon} from "@/core/preview/txtcon";

/* ===== 글자콘: 디시 txtcon_view.js를 옮긴 것 (디시 스크립트는 shadow DOM 안을 건드리지 못한다) ===== */

/** 박스에 넘치지 않는 최대 글자 크기를 16~72px에서 이진 탐색한다. 줄 수는 16px일 때로 고정하고, 폭이 넘치면 break-all로 바꾼다. */
export const fitTxtcon = (box: HTMLElement): void => {
    const txt = box.querySelector<HTMLElement>(".txtcon_txt");
    if (!txt || !box.getClientRects().length) return;

    Object.assign(txt.style, {wordBreak: "keep-all", overflowWrap: "normal", whiteSpace: "pre-line", letterSpacing: "", transform: ""});

    // 크기를 잴 인라인 span. 다시 불려도 wrapTxtcon은 이미 나눈 줄을 그대로 둔다.
    const meas = document.createElement("span");
    meas.textContent = wrapTxtcon(Array.from(txt.childNodes, (node) => (node.nodeName === "BR" ? "\n" : node.textContent)).join(""));
    txt.replaceChildren(meas);

    const style = getComputedStyle(box);
    const availW = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availH = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const tol = 0.5 / devicePixelRatio;

    const fit = (floor: number, keepLines: boolean): void => {
        txt.style.fontSize = `${floor}px`;
        const baseLines = keepLines ? meas.getClientRects().length : Infinity;
        let min = floor, max = 72, best = floor;
        while (min <= max) {
            const mid = Math.floor((min + max) / 2);
            txt.style.fontSize = `${mid}px`;
            const rect = meas.getBoundingClientRect();
            if (rect.width <= availW + tol && rect.height <= availH + tol && meas.getClientRects().length <= baseLines) {
                best = mid;
                min = mid + 1;
            } else {
                max = mid - 1;
            }
        }
        txt.style.fontSize = `${best}px`;
    };

    fit(16, true);
    if (meas.getBoundingClientRect().width > availW + tol) {
        txt.style.wordBreak = "break-all";
        fit(16, true);
    }

    // 16px로도 크게 넘치면 10px까지 줄여 담는다 (줄 수 제한 없음).
    const over = meas.getBoundingClientRect();
    if (over.height - availH > 4 || over.width - availW > 4) fit(10, false);

    // 남는 폭을 자간으로 채운다. 마지막 글자 뒤 자간만큼 치우치므로 transform으로 보정한다.
    // 글자 수는 디시처럼 이스케이프된 채로 센다 (&는 &amp; 5글자). 그래야 디시와 같은 자간이 나온다.
    const longest = Math.max(...meas.innerHTML.split("\n").map((line) => graphemes(line).length));
    const slack = availW - meas.getBoundingClientRect().width;
    if (longest > 1 && slack > 1) {
        const spacing = slack / longest;
        txt.style.letterSpacing = `calc(-0.045em + ${spacing.toFixed(2)}px)`;
        txt.style.transform = `translate(${(spacing / 2).toFixed(2)}px, -0.05em)`;
    }
};
