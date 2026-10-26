// =========================================================================
// ROLLAWORD - CONDITIONAL TOP 10 DAILY CHALLENGE LEADERBOARD (TIMELINE READY)
// =========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, limit, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Firebase configuration credentials
const firebaseConfig = {
    apiKey: "AIzaSyC_ayepAzJV_vfV5Qh8m52tGnn1Iw7CRnY",
    authDomain: "laser-sailing-simulator.firebaseapp.com",
    projectId: "laser-sailing-simulator",
    storageBucket: "laser-sailing-simulator.firebasestorage.app",
    messagingSenderId: "45397375888",
    appId: "1:145397375888:web:1ca8d7688170787624d115"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Core State Engine: Keeps track of the date currently active on the viewport timeline
let activeNavDate = new Date();

/**
 * Helper utility: Extracts normalized 8-digit keys and presentation strings from a Date instance
 * @param {Date} targetDate 
 */
function getFormattedDateMetadata(targetDate) {
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return {
        key: `${year}${month}${day}`,
        display: `${year}-${month}-${day}`
    };
}

/**
 * Anonymous player ID: a random value made once per browser and kept in localStorage.
 * It identifies "this browser" so the leaderboard can tell two players with the
 * same name apart, and mark your own row. It contains no personal information.
 * Returns null if the browser blocks storage (the score is then saved without an ID).
 */
function getPlayerId() {
    try {
        let id = localStorage.getItem("rollaword.playerId");
        if (!id) {
            id = (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
            localStorage.setItem("rollaword.playerId", id);
        }
        return id;
    } catch (e) {
        return null;
    }
}

/** Makes player-typed text safe to place inside HTML (a name must never run as code). */
function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
}

/** Short tag from an ID, shown only when two different players share a name. */
function shortTag(id) {
    return String(id).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(-4);
}

/**
 * 🚀 CHIEF EVALUATION PIPELINE
 * Evaluates if a score deserves entry, prompts only if it qualifies, then updates the UI.
 * @param {number|string} finalScore - The verified score integer from your game engine loop.
 */
async function processChallengeEndgame(finalScore) {
    console.log("finalScore at start of processChallengeEndgame():", finalScore);
    
    // 1. MODE GUARD: Drop out instantly if the user is playing in unranked Free Play mode
    if (!window.isDailyChallengeMode) {
        console.log("Free Play active. Skipping leaderboard processing.");
        return;
    }

    const numericScore = Number(finalScore) || 0;

    // 2. SCORE GUARD: Early exit rule. If the score is 0, ignore it completely and bypass lookup
    if (numericScore === 0) {
        console.log("Score is 0. Bypassing leaderboard qualification checks entirely.");
        return;
    }

    // Endgames always validate against true "Today"
    const todayMetadata = getFormattedDateMetadata(new Date());
    const container = document.getElementById("score-output-area");
    
    if (container) {
        container.innerHTML = "<div>Checking today's leaderboard standings...</div>";
    }

    try {
        const leaderboardRef = collection(db, "rollaword_leaderboard");
        const q = query(
            leaderboardRef, 
            where("date", "==", todayMetadata.key), 
            orderBy("score", "desc"), 
            limit(10)
        );
        
        const querySnapshot = await getDocs(q);
        
        let makesTop10 = false;
        const totalEntriesToday = querySnapshot.size;
        const docs = querySnapshot.docs;

        // 3. QUALIFICATION DETERMINATION FLOW
        if (totalEntriesToday < 10) {
            makesTop10 = true;
        } else if (docs.length > 0) {
            const tenthPlaceDoc = docs[docs.length - 1].data();
            const tenthPlaceScore = tenthPlaceDoc && tenthPlaceDoc.score ? Number(tenthPlaceDoc.score) : 0;

            if (numericScore >= tenthPlaceScore) {
                makesTop10 = true;
            }
        }

        // 4. CONDITIONAL POSTING PIPELINE
        if (makesTop10) {
            console.log("finalScore at prompt of Name for Leaderboard:", numericScore);
            const playerName = prompt(`Incredible! Your score of ${numericScore} qualifies for today's Top 10! Enter your name:`);
            
            if (playerName && playerName.trim() !== "") {
                const playerId = getPlayerId();
                await addDoc(collection(db, "rollaword_leaderboard"), {
                    name: playerName.trim(),
                    date: todayMetadata.key,
                    score: numericScore,
                    ...(playerId ? { playerId: playerId } : {})
                });
                
                console.log("✈️ Navigating to beautiful leaderboard template...");
                window.location.href = "leaderboard.html"; 
            } else {
                console.log("Rankings submission bypassed by player. A name is required.");
            }
        } else {
            console.log(`Good game! Score ${numericScore} did not clear today's cutoff threshold.`);
        }

    } catch (error) {
        console.error("Database endgame verification sequence error:", error);
        if (container) {
            container.innerHTML = "<div>Could not verify leaderboard position.</div>";
        }
    }
}

/**
 * 📅 FETCH & DISPLAY RANKINGS WORKFLOW (TIMELINE LINKED)
 */
async function renderLeaderboardView() {
    const dateData = getFormattedDateMetadata(activeNavDate);
    const todayData = getFormattedDateMetadata(new Date());
    
    const dateDisplay = document.getElementById("current-date-display");
    const wrapper = document.getElementById("leaderboard-table-wrapper");
    const prevBtn = document.getElementById("prev-date-btn");
    const nextBtn = document.getElementById("next-date-btn");
    
    if (dateDisplay) dateDisplay.textContent = dateData.display;
    
    // Safety guard fallback to fallback text container if table wrapper element doesn't exist
    const renderTarget = wrapper || document.getElementById("score-output-area");
    if (!renderTarget) return;

    // Fast Next Button locking guard check
    if (nextBtn) {
        nextBtn.disabled = (dateData.key === todayData.key);
    }

    try {
        const leaderboardRef = collection(db, "rollaword_leaderboard");
        const q = query(
            leaderboardRef, 
            where("date", "==", dateData.key), 
            orderBy("score", "desc"), 
            limit(10)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            renderTarget.innerHTML = `
                <div style="text-align: center; padding: calc(var(--baseline) * 10); color: var(--gray);">
                    No submissions recorded yet for this day.<br>Be the first to secure a spot! 🏆
                </div>`;
            
            if (prevBtn) prevBtn.disabled = true;
            return;
        }

        if (prevBtn) prevBtn.disabled = false;

        // Collect each entry; older entries have no playerId, so their document id stands in.
        const entries = querySnapshot.docs.map(d => {
            const e = d.data();
            return { name: String(e.name == null ? "" : e.name), score: e.score, id: e.playerId || ("doc-" + d.id) };
        });

        // A name needs a tag only when different players on this list share it.
        const idsByName = new Map();
        entries.forEach(e => {
            const key = e.name.trim().toLowerCase();
            if (!idsByName.has(key)) idsByName.set(key, new Set());
            idsByName.get(key).add(e.id);
        });

        const myId = getPlayerId();
        let tableHtml = `<div style="display: flex; flex-direction: column; width: 100%;">`;
        let rank = 1;

        entries.forEach((entry) => {
            const isMe = !!myId && entry.id === myId;
            const shared = idsByName.get(entry.name.trim().toLowerCase()).size > 1;
            const tag = shared
                ? ` <span style="opacity:.6;font-size:.8em;">&middot;${escapeHtml(shortTag(entry.id))}</span>`
                : "";
            const you = isMe ? ` <span style="font-weight:700;">(you)</span>` : "";
            tableHtml += `
                <div class="leaderboard-row"${isMe ? ' style="background:#eef5fb;font-weight:700;"' : ""}>
                    <span class="rank-badge">#${rank}</span>
                    <span class="player-name">${escapeHtml(entry.name)}${tag}${you}</span>
                    <span class="player-score">${escapeHtml(entry.score)} pts</span>
                </div>
            `;
            rank++;
        });

        tableHtml += `</div>`;
        renderTarget.innerHTML = tableHtml;

    } catch (error) {
        console.error("Error reading leaderboard:", error);
        renderTarget.innerHTML = `
            <div style="text-align: center; padding: calc(var(--baseline) * 10); color: var(--warning-color);">
                Could not synchronize timeline standings.
            </div>`;
    }
}

// Attach event triggers cleanly inside the native module initialization pass
document.addEventListener("DOMContentLoaded", () => {
    const prevElement = document.getElementById("prev-date-btn");
    const nextElement = document.getElementById("next-date-btn");

    if (prevElement) {
        prevElement.addEventListener("click", () => {
            activeNavDate.setDate(activeNavDate.getDate() - 1);
            renderLeaderboardView();
        });
    }

    if (nextElement) {
        nextElement.addEventListener("click", () => {
            activeNavDate.setDate(activeNavDate.getDate() + 1);
            renderLeaderboardView();
        });
    }
});

// Bind methods cleanly to explicit window properties for standalone legacy components
window.processChallengeEndgame = processChallengeEndgame;
window.displayDailyLeaderboard = renderLeaderboardView; 
window.renderLeaderboardView = renderLeaderboardView;

// Run initial execution immediately upon load line evaluation
renderLeaderboardView();
