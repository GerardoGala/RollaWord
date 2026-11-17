// ======================================================
// ROLLAWORD BLOG ADMIN
// Editor + Google Authentication + Firestore Authorization
// ======================================================

import {
    db,
    auth,
    googleProvider
} from "./firebase-config.js";

import {
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("ROLLAWORD ADMIN.JS LOADED");

// ======================================================
// DOM ELEMENTS
// ======================================================

const title = document.getElementById("articleTitle");
const subtitle = document.getElementById("articleSubtitle");
const slug = document.getElementById("articleSlug");
const body = document.getElementById("articleBody");

const status = document.getElementById("saveStatus");

const previewPanel = document.getElementById("previewPanel");
const previewContent = document.getElementById("previewContent");

const authStatus = document.getElementById("authStatus");
const signInButton = document.getElementById("googleSignInButton");
const signOutButton = document.getElementById("signOutButton");

const saveDraftButton = document.getElementById("saveDraftButton");
const previewButton = document.getElementById("previewButton");
const publishButton = document.getElementById("publishButton");
const downloadButton = document.getElementById("downloadButton");
const closePreviewButton = document.getElementById("closePreviewButton");

const linkButton = document.getElementById("linkButton");
const clearFormatButton = document.getElementById("clearFormatButton");

const detailsPanel = title?.closest(".panel");
const editorPanel = body?.closest(".panel");

const STORAGE_KEY = "rollawordBlogAdminDraftV1";

// Verify required HTML elements exist.
if (
    !signInButton || !signOutButton || !authStatus ||
    !title || !subtitle || !slug || !body ||
    !status || !detailsPanel || !editorPanel ||
    !saveDraftButton || !previewButton || !publishButton ||
    !downloadButton || !previewPanel || !previewContent ||
    !closePreviewButton || !linkButton || !clearFormatButton
) {
    throw new Error("Blog Admin HTML elements are missing. Check the element IDs in admin.html.");
}

// Hide editor until authorization is confirmed.
detailsPanel.hidden = true;
editorPanel.hidden = true;

// ======================================================
// GOOGLE SIGN-IN
// ======================================================

googleProvider.setCustomParameters({
    prompt: "select_account"
});

signInButton.addEventListener("click", async () => {
    authStatus.textContent = "Connecting to Google...";

    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Google sign-in error:", error);
        authStatus.textContent = "Sign-in failed: " + error.message;
    }
});

// ======================================================
// GOOGLE SIGN-OUT
// ======================================================

signOutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Sign-out error:", error);
        authStatus.textContent = "Sign-out failed: " + error.message;
    }
});

// ======================================================
// FIRESTORE AUTHOR VERIFICATION
// Document ID = lowercase Google email
// ======================================================

async function checkAuthorAccess(user) {
    if (!user || !user.email) {
        return false;
    }

    try {
        const email = user.email.toLowerCase();
        const authorRef = doc(db, "blogAuthors", email);
        const authorSnapshot = await getDoc(authorRef);

        return authorSnapshot.exists();
    } catch (error) {
        console.error("Firestore authorization error:", error);
        authStatus.textContent = "Unable to check author authorization.";
        return false;
    }
}

// ======================================================
// AUTHENTICATION STATE
// ======================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        detailsPanel.hidden = true;
        editorPanel.hidden = true;

        signInButton.hidden = false;
        signOutButton.hidden = true;

        authStatus.textContent =
            "Please sign in with your authorized Google account.";
        return;
    }

    authStatus.textContent = "Checking authorization...";

    const authorized = await checkAuthorAccess(user);

    if (!authorized) {
        detailsPanel.hidden = true;
        editorPanel.hidden = true;

        authStatus.textContent = "Access denied: " + (user.email || "unknown account");
        await signOut(auth);
        return;
    }

    authStatus.textContent = "Authorized: " + user.email;

    signInButton.hidden = true;
    signOutButton.hidden = false;

    detailsPanel.hidden = false;
    editorPanel.hidden = false;

    loadDraft();
});

// ======================================================
// SLUG GENERATION
// ======================================================

function slugify(value) {
    return value.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// ======================================================
// SAVE DRAFT LOCALLY
// This saves on this browser/device, not to the server.
// ======================================================

function saveDraft() {
    const draft = {
        title: title.value,
        subtitle: subtitle.value,
        slug: slug.value,
        body: body.innerHTML,
        updatedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        status.textContent = "Draft saved on this device.";
        return true;
    } catch (error) {
        console.error("Draft saving error:", error);
        status.textContent = "Browser storage unavailable. Draft was not saved.";
        return false;
    }
}

saveDraftButton.addEventListener("click", () => {
    saveDraft();
});

// ======================================================
// RESTORE DRAFT
// ======================================================

function loadDraft() {
    try {
        const draft = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "null"
        );

        if (!draft) {
            status.textContent = "No saved draft on this device.";
            return;
        }

        title.value = draft.title || "";
        subtitle.value = draft.subtitle || "";
        slug.value = draft.slug || "";
        body.innerHTML = draft.body || "";

        status.textContent = "Previous draft restored from this device.";
    } catch (error) {
        console.error("Draft restoration error:", error);
        status.textContent = "Could not restore the saved draft.";
    }
}

// ======================================================
// HTML ESCAPING
// ======================================================

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

// ======================================================
// HTML TO MARKDOWN
// ======================================================

function nodeToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
    }

    const tag = node.tagName.toLowerCase();

    const inner = Array.from(node.childNodes)
        .map(nodeToMarkdown)
        .join("");

    if (tag === "br") return "\n";

    if (tag === "strong" || tag === "b") {
        return `**${inner}**`;
    }

    if (tag === "em" || tag === "i") {
        return `*${inner}*`;
    }

    if (tag === "a") {
        const href = node.getAttribute("href") || "";
        return `[${inner}](${href})`;
    }

    if (tag === "h2") return `## ${inner}\n\n`;
    if (tag === "h3") return `### ${inner}\n\n`;

    if (tag === "blockquote") {
        return inner.trim().split("\n")
            .map(line => `> ${line}`)
            .join("\n") + "\n\n";
    }

    if (tag === "li") {
        const parentTag = node.parentElement?.tagName.toLowerCase();
        if (parentTag === "ol") {
            const items = Array.from(node.parentElement.children);
            const number = items.indexOf(node) + 1;
            return `${number}. ${inner.trim()}\n`;
        }
        return `- ${inner.trim()}\n`;
    }

    if (tag === "ul" || tag === "ol") {
        return inner + "\n";
    }

    if (tag === "p" || tag === "div") {
        return inner.trim() ? `${inner.trim()}\n\n` : "";
    }

    return inner;
}

function getMarkdown() {
    const articleTitle = title.value.trim() || "Untitled article";
    const articleSubtitle = subtitle.value.trim();

    let markdown = `# ${articleTitle}\n\n`;

    if (articleSubtitle) {
        markdown += `*${articleSubtitle}*\n\n`;
    }

    markdown += Array.from(body.childNodes)
        .map(nodeToMarkdown)
        .join("");

    return markdown.trim() + "\n";
}

// ======================================================
// EDITOR TOOLBAR
// ======================================================

document.querySelectorAll("[data-command]").forEach(button => {
    button.addEventListener("click", () => {
        body.focus();
        document.execCommand(button.dataset.command, false, null);
        saveDraft();
    });
});

document.querySelectorAll("[data-block]").forEach(button => {
    button.addEventListener("click", () => {
        body.focus();
        document.execCommand("formatBlock", false, button.dataset.block);
        saveDraft();
    });
});

// ======================================================
// INSERT LINK
// ======================================================

linkButton.addEventListener("click", () => {
    const url = prompt("Enter the link URL (include https://):");

    if (!url) return;

    if (!/^https?:\/\//i.test(url)) {
        alert("Please enter a valid URL beginning with http:// or https://");
        return;
    }

    body.focus();
    document.execCommand("createLink", false, url);
    saveDraft();
});

// ======================================================
// CLEAR FORMATTING
// ======================================================

clearFormatButton.addEventListener("click", () => {
    body.focus();
    document.execCommand("removeFormat", false, null);
    saveDraft();
});

// ======================================================
// ARTICLE PREVIEW
// ======================================================

function showPreview() {
    const articleTitle = title.value.trim() || "Untitled article";
    const articleSubtitle = subtitle.value.trim();

    previewContent.innerHTML = `
        <h1>${escapeHtml(articleTitle)}</h1>
        ${articleSubtitle ? `<p><em>${escapeHtml(articleSubtitle)}</em></p>` : ""}
        <div class="preview-body">${body.innerHTML}</div>
    `;

    previewPanel.hidden = false;
    previewPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

previewButton.addEventListener("click", showPreview);

closePreviewButton.addEventListener("click", () => {
    previewPanel.hidden = true;
});

// ======================================================
// PUBLISH
// Publishing service is not connected yet.
// Do not imply that an article has been published.
// ======================================================

publishButton.addEventListener("click", () => {
    alert(
        "Publishing is not connected yet. Your article has NOT been published. " +
        "Use Save Draft to keep it on this device, or Download Markdown as a backup."
    );
});

// ======================================================
// DOWNLOAD MARKDOWN
// ======================================================

downloadButton.addEventListener("click", () => {
    const cleanSlug = slugify(slug.value || title.value) || "untitled-article";
    slug.value = cleanSlug;

    const blob = new Blob(
        [getMarkdown()],
        { type: "text/markdown;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${cleanSlug}.md`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    saveDraft();
});

// ======================================================
// AUTOMATIC DRAFT SAVING
// ======================================================

[title, subtitle, slug, body].forEach(element => {
    element.addEventListener("input", () => {
        if (element === title && !slug.dataset.edited) {
            slug.value = slugify(title.value);
        }

        if (element === slug) {
            slug.dataset.edited = "true";
        }

        saveDraft();
    });
});
