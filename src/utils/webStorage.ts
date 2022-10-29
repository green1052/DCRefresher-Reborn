/**
 * dcinside.com set cookie function
 */

export function setCookieTmp (
    e: string,
    t: string,
    o: number,
    i: string
): void {
    const n = new Date();
    n.setTime(n.getTime() + 36e5 * o),
    (document.cookie =
      e +
      "=" +
      escape(t) +
      "; path=/; domain=" +
      i +
      "; expires=" +
      n.toUTCString() +
      ";");
}

/**
 * dcinside.com get cookie
 */
export function get_cookie (e: string): string {
    for (
        let t = e + "=", o = document.cookie.split(";"), i = 0;
        i < o.length;
        i++
    ) {
        let n;
        for (n = o[i]; n.charAt(0) == " "; ) n = n.substring(1);
        if (n.indexOf(t) == 0) return n.substring(t.length, n.length);
    }
    return "";
}