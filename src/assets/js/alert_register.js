(() => {
    window._alert = window.alert;
    window.alert = message => window.postMessage({type: "ALERT", text: message}, "*");
})();