import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsVFxlWhfnogijECMRgsUBFDGPyi4LjVo",
  authDomain: "san-juan-academy.firebaseapp.com",
  projectId: "san-juan-academy",
  appId: "1:579054522531:web:1b03832b8c43042e79af16"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const functions = getFunctions(app);
const listAuthUsers = httpsCallable(functions, "listAuthUsers");
const signInButton = document.getElementById("googleSignInButton");
const signOutButton = document.getElementById("signOutButton");
const refreshButton = document.getElementById("refreshButton");
const signedInAs = document.getElementById("signedInAs");
const statusMessage = document.getElementById("statusMessage");
const userCount = document.getElementById("userCount");
const tableBody = document.getElementById("usersTableBody");
const sortButtons = [...document.querySelectorAll("[data-sort]")];
let users = [], sortKey = "createdAt", sortDirection = "descending";
function setStatus(message, error = false) { statusMessage.textContent = message; statusMessage.classList.toggle("status-error", error); }
function formatDate(value) { if (!value) return "Never"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(); }
function valueForSort(user, key) {
  switch (key) {
    case "email": return (user.email || "").toLocaleLowerCase();
    case "uid": return (user.uid || "").toLocaleLowerCase();
    case "emailVerified": return user.emailVerified ? 1 : 0;
    case "disabled": return user.disabled ? 1 : 0;
    case "createdAt": return user.createdAt ? new Date(user.createdAt).getTime() : 0;
    case "lastSignInAt": return user.lastSignInAt ? new Date(user.lastSignInAt).getTime() : 0;
    default: return "";
  }
}
function renderUsers() {
  const direction = sortDirection === "ascending" ? 1 : -1;
  const sorted = [...users].sort((a,b) => { const av=valueForSort(a,sortKey), bv=valueForSort(b,sortKey); if(typeof av === "number" && typeof bv === "number") return (av-bv)*direction; return String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:"base"})*direction; });
  sortButtons.forEach(b => b.setAttribute("aria-sort", b.dataset.sort===sortKey ? sortDirection : "none"));
  tableBody.replaceChildren();
  if (!sorted.length) { const row=document.createElement("tr"), cell=document.createElement("td"); cell.colSpan=6; cell.textContent="No users to display."; row.appendChild(cell); tableBody.appendChild(row); userCount.textContent="0 users."; return; }
  const fragment=document.createDocumentFragment();
  sorted.forEach(user => { const row=document.createElement("tr"); [user.email||"—",user.uid||"—",user.emailVerified?"Yes":"No",formatDate(user.createdAt),formatDate(user.lastSignInAt),user.disabled?"Yes":"No"].forEach(value => { const cell=document.createElement("td"); cell.textContent=value; row.appendChild(cell); }); fragment.appendChild(row); });
  tableBody.appendChild(fragment); userCount.textContent=`${sorted.length} user${sorted.length===1?"":"s"}.`;
}
async function loadUsers() {
  refreshButton.disabled=true; setStatus("Loading users…");
  try { const result=await listAuthUsers(); users=Array.isArray(result.data?.users)?result.data.users:[]; renderUsers(); setStatus("User list loaded."); }
  catch(error) { console.error("Unable to list Firebase Authentication users:",error); users=[]; renderUsers();
    if(error.code==="functions/permission-denied") setStatus("Access denied. This Google account is not authorized to view the user directory.",true);
    else if(error.code==="functions/unauthenticated") setStatus("Please sign in with your authorized Google account.",true);
    else if(error.code==="functions/not-found") setStatus("The listAuthUsers Cloud Function was not found. Deploy it to us-central1.",true);
    else setStatus(`Could not load users: ${error.message||error.code||"Unknown error"}`,true);
  } finally { refreshButton.disabled=!auth.currentUser; }
}
signInButton.addEventListener("click",async()=>{ signInButton.disabled=true; setStatus("Opening Google sign-in…"); try { await signInWithPopup(auth,googleProvider); } catch(error) { console.error("Google sign-in failed:",error); if(error.code==="auth/popup-closed-by-user") setStatus("Google sign-in was cancelled."); else if(error.code==="auth/unauthorized-domain") setStatus("This website's domain is not authorized in Firebase Authentication settings.",true); else setStatus(`Google sign-in failed: ${error.message||error.code}`,true); } finally { signInButton.disabled=false; } });
signOutButton.addEventListener("click",async()=>{ try { await signOut(auth); } catch(error) { setStatus(`Sign-out failed: ${error.message||error.code}`,true); } });
refreshButton.addEventListener("click",loadUsers);
sortButtons.forEach(button=>button.addEventListener("click",()=>{ const key=button.dataset.sort; if(sortKey===key) sortDirection=sortDirection==="ascending"?"descending":"ascending"; else {sortKey=key;sortDirection="ascending";} renderUsers(); }));
onAuthStateChanged(auth,async user=>{ const signedIn=Boolean(user); signInButton.hidden=signedIn; signOutButton.hidden=!signedIn; refreshButton.disabled=!signedIn; signedInAs.hidden=!signedIn; signedInAs.textContent=signedIn?`Signed in as ${user.email||"Google account"}.`:""; if(user){setStatus("Signed in. Checking administrator authorization…");await loadUsers();} else {users=[];renderUsers();setStatus("Please sign in with Google to load users.");} });
