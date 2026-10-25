import {type CSSProperties, useEffect, useState} from "react";

import {useOptionsStore} from "./optionsStore";

// 디시콘 패키지 번호(16진수). 앞자리가 같은 것끼리 공통 접두사를 묶어 적는다.
const PACKS: [prefix: string, suffixes: string[]][] = [
    ["62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b658e82d75149b1fff213d9f5e9269dc69450e4fdf304f7766443dee800244029618a166bde80cfee0804e5dad9b407b71a884471", [
        "bbaff5e01",
        "98027b895",
        "c85e03653",
        "d02807a44",
        "ba5b6500ea6",
        "bacb6500ea6",
        "8ef501bfa8e",
        "8ec501bfa8e",
        "8eb501bfa8e",
        "99f6eb69a62"
    ]],
    ["62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b65def246efb6df28dd4e36f7d0634ac3154e62f4066c2dea4045f6771305fc74a36a81adef267575d7aa72f84fb4926ed514e9", [
        "9ec7a5278",
        "bec5fdc0e",
        "cec246cc2",
        "9f27cfe8e00",
        "9f6949c9363",
        "af28f38bc01",
        "af3939177e9",
        "cfad0b22815",
        "ef74eac54cd",
        "ff659189a88"
    ]],
    ["62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b658e92477cc3eb010ffe6d1c0915162fba91358516fd9ce632ada652116b3c7f8672797af06716670132248c94a98675cb3a825d36bd", [
        "d6f46d9c2",
        "e6f46d9c2",
        "f6f51dec3",
        "86f51dec3",
        "96f51dec3",
        "a6f46d9c2",
        "b6f51dec3",
        "46f51dec3",
        "56f46d9c2",
        "d710fc0ca11"
    ]]
];
const DCCONS: string[] = PACKS.flatMap(([prefix, suffixes]) => suffixes.map((suffix) => prefix + suffix));

const COUNT = 60;
// 아래 두 값의 단위는 초.
const MAX_DELAY = 1.5;
const DURATION = 2.4;

/** 로고 연타 이스터에그. */
export const DcconRain = () => {
    // 종료는 타이머로 한다. 마지막 이미지의 animationend에 걸면 그 이미지가 로드 실패로 지워졌을 때 끝나지 않는다.
    useEffect(() => {
        const timer = setTimeout(() => useOptionsStore.getState().endRain(), (MAX_DELAY + DURATION) * 1000);
        return () => clearTimeout(timer);
    }, []);
    // 위치·크기·지연·회전은 처음 한 번만 정한다. 렌더마다 정하면 부모(App)가 다시 그릴 때 떨어지던 이미지가 튄다.
    const [drops] = useState(() =>
        Array.from({length: COUNT}, (): { style: CSSProperties; spin: string } => ({
            style: {
                left: `${Math.random() * 95}%`,
                width: `${60 + Math.random() * 50}px`,
                animationDelay: `${Math.random() * MAX_DELAY}s`,
                animationDuration: `${DURATION}s`
            },
            spin: `${(Math.random() - 0.5) * 720}deg`
        }))
    );

    return (
        <div className="pointer-events-none fixed inset-0 z-100 overflow-hidden">
            {drops.map(({style, spin}, index) => (
                <img
                    key={index}
                    src={`https://image.dcinside.com/dccon.php?no=${DCCONS[index % DCCONS.length]}`}
                    alt=""
                    className="absolute top-0 animate-dccon-fall rounded-lg"
                    onError={(ev) => ev.currentTarget.remove()}
                    style={style}
                    // 회전각은 keyframes(tailwind.css의 dccon-fall)가 읽는 CSS 변수라 style 객체가 아니라 setProperty로 넣는다.
                    ref={(element) => element?.style.setProperty("--spin", spin)}
                />
            ))}
        </div>
    );
};
