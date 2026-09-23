import {X} from "lucide-react";

interface Props {
    text?: string;
    image?: string;
    gallery?: string;
    extra?: string;
    remove?: () => void;
    textclick?: () => void;
}

export default function Bubble({text = "", image, gallery, extra, remove, textclick}: Props) {
    const displayText = text + (extra ? ` (${extra})` : "");

    return (
        <span className="badge">
            <span
                onClick={textclick}
                style={{cursor: textclick ? "pointer" : undefined}}
            >
                {image && (
                    <img
                        loading="lazy"
                        src={image}
                        style={{height: 20, marginRight: 4, verticalAlign: "middle"}}
                    />
                )}
                {displayText}
                {gallery && ` (${gallery})`}
            </span>
            {remove && (
                <button className="badge-x" onClick={remove}>
                    <X size={12}/>
                </button>
            )}
        </span>
    );
}
