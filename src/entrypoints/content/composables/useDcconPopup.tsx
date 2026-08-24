import {createRoot, type Root} from "react-dom/client";

import DcconPopup from "@/components/dccon";

let mounted: { root: Root; element: HTMLDivElement } | null = null;

export const closeDcconPopup = (): void => {
    if (!mounted) return;

    mounted.root.unmount();
    mounted.element.remove();
    mounted = null;
};

export const renderDcconPopup = (
    onClickDccon: (dccons: DcinsideDccon[], bigDccon: boolean) => void
): boolean => {
    if (mounted) return false;

    const element = document.createElement("div");
    document.body.appendChild(element);

    const root = createRoot(element);
    root.render(
        <DcconPopup
            onClickDccon={(dccons, bigDccon) => {
                onClickDccon(dccons, bigDccon);
                closeDcconPopup();
            }}
            onCloseDccon={closeDcconPopup}
        />
    );

    mounted = {root, element};

    return true;
};
