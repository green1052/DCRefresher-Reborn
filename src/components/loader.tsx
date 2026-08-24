import "./loader.scss";

export default function Loader() {
    return (
        <div className="refresher-loader spinner">
            {Array.from({length: 12}, (_, i) => (
                <div
                    className="spinner-blade"
                    key={i}
                />
            ))}
        </div>
    );
}
