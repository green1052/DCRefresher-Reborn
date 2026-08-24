import {X} from "lucide-react";

import "./bubble.scss";

interface Props {
    text?: string;
    image?: string;
    isRegex?: boolean;
    gallery?: string;
    extra?: string;
    remove?: () => void;
    textclick?: () => void;
}

export default function Bubble({text = "", image, gallery, extra, remove, textclick}: Props) {
    const displayText = text + (extra ? ` (${extra})` : "");

    return (
        <div className="refresher-bubble">
            <span
                className={image ? "text image" : "text"}
                onClick={() => textclick?.()}
            >
                {image && (
                    <img
                        loading="lazy"
                        src={image}
                    />
                )}

                {displayText}
                {gallery && (
                    <span className="gallery">
                        ({gallery})
                    </span>
                )}
            </span>
            {remove && (
                <span
                    className="remove"
                    onClick={() => remove()}
                    onKeyDown={(ev) => {
                        if (ev.key === "Enter") remove();
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <X size={14}/>
                </span>
            )}
        </div>
    );
}
