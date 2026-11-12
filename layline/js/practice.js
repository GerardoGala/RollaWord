// 3. SPA CALCULATIONS & INLINE FEEDBACK PANEL
function calculateSpaExamScore() {
  if (!window.globalSimulationData || !window.globalSimulationData.ILCA) {
    console.error("Simulation data object or ILCA object not found on window.");
    return;
  }

  const dtl = window.globalSimulationData.distanceToLayline || 0;
  const timing = window.globalSimulationData.tackTimingStatus;

  let titleText = "";
  let messageText = "";
  let alertClass = "";
  let buttonLayoutHtml = ""; 

  // 1. FIRST CHECK: Did the student pass within 20 meters?
  if (dtl < 20.0) {
    console.log("dtl", dtl);
    titleText = "Congratulations! 🎉";
    messageText = "Excellent sailing execution! You hit the upwind layline track corridor perfectly.";
    alertClass = "alert-success";
    buttonLayoutHtml = `
      <a href="challenge.html" class="btn btn-primary btn-sm px-4 fw-bold">Advance to Challenge</a>
      <a href="index.html" class="btn btn-outline-primary btn-sm px-4">Main Menu</a>
    `;
  } 
  // 2. SECOND CHECK: If distance is 20 meters or more, inspect custom tackTimingStatus strings
  else if (timing === "UNDERSTOOD") {
    titleText = "UNDERSTOOD";
    messageText = `You tacked too early! You understood the target mark layline by ${dtl.toFixed(1)} meters. Please try again.`;
    alertClass = "alert-danger";
    buttonLayoutHtml = `
      <button onclick="window.location.reload()" class="btn btn-primary btn-sm px-4">Try Again</button>
      <a href="index.html" class="btn btn-outline-primary btn-sm px-4">Main Menu</a>
    `;
  } 
  else {
    // timing === "OVERSTOOD"
    titleText = "OVERSTOOD";
    messageText = `You tacked too late! You overstood the layline by ${dtl.toFixed(1)} meters. Please try again.`;
    alertClass = "alert-danger";
    // 🎯 CORRECTED: Changed large green button layout to match the uniform regular blue theme layout
    buttonLayoutHtml = `
      <button onclick="window.location.reload()" class="btn btn-primary btn-sm px-4">Try Again</button>
      <a href="index.html" class="btn btn-outline-secondary btn-sm px-4">Main Menu</a>
    `;
  }

  // --- SPA Injector: Render or refresh the custom DIV panel directly onto the screen ---
  let feedbackDiv = document.getElementById("spaFeedbackPanel");
  if (!feedbackDiv) {
    feedbackDiv = document.createElement("div");
    feedbackDiv.id = "spaFeedbackPanel";
    const controlsParent = document.getElementById("divStart") || document.body;
    controlsParent.appendChild(feedbackDiv);
  }

  feedbackDiv.style.display = "block";
  feedbackDiv.style.marginTop = "15px";
  feedbackDiv.style.width = "100%";
  
  feedbackDiv.innerHTML = `
    <div class="alert ${alertClass} p-4 rounded text-center" style="font-family: sans-serif; border-top: 5px solid #0d6efd;">
      <div class="mb-2 fw-bold text-uppercase fs-6" style="color: #0d6efd; letter-spacing: 1px;">PRACTICE</div>
      <h3 class="fw-bold mt-1">${titleText}</h3>
      <p class="mb-3 fs-6">${messageText}</p>
      <hr>
      <div class="d-flex gap-2 justify-content-center mt-3">
        ${buttonLayoutHtml}
      </div>
    </div>
  `;
}
