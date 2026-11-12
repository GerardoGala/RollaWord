//====================================================
// certificate.js
//====================================================

const studentName =
    sessionStorage.getItem("studentName") ??
    "Gerardo Gala";

document.getElementById("studentName").textContent =
    studentName;


//----------------------------------------------------
// Certificate Date
//----------------------------------------------------

const today =
    new Date();

const options = {

    year: "numeric",

    month: "long",

    day: "numeric"

};

document.getElementById("certificateDate").textContent =
    today.toLocaleDateString(
        "en-US",
        options
    );

