const params = new URLSearchParams(window.location.search);
const studentEmail = params.get("studentEmail");
const startButton = document.getElementById("startButton");

if (studentEmail && studentEmail !== "0") {
    if (startButton) {
        startButton.classList.remove("d-none");
    }
}