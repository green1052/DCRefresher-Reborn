export default (...inputs: any[]): void => {
    console.log(
        `🔧 %c${new Date().toLocaleTimeString("en-US")} %c:`,
        "color: #888;",
        "color: unset;",
        ...inputs
    );
};