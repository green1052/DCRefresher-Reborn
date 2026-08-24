import Checkbox from "./checkbox";
import {useAppContext} from "../context";

import "./module.scss";

interface Props {
    name: string;
    desc: string;
    enabled: boolean;
}

export default function ModuleCard({name, desc, enabled}: Props) {
    const {settings} = useAppContext();

    const handleToggle = async (value: boolean) => {
        try {
            await settings.updateModuleStatus(name, value);
        } catch (error) {
            console.error("Failed to update module status:", error);
        }
    };

    return (
        <div className="refresher-module">
            <div className="left">
                <p className="title">
                    {name}
                </p>
                <p className="desc">
                    {desc}
                </p>
            </div>
            <div className="right">
                <Checkbox
                    onChange={(value) => void handleToggle(value)}
                    value={enabled}
                />
            </div>
        </div>
    );
}
