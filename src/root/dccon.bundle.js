import browser from "webextension-polyfill";

async function selectDCON(e) {
    let targetId = e.currentTarget.id;

    (browser.storage.sync || browser.storage.local).get("refresher.blockQueue").then(value => {
        let obj = {};

        obj["refresher.blockQueue"] = value["refresher.blockQueue"] || [];
        obj["refresher.blockQueue"].push(targetId);
        (browser.storage.sync || browser.storage.local).set(obj);

        browser.tabs.query({active: true, currentWindow: false}).then((tabs) => {
            browser.tabs.reload(tabs[0].id);
            window.close();
        });
    });
}

function dcconDetail(e) {
    fetch(`https://dccon.dcinside.com/index/package_detail`, {
        method: "POST",
        dataType: "json",
        headers: {
            Accept: "*/*",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        cache: "no-store",
        referrer: `https://dccon.dcinside.com/hot/1/title/${
            document.getElementById("title").value
        }`,
        body: `package_idx=${e.currentTarget.id.toString()}&code=`
    })
        .then(res => res.json())
        .then(res => {
            document.getElementById("main").innerHTML = `
            <h1>${res.info.title}</h1>
            <p>${res.info.description}</p>
        `;
            res.detail.forEach(el => {
                let newElement = document.createElement("img");
                newElement.src = "https://dcimg5.dcinside.com/dccon.php?no=" + el.path;
                newElement.alt = el.title;
                newElement.className = "dccon";
                newElement.addEventListener("click", selectDCON);

                newElement.id = `${el.package_idx}||${el.idx}||${el.path}`;
                document.getElementById("main").appendChild(newElement);
            });

            let margin = document.createElement("div");
            margin.style.clear = "left";
            document.getElementById("main").appendChild(margin);
            document.documentElement.scroll(0, 0);
        });
}

function search() {
    fetch(
        document.getElementById("title").value
            ? `https://dccon.dcinside.com/hot/1/title/${
                document.getElementById("title").value
            }`
            : "https://dccon.dcinside.com/"
    )
        .then(res => res.text())
        .then(res => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(res, "text/html");
            document.getElementById("main").innerHTML = "";
            let elS = doc.querySelector(
                ".dccon_listbox:not(.dccon_js) .dccon_shop_list"
            );

            elS.querySelectorAll("li").forEach(el => {
                let thumbnail = el.querySelector("img").src;
                let name = el.querySelector(".dcon_name").innerText;
                let by = el.querySelector(".dcon_seller").innerText;
                let id = el.querySelector("a").href.split("#")[1];
                let newElement = document.createElement("div");
                newElement.id = id;
                newElement.className = "menu";
                newElement.addEventListener("click", dcconDetail);
                newElement.innerHTML = `
                <img src="${thumbnail}">
                <div>
                    <h2>${name}</h2>
                    <h4>${by}</h4>
                </div>`;
                document.getElementById("main").appendChild(newElement);
            });
            let margin = document.createElement("div");
            margin.style.clear = "left";
            document.getElementById("main").appendChild(margin);
            document.documentElement.scroll(0, 0);
        });
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("search").addEventListener("click", search);
    document.getElementById("title").addEventListener("change", search);
    search();
});
