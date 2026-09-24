export const getCookie = (name: string): string | undefined => {
    for (const part of document.cookie.split(/; */)) {
        if (part.startsWith(`${name}=`)) return decodeURIComponent(part.slice(name.length + 1));
    }

    return undefined;
};
