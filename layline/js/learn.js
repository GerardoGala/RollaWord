// This file runs automatically when the page finishes loading
window.addEventListener('load', function() {
    
    // Select the interactive UI buttons from learn.html
    const startButton = document.getElementById('startButton');
    const backButton = document.getElementById('backButton');
    
    // Create our tracking timer loop variable
    let trackingTimer = null;

    // COPIED FROM PRACTICE: Sequential Performance Monitoring Pass
    function monitorSailingProgress() {
        const data = window.globalSimulationData;

        // 1. Structural Check: Wait until the simulation engine fills in the required data fields
        if (!data || !data.ILCA) {
            return; 
        }

        // 2. Extract distance matching your exact practice debugging key
        const dtl = data.distanceToLayline;

        // Safety check: wait until the engine registers a valid starting distance calculation
        if (dtl === undefined || dtl === null) {
            return;
        }

        // 3. AUTOMATED CROSSING TRIGGER: Instead of waiting for a "Tack" button,
        // we trigger the logic the exact millisecond the distance shrinks down to 0 or less.
        if (dtl <= 5) {
            
            // Turn off this tracker loop instantly so it stops ticking
            clearInterval(trackingTimer);

            // Freeze the app.js simulation physics framework loop immediately
            if (typeof window.stopSimulation === 'function') {
                window.stopSimulation();
            }

            // --- COPIED FROM PRACTICE: SPA Injector Layout Engine ---
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
            
            // Injects the clean, regular uniform layout theme matching practice course styling
            feedbackDiv.innerHTML = `
                <div class="alert alert-info p-4 rounded text-center" style="font-family: sans-serif; border-top: 5px solid #0d6efd; background-color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                    <div class="mb-2 fw-bold text-uppercase fs-6" style="color: #0d6efd; letter-spacing: 1px;">LEARN</div>
                    <h3 class="fw-bold mt-1 text-primary">Layline Crossed! 🎉</h3>
                    <p class="mb-3 fs-6 text-muted">The sailboat has just crossed the layline track corridor. In a real scenario, this is the exact moment a sailor must execute a tack to reach the windward mark cleanly without traveling extra distance.</p>
                    <hr>
                    <div class="d-flex gap-2 justify-content-center mt-3">
                        <a href="practice.html" class="btn btn-primary btn-sm px-4 fw-bold">Go to Practice Mode</a>
                        <a href="index.html" class="btn btn-outline-secondary btn-sm px-4">Main Menu</a>
                    </div>
                </div>
            `;
        }
    }

    // Bind initialization hooks directly to the Start Button click event handler
    if (startButton) {
        startButton.addEventListener('click', function() {
            
            // Launch your core app simulation physics engine loop
            if (typeof window.launchSimulation === 'function') {
                window.launchSimulation();
            }

            // Toggle page buttons to standard navigation modes
            startButton.classList.add('d-none');
            if (backButton) {
                backButton.classList.remove('d-none');
            }

            // Run the high-frequency evaluation checks every 50ms matching your runtime speed
            trackingTimer = setInterval(monitorSailingProgress, 50);
        });
    }
});
