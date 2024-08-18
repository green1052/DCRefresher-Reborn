import React from "react";
import {Checkbox} from "./Checkbox";

export function Module({name, desc, requirement, enabled}: {
    name: string;
    desc: string;
    requirement: string[];
    enabled: boolean;
}) {
    const onChange = (module: string, key: string, value: unknown) => {

    };
    
    return (
        <div className="refresher-module">
            <div className="left">
                <p className="title">{name}</p>
                <p className="desc">{desc}</p>
                <p className="mute">
                    요구 유틸 : {requirement ? requirement.join(", ") : "없음"}
                </p>
            </div>

            <div className="right">
                <Checkbox onChange={onChange} module={name} id={name} checked={enabled} disabled={false}/>
            </div>
        </div>
    );
}