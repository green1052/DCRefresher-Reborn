import toast from "./toastComponent.vue";
import Vue from "vue";

let Toast: Vue;

const element = document.createElement("refresher-toast");

const initToast = () => {
    if (!document.querySelector(".refresher-toast")) {
        document.querySelector("body")?.appendChild(element);
    }

    Toast = new Vue({
        el: element,
        render: h => h(toast)
    }).$children[0];
};

window.addEventListener("DOMContentLoaded", initToast);

window.addEventListener("keydown", ev => {
    if (ev.keyCode == 27 && Toast.$data.open) Toast.$data.open = false;
});

/**
 * 토스트를 표시합니다.
 *
 * @param content 토스트의 내용
 * @param icon 토스트의 아이콘
 * @param type 토스트가 에러인지의 여부
 * @param autoClose 토스트가 자동으로 닫힐 시간
 * @param click 클릭하면 실행할 함수
 */
export const show = (
    content: string,
    type: boolean,
    autoClose: number,
    click?: () => void
): void => {
    if (!document.querySelector(".refresher-toast")) {
        initToast();
    }

    if (Toast.$data.autoClose) {
        clearTimeout(Toast.$data.autoClose);
    }

    Toast.update(content, type, autoClose, click);
    Toast.show();
};

export default Toast;