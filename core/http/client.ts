import ky, {type KyInstance} from "ky";

export const http: KyInstance = ky.create({timeout: 15_000});

export const ajax: KyInstance = http.extend({headers: {"X-Requested-With": "XMLHttpRequest"}});
