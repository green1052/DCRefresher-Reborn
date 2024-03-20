import * as Toast from "../components/toast";
import $ from "cash-dom";
import ky from "ky";
import { blobToWebP } from "webp-converter-browser";

export default {
  name: "글쓰기",
  description: "글쓰기 페이지를 변경합니다.",
  url: /\/board\/write/,
  status: {},
  memory: {
    canvas: "",
    submitButton: "",
  },
  enable: false,
  default_enable: false,
  settings: {
    imageUpload: {
      name: "이미지 업로드",
      desc: "붙여넣기로 이미지를 업로드할 수 있습니다.",
      type: "check",
      default: false,
    },
    bypassTitleLimit: {
      name: "제목 글자수 제한 우회",
      desc: "제목 글자수 제한을 우회합니다.",
      type: "check",
      default: false,
    },
    selfImage: {
      name: "자짤 기능 활성화",
      desc: "자짤 기능을 활성화합니다. (URL)",
      type: "text",
      default: "",
    },
    header: {
      name: "머리말",
      desc: "머리말을 설정합니다. (HTML)",
      type: "text",
      default: "",
    },
    footer: {
      name: "꼬리말",
      desc: "꼬리말을 설정합니다. (HTML)",
      type: "text",
      default: "",
    },
    convertWebp: {
      name: "WebP 변환",
      desc: "이미지 업로드 기능으로 업로드시 이미지를 WebP로 변환합니다.",
      type: "check",
      default: false,
    },
    convertWebpQuality: {
      name: "WebP 변환 품질",
      desc: "WebP 변환 품질을 설정합니다.",
      type: "range",
      default: 80,
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
    },
  },
  require: ["filter"],
  func(filter) {
    this.memory.submitButton = filter.add<HTMLButtonElement>(
      "button.write",
      (element) => {
        $(element).on("click", () => {
          const header = this.status.header;
          const footer = this.status.footer;
          const selfImage = this.status.selfImage;

          if (selfImage) {
            const selfImageUrl = selfImage;
            const $contentContainer = $("#tx_canvas_wysiwyg")
              .contents()
              .find("body");
            $contentContainer.prepend(
              `<p style="text-align: left"><img style="clear: none; float: none" src=${selfImageUrl} class=txc-image></p>`,
            );
          }

          if (header) {
            $("#tx_canvas_wysiwyg")
              .contents()
              .find("body")
              .prepend(`${header}`);
          }

          if (footer) {
            $("#tx_canvas_wysiwyg").contents().find("body").append(`${footer}`);
          }

          if (this.status.bypassTitleLimit) {
            const $titleElement = $("input#subject");
            const title = $titleElement.val() as string;

            if (title.length === 1) $titleElement.val(`${title}\u200B`);
          }
        });

        filter.remove(this.memory.submitButton);
      },
    );

    this.memory.canvas = filter.add<HTMLIFrameElement>(
      "#tx_canvas_wysiwyg",
      (element) => {
        const win = element.contentWindow!;

        win.addEventListener("DOMContentLoaded", () => {
          setTimeout(() => {
            const $dom = $(element.contentDocument);
            const $contentContainer = $dom.find("body");

            if (this.status.imageUpload) {
              $contentContainer.on("paste", async (ev) => {
                const data = (ev as ClipboardEvent).clipboardData;

                if (!data || !data.files.length) return;

                ev.stopPropagation();
                ev.preventDefault();

                Toast.show("이미지 업로드 중...", false, 1000);

                const r_key = $("#r_key").val() as string;
                const gall_id = $("#id").val() as string;
                const gall_no = $("#gallery_no").val() as string;
                const _GALLTYPE_ = $("#_GALLTYPE_").val() as string;
                const post_no = $("#no").val() as string;

                const form = new FormData();
                form.append("r_key", r_key);
                form.append("gall_id", gall_id);
                form.append("gall_no", gall_no);
                form.append("post_no", post_no);
                form.append("upload_ing", "N");
                form.append("_GALLTYPE_", _GALLTYPE_);

                const images = [];

                for (const file of data.files) {
                  if (!file.type.startsWith("image/")) continue;

                  const image = this.status.convertWebp
                    ? await blobToWebP(file, {
                        quality: this.status.convertWebpQuality,
                      })
                    : file;

                  form.set(
                    "files",
                    new File(
                      [image],
                      `${new Date().getTime()}-${file.name.split(".")[0]}`,
                      {
                        type: image.type,
                      },
                    ),
                  );

                  try {
                    const response = await ky
                      .post(
                        `https://upimg.dcinside.com/upimg_file.php?id=${gall_id}&r_key=${r_key}`,
                        { body: form },
                      )
                      .json<any>()
                      .then((parsed) => parsed.files[0]);

                    images.push(response);
                  } catch (e) {
                    Toast.show(String(e), true, 1000);
                  }
                }

                for (const image of images) {
                  $contentContainer.append(
                    `<p style="text-align: left"><img style="clear: none; float: none" id="tx_entry_${
                      Math.floor(Math.random() * 90000) + 10000
                    }_" src=${
                      image.web__url ?? image.url
                    } class=txc-image></p>`,
                  );
                }

                Toast.show("이미지 업로드 완료", false, 1000);
              });
            }
          }, 500);
        });

        filter.remove(this.memory.canvas);
      },
    );
  },
  revoke(filter) {
    filter.remove(this.memory.submitButton);
    filter.remove(this.memory.canvas);
  },
} as RefresherModule<{
  memory: {
    submitButton: string;
    canvas: string;
  };
  settings: {
    imageUpload: RefresherCheckSettings;
    bypassTitleLimit: RefresherCheckSettings;
    selfImage: RefresherTextSettings;
    header: RefresherTextSettings;
    footer: RefresherTextSettings;
    convertWebp: RefresherCheckSettings;
    convertWebpQuality: RefresherRangeSettings;
  };
  require: ["filter"];
}>;
