//====================================================
// navigation.js
//====================================================

function initializeNavigation() {

    const previousButton = document.getElementById("previousButton");
    const nextButton = document.getElementById("nextButton");

    if (!previousButton || !nextButton) return;

    const currentPage = location.pathname.split("/").pop() || "index.html";

    // First lesson
    if (currentPage === "module01.html") {

        previousButton.href = "index.html";
        nextButton.href = "module02.html";
        return;
    }

    // exam
    if (currentPage === "exam.html") {

        previousButton.href = "module10.html";
        nextButton.href = "index.html";
        nextButton.textContent = "Course Home";
        return;
    }

    // Module pages
    const match = currentPage.match(/^module(\d{2})\.html$/);

    if (!match) return;

    const moduleNumber = Number(match[1]);

    previousButton.href =
        `module${String(moduleNumber - 1).padStart(2, "0")}.html`;

    nextButton.href =
        moduleNumber === 10
            ? "exam.html"
            : `module${String(moduleNumber + 1).padStart(2, "0")}.html`;
}

// Run after includes are inserted
document.addEventListener("includesLoaded", initializeNavigation);

// Also run normally in case there are no includes
document.addEventListener("DOMContentLoaded", initializeNavigation);