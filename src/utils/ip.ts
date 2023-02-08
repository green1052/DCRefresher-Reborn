import * as storage from "./storage";
import * as mmdb from "mmdb-lib";
import { AsnResponse, CountryResponse } from "mmdb-lib";
import { Buffer } from "buffer";

let asnReader: mmdb.Reader<AsnResponse>;
let countryReader: mmdb.Reader<CountryResponse>;

storage.get<string>("refresher.asn").then((data) => {
    asnReader = new mmdb.Reader<AsnResponse>(Buffer.from(data, "base64"));
});

storage.get<string>("refresher.country").then((data) => {
    countryReader = new mmdb.Reader<CountryResponse>(
        Buffer.from(data, "base64")
    );
});

const CUSTOM_NAME: Record<string, string> = {
    // 잘못된 정보 수정 시작
    "ELIMNET, INC.": "LG유플러스",
    "Hyundai Marin Fire Insurance": "KT",
    // 잘못된 정보 수정 끝

    "LG DACOM Corporation": "LG데이콤",
    "JoongAng Ilbo": "중앙일보",
    "Shinyoung Securities CO ., LTD.": "신영증권",
    KOSCOM: "코스콤",
    "POSCO ICT": "포스코ICT",
    "HL Holdings Corporation": "HL홀딩스",
    "pundang jesaeng general hospital": "분당제생병원",
    NHN: "NHN",
    "SK Securities Limited": "SK증권",
    "HANWHA Corp. Information Service div.":
        "HANWHA Corp. Information Service div.",
    "National Agricultural Cooperative federation": "농협",
    Tosspayments: "토스",
    "SEOCHO CABLE SYSTEMS CO., LTD.": "서초케이블",
    "HYUNDAI COMMUNICATIONS NETWORK": "HCN",
    "PUSAN CABLE TV SYSTEM CO., LTD.": "HCN 부산",
    "HCN Dongjak": "HCN 동작",
    "HCN CHUNGBUK CABLE TV SYSTEMS": "HCN 충북",
    "SK Broadband Co Ltd": "SKB",
    "KOOKMIN BANK": "국민은행",
    "THE CATHOLIC UNIVERSITY OF KOREA SONGSIM": "가톨릭대학교 성신교정",
    BROADBANDIDC: "브로드밴드 IDC",
    tsis: "티시스",
    DOUZONEBIZON: "더존비즈온",
    "Seoul Metropolitan Government": "서울특별시청",
    "KOREA UNIVERSITY OF MEDIA ARTS": "한국영상대학교",
    GSNeotek: "GS네오텍",
    kbcard: "KB국민카드",
    "Daewoo Securities Co., Ltd.": "대우증권",
    "Korea Telecom": "KT",
    "Seoul Metro": "서울교통공사",
    "Seoul Metropolitan Office Of Education": "서울시교육청",
    "HANVIT BANK": "한빛은행",
    "Seoul Guarantee Insurance Company": "SGI서울보증",
    "LG Home shopping Inc.": "LG Home shopping Inc.",
    "asan medical center": "서울아산병원",
    "HANASK card": "하나SK카드",
    "Seoul Metropolitan Government Computer Center":
        "Seoul Metropolitan Government Computer Center",
    "Paju office of Education Gyeonggi Province": "경기도파주교육지원청",
    "Goyang Office of Education": "Goyang Office of Education",
    "Hanwha Investment Securities Co., Ltd.": "한화투자증권",
    "Hana Bank Co.": "하나은행",
    "KYONGGI YANGPYEONG OFFICE OF EDUCATION": "경기도양평교육지원청",
    "Gyeonggido Seongnam Office of Education": "경기도성남교육지원청",
    "Hankyong National Univercity": "한경대학교",
    HancomWITH: "한컴위드",
    "SHINHAN DS": "신한DS",
    "Gyeonggi Provincial Suwon Office of Education": "경기도수원교육지원청",
    "Gyeonggi-do Pyongtaek Office Education": "경기도평택교육지원청",
    "Yongin office of education": "경기도용인교육지원청",
    "Gyeonggi Provincial Anseong Office of Education": "경기도안성교육지원청",
    "Gyeonggi-do Yeoju Office of Education": "경기도여주교육지원청",
    KBCAPITAL: "KB캐피탈",
    "Guri Namyangju Office Of Education": "경기도구리남양주교육지원청",
    // 부정확
    "GYEONGGI PROVINCIAL ANYANG OFFICE OF EDUCATION":
        "경기도안양과천교육지원청",
    "GunpoUiwang Office of Education": "경기도군포의왕교육지원청",
    "Mokwon University": "목원대학교",
    "Chungwoon University": "충원대학교",
    "Branksome Hall Asia": "브랭섬홀 아시아",
    "Korea Housing Urban Guarantee Corporation": "주택도시보증공사",
    "YKK KOREA CO., LTD.": "YKK코리아",
    "FAMOUS WORKER": "FAMOUS WORKER",
    kakaogames: "카카오게임즈",
    "IP-Converge Data Center, Inc.": "IP-Converge Data Center, Inc.",
    "NAVER Cloud Corp.": "네이버클라우드",
    "Korea Investment Trust Management Securities Co.,LTD": "한국투자",
    "National Health Insurance Service": "국민건강보험공단",
    "Akamai International B.V.": "Akamai",
    "SK Telecom": "SKT",
    "LG POWERCOMM": "LG파워콤",
    "LG HelloVision Corp.": "LG헬로비전",
    "youngsan university": "영산대학교",
    LGTELECOM: "LG유플러스",
    // pubnetplus.uplus.co.kr
    "DACOM-PUBNETPLUS": "LG데이콤",
    "Seoul National University": "서울대학교",
    DLIVE: "딜라이브",
    "KCTV JEJU BROADCASTING": "KCTV제주방송",
    CLOUDFLARENET: "클라우드플레어"
};

const IP_DETAIL_INFO: Record<string, string> = {
    // SKT START
    203.226: "4G",
    211.234: "3G",
    "27.160": "4G",
    27.161: "4G",
    27.162: "4G",
    27.163: "4G",
    27.164: "4G",
    27.165: "4G",
    27.166: "4G",
    27.167: "4G",
    27.168: "4G",
    27.169: "4G",
    "27.170": "4G",
    27.171: "4G",
    27.172: "4G",
    27.173: "4G",
    27.174: "4G",
    27.175: "4G",
    27.176: "4G",
    27.177: "4G",
    27.178: "4G",
    27.179: "4G",
    "27.180": "4G",
    27.181: "4G",
    27.182: "4G",
    27.183: "4G",
    223.32: "4G, 5G",
    223.33: "4G, 5G",
    223.34: "4G, 5G",
    223.35: "4G, 5G",
    223.36: "4G, 5G",
    223.37: "4G, 5G",
    223.38: "4G, 5G",
    223.39: "4G, 5G",
    "223.40": "4G, 5G",
    223.41: "4G, 5G",
    223.42: "4G, 5G",
    223.43: "4G, 5G",
    223.44: "4G, 5G",
    223.45: "4G, 5G",
    223.46: "4G, 5G",
    223.47: "4G, 5G",
    223.48: "4G, 5G",
    223.49: "4G, 5G",
    "223.50": "4G, 5G",
    223.51: "4G, 5G",
    223.52: "4G, 5G",
    223.53: "4G, 5G",
    223.54: "4G, 5G",
    223.55: "4G, 5G",
    223.56: "4G, 5G",
    223.57: "4G, 5G",
    223.58: "4G, 5G",
    223.59: "4G, 5G",
    "223.60": "4G, 5G",
    223.61: "4G, 5G",
    223.62: "4G, 5G",
    223.63: "4G, 5G",
    // SKT END

    // KT START
    39.7: "4G",
    "110.70": "4G",
    175.223: "4G",
    221.246: "4G",
    118.235: "4G",
    211.223: "4G",
    // KT END

    // LG START
    106.102: "4G",
    117.111: "4G",
    211.36: "4G",
    106.101: "5G"
    // LG END
};

const displayNames = new Intl.DisplayNames(["ko"], { type: "region" });

export const ISPData = (ip: string): ISPInfo => {
    const fullIp = `${ip}.0.0`;

    const asn = asnReader.get(fullIp)?.autonomous_system_organization;
    const country = countryReader.get(fullIp)?.country?.iso_code;

    let color: string;
    switch (country) {
        case "US":
        case "JP":
        case "CN":
        case "RU":
        case "TW":
        case "UK":
            color = "#f08080";
            break;
        case "KR":
            color = "#6495ed";
            break;
        default:
            color = "#8fbc8f";
            break;
    }

    return {
        name: asn === undefined ? asn : CUSTOM_NAME[asn],
        country,
        color,
        detail: IP_DETAIL_INFO[ip]
    };
};

export const format = (data: ISPInfo): string => {
    const { name, country, detail } = data;

    if (!name || !country) return "";

    return `${country !== "KR" ? `${displayNames.of(country)} ` : ""}${
        detail ? `${detail} ` : ""
    }${name}`;
};
