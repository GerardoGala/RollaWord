//====================================================
// include.js
// Generic HTML include loader
//====================================================

document.addEventListener("DOMContentLoaded", async () => {

    const elements = document.querySelectorAll("[data-include]");

    for (const element of elements) {

        const file = element.dataset.include;

        try {

            const response = await fetch(file);

            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            element.innerHTML = await response.text();

        }

        catch (error) {

            console.error(`Unable to load ${file}`, error);

            element.innerHTML =
                `<div class="alert alert-danger">
                    Unable to load ${file}
                 </div>`;

        }

    }

    // Tell the rest of the site that all includes are ready.
    document.dispatchEvent(new Event("includesLoaded"));

});