import type {CSSProperties} from "react";

// 패키지마다 코드 앞부분이 같아 [앞부분, 끝부분들]로 둔다
const PACKAGES: [prefix: string, suffixes: string[]][] = [
    [
        "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b658e82d75149b1fff213d9f5e9269dc69450e4fdf304f7766443dee800244029618a166bde80cfee0804e5dad9b407b71a88447",
        ["1bbaff5e01", "198027b895", "1c85e03653", "1d02807a44", "1ba5b6500ea6", "1bacb6500ea6", "18ef501bfa8e", "18ec501bfa8e", "18eb501bfa8e", "199f6eb69a62"]
    ],
    [
        "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b65def246efb6df28dd4e36f7d0634ac3154e62f4066c2dea4045f6771305fc74a36a81adef267575d7aa72f84fb4926ed514e9",
        ["9ec7a5278", "bec5fdc0e", "cec246cc2", "9f27cfe8e00", "9f6949c9363", "af28f38bc01", "af3939177e9", "cfad0b22815", "ef74eac54cd", "ff659189a88"]
    ],
    [
        "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b658e92477cc3eb010ffe6d1c0915162fba91358516fd9ce632ada652116b3c7f8672797af06716670132248c94a98675cb3a825d36bd",
        ["d6f46d9c2", "e6f46d9c2", "f6f51dec3", "86f51dec3", "96f51dec3", "a6f46d9c2", "b6f51dec3", "46f51dec3", "56f46d9c2", "d710fc0ca11"]
    ]
];

const DCCONS = PACKAGES.flatMap(([prefix, suffixes]) => suffixes.map((suffix) => prefix + suffix));

const COUNT = 30;

/** 로고 연타 이스터에그 — 디시콘 비. seed가 바뀔 때마다 새로 떨어진다 (애니메이션이 끝나면 부모가 치운다) */
export const DcconRain = ({seed, onEnd}: { seed: number; onEnd: () => void }) => (
    <div className="refresher-dccon-rain" key={seed}>
        {Array.from({length: COUNT}, (_, index) => (
            <img
                key={index}
                src={`https://image.dcinside.com/dccon.php?no=${DCCONS[index % DCCONS.length]}`}
                alt=""
                onError={(ev) => ev.currentTarget.remove()}
                onAnimationEnd={index === COUNT - 1 ? onEnd : undefined}
                style={{
                    left: `${Math.random() * 95}%`,
                    width: `${60 + Math.random() * 50}px`,
                    animationDelay: index === COUNT - 1 ? "1.6s" : `${Math.random() * 1.5}s`,
                    animationDuration: "2.4s",
                    "--spin": `${(Math.random() - 0.5) * 720}deg`
                } as CSSProperties}
            />
        ))}
    </div>
);
