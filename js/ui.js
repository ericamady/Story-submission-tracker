
document.addEventListener("DOMContentLoaded", () => {

    console.log("FieldSync: Updated ui.js loaded");

    // Initialize mobile navigation
    const mobileMenu = document.querySelector("#mobile-menu");

    if (mobileMenu && typeof M !== "undefined") {
        M.Sidenav.init(mobileMenu, {
            edge: "right"
        });
    }

    // Initialize available side navigation forms
    const sidenavSelectors = [
        "#market-form",
        "#story-form",
        "#tracker-form"
    ];

    sidenavSelectors.forEach(selector => {

        const element = document.querySelector(selector);

        if (element && typeof M !== "undefined") {
            M.Sidenav.init(element, {
                edge: "left"
            });
        }

    });

    // Initialize select fields once
    if (typeof M !== "undefined") {

        const selectFields = document.querySelectorAll("select");

        if (selectFields.length > 0) {
            M.FormSelect.init(selectFields);
        }

    }

});
