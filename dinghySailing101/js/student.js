//====================================================
// student.js
// Version 1
//====================================================

const studentName =
    document.getElementById("studentName");

const continueButton =
    document.getElementById("continueButton");

//----------------------------------------------------
// Enable / Disable Continue Button
//----------------------------------------------------

studentName.addEventListener("input", () => {

    continueButton.disabled =
        studentName.value.trim() === "";

});

//----------------------------------------------------
// Continue
//----------------------------------------------------

continueButton.addEventListener("click", () => {

    sessionStorage.setItem(
        "studentName",
        studentName.value.trim()
    );

    window.location.href =
        "certificate.html";

});