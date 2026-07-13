export function getRelevantData(ev: MouseEvent): GalleryPreData {
    const element = (ev.target as HTMLElement).closest<HTMLElement>(".ub-content");

    let id = "";
    let notice = false;
    let recommend = false;
    let type = "";
    let title = "";
    let link = "";
    let gallery = "";

    const em = element?.querySelector<HTMLElement>(".icon_img");

    if (em) {
        const attr = em.getAttribute("class")!;
        type = attr.split(" ").at(-1) ?? "icon_txt";
        notice = attr.includes("icon_notice");
        recommend = attr.includes("icon_recomimg");
    }

    const linkElement = element?.querySelector<HTMLAnchorElement>("a:not(.reply_numbox)");

    if (linkElement) {
        title = (linkElement.textContent ?? "").trim();

        const url = new URL(linkElement.getAttribute("href") ?? "", location.href);
        id = url.searchParams.get("no") ?? "";
        link = url.href;
        gallery = url.searchParams.get("id") ?? "";
    }

    return {id, gallery, title, link, notice, recommend, type};
}