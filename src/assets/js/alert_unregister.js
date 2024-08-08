(() => {
    window.alert = window._alert;
    delete window._alert;
})();
