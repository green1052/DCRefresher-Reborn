export default {
    name: "HIT 갤러리 팝업 제거",
    description: "(작동 안함) 하단 HIT 갤러리 게시물 팝업을 숨깁니다.",
    author: {name: "green1052"},
    url: /gall\.dcinside\.com/,
    enable: false,
    default_enable: false,
    require: [],
    memory: {},
    func () {
        // const code = `
        //     window.addEventListener("load", () => {
        //         if (window.alarm_polling === undefined) return;
        //         const code = window.alarm_polling.toString().split("\\n");
        //         delete code[0];
        //         code[18] += \`if (alType === "hit") continue;\`;
        //         delete code[code.length - 1];
        //         window.alarm_polling = () => eval(code.join(""));
        //     });
        // `;
        //
        // const script = document.createElement("script");
        // script.textContent = code;
        // document.head.appendChild(script);
        // script.remove();
    },
    revoke () {
        // TODO: 리보크 기능 추가
    }
} as RefresherModule;