import React from "react";

export function Bubble(
    {
        text,
        image,
        isRegex,
        gallery,
        extra,
        onRemove,
        onTextClick
    }: {
        text?: string;
        image?: string;
        isRegex?: boolean;
        gallery?: boolean;
        extra?: string;
        onRemove?: () => void;
        onTextClick?: () => void;
    }
) {
    return (
        <div className="refresher-bubble">
            <span
                className={`text ${image ? "image" : ""}`}
                onClick={() => onTextClick?.()}
            >
                {image && <img src={image}/>}
                {text} {extra ? `(${extra})` : ""}
                {gallery && <span className="gallery">{gallery}</span>}
            </span>

            {onRemove && (
                <span className="remove" onClick={() => onRemove?.()}>
                     <svg
                         height="14"
                         viewBox="0 0 18 18"
                         width="14"
                         xmlns="http://www.w3.org/2000/svg">
                         <path
                             d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"/>
                     </svg>
                </span>
            )}
        </div>
    );
}