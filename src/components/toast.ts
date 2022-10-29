import Vue from "vue";

let Toast: Vue;
Vue.component("refresher-toast", {
    template: `
  <transition name="refresher-toast" appear>
    <div class="refresher-toast" :class="{hover: this.$root.clickCb}" :title="this.$root.content" :data-type="this.$root.type" :key="this.$root.id" v-show="this.$root.open">
      <div class="contents" v-on:click="click">
        <div class="text">
          <p>{{this.$root.content}}</p>
        </div>
        <div class="button" v-on:click="this.$root.hide">
          <i class="material-icons">X</i>
        </div>
      </div>
    </div>
  </transition>
  `,
    methods: {
        click (ev) {
            if (this.$root.clickCb) {
                this.$root.clickCb(ev.target);
            }
        }
    }
});

const initToast = () => {
    if (!document.querySelector(".refresher-toast")) {
        const element = document.createElement("refresher-toast");
        document.querySelector("body")?.appendChild(element);
    }

    Toast = new Vue({
        el: "refresher-toast",
        data: () => {
            return {
                title: "",
                id: 0,
                content: "",
                clickCb: () => {},
                open: false,
                type: "",
                autoClose: 0
            };
        },
        methods: {
            update (
                content: string,
                type: string,
                autoClose: boolean,
                click?: () => void
            ) {
                this.content = content;
                this.id = Math.random();
                this.type = typeof type === "boolean" ? (type ? "error" : "info") : type;
                this.clickCb = click;

                if ((typeof autoClose !== "boolean" && !autoClose) || autoClose) {
                    this.autoClose = window.setTimeout(
                        this.hide,
                        autoClose && typeof autoClose === "number" ? autoClose : 5000
                    );
                }
            },

            show () {
                this.open = true;
            },

            hide () {
                this.open = false;
            }
        }
    });
};

window.addEventListener("DOMContentLoaded", initToast);

window.addEventListener("keydown", ev => {
    if (ev.keyCode == 27 && Toast.open) Toast.open = false;
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

    if (Toast.autoClose) {
        clearTimeout(Toast.autoClose);
    }

    Toast.update(content, type, autoClose, click);
    Toast.show();
};

export default Toast;