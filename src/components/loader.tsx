import {Spinner} from "@radix-ui/themes";

export default function Loader() {
    return (
        <div
            className="refresher-loader"
            style={{margin: "auto", position: "relative"}}
        >
            <Spinner size="3"/>
        </div>
    );
}
