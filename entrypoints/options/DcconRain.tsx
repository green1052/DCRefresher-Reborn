import type {CSSProperties} from "react";

const DCCONS = [
    "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b650e82d6e478cd1751b32633eef4d995d39aa0f27cfcba591cc357aaad5dc2062bfe64dbc3d1689a49fb82146bb6f",
    "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b650e9206e29eda69dce472ed0d70ec5c4e54f74e9252e4c10ed33faa1621962eba036098775d6b94b59aab4ee6d0571cf",
    "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b650eb236e09f9e39a6af33568fa8d1fc15ecac54d437709447bb257d7b4a2c109e261f65bb10d6186b0f12b6c3f658f1045a188f641d0245f8a25",
    "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b651e2236ed20ae7af8b8d25c5f6de87f6afcbf4e53f59a3b5d349df984a87137872c8513c81f831da63e0f56c1bbba8",
    "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b651e32d6ed98e1f223cf60fee05a9e423fdded413fa0cc89adfabd0757cc958294a512c76198f3052edbb4abcd892",
    "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b658ea2175ebe3d7131ce4dfe30072c74957df9ca37329066a85d72cc182f62791c26f28ca47743ec33d274e2b",
    "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b658ea2d750694c7e1ad4589cb3d3845cdc20f1bbfcc4f368ee5bf2697f1170c0db35ecc2299b04c824c16c9e9c1bb5e6b",
    "62b5df2be09d3ca567b1c5bc12d46b394aa3b1058c6e4d0ca41648b658ea2d750694c7e1ad4589cb3d3845cdc20f1bbfcc4f368ee5bf2697f1170c0db35ecc2299b04c824c16c9ebc1bb5e6b"
];

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
