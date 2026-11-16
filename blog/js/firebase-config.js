// ======================================================
// ROLLAWORD BLOG — ADMIN EDITOR & AUTHOR AUTHENTICATION
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

// ======================================================
// ELEMENTS
// ======================================================

const title = document.getElementById("articleTitle");
const subtitle = document.getElementById("articleSubtitle");
const slug = document.getElementById("articleSlug");
const body = document.getElementById("articleBody");

const status = document.getElementById("saveStatus");
const previewPanel = document.getElementById("previewPanel");
const previewContent = document.getElementById("previewContent");

const loginPanel = document.getElementById("loginPanel");
const authStatus = document.getElementById("authStatus");
const signInButton = document.getElementById("googleSignInButton");
const signOutButton = document.getElementById("signOutButton");

const editorPanel = body.closest(".panel");
const detailsPanel = title.closest(".panel");

const STORAGE_KEY = "rollawordBlogAdminDraftV1";

// Hide the editor until authorization is confirmed.
detailsPanel.hidden = true;
editorPanel.hidden = true;

// ======================================================
// GOOGLE SIGN-IN
// ======================================================

signInButton.addEventListener("click", async () => {
    try {
        authStatus.textContent = "Connecting to Google...";

        await signInWithPopup(auth, googleProvider);

    } catch (error) {
        console.error("Google sign-in error:", error);
        authStatus.textContent = "Sign-in failed: " + error.message;
    }
});

signOutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Sign-out error:", error);
    }
});

// ======================================================
// CHECK FIRESTORE AUTHOR LIST
// Document ID = lowercase Google email address
// ======================================================

async function checkAuthorAccess(user) {

    if (!user || !user.email) {
        return false;
    }

    const email = user.email.toLowerCase();

    try {
        const authorRef = doc(db, "blogAuthors", email);
        const authorSnapshot = await getDoc(authorRef);

        return authorSnapshot.exists();

    } catch (error) {
        console.error("Author verification error:", error);
        authStatus.textContent =
            "Could not verify author access. Check Firestore permissions.";

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
        previewPanel.hidden = true;

        signInButton.hidden = false;
        signOutButton.hidden = true;

        authStatus.textContent =
            "Please sign in with your authorized Google account.";

        return;
    }

    authStatus.textContent = "Checking author authorization...";

    const authorized = await checkAuthorAccess(user);

    if (!authorized) {

        detailsPanel.hidden = true;
        editorPanel.hidden = true;

        authStatus.textContent =
            `Access denied for ${user.email}. This account is not authorized.`;

        await signOut(auth);
        return;
    }

    authStatus.textContent = `Welcome, ${user.email}. You are authorized to publish.`;

    signInButton.hidden = true;
    signOutButton.hidden = false;

    detailsPanel.hidden = false;
    editorPanel.hidden = false;

    loadDraft();
});

// ======================================================
// EDITOR — SLUG GENERATION
// ======================================================

function slugify(value) {
    return value.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// ======================================================
// LOCAL DRAFT STORAGE
// ======================================================

function saveDraft() {

    const draft = {
        title: title.value,
        subtitle: subtitle.value,
        slug: slug.value,
        body: body.innerHTML
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        status.textContent = "Draft saved on this device.";
    } catch (error) {
        status.textContent = "Browser storage unavailable.";
    }
}

function loadDraft() {

    try {
        const draft = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "null"
        );

        if (!draft) return;

        title.value = draft.title || "";
        subtitle.value = draft.subtitle || "";
        slug.value = draft.slug || "";
        body.innerHTML = draft.body || "";

        status.textContent = "Previous draft restored.";

    } catch (error) {
        status.textContent = "Could not restore previous draft.";
    }
}

// ======================================================
// HTML ESCAPING
// ======================================================

function escapeHtml(value) {
    return value.replace(/[&<>"]/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    }[char]));
}

// ======================================================
// HTML TO MARKDOWN CONVERSION
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

    if (tag === "strong" || tag === "b")
        return `**${inner}**`;

    if (tag === "em" || tag === "i")
        return `*${inner}*`;

    if (tag === "a")
        return `[${inner}](${node.getAttribute("href") || ""})`;

    if (tag === "h2")
        return `## ${inner}\n\n`;

    if (tag === "h3")
        return `### ${inner}\n\n`;

    if (tag === "blockquote")
        return inner.trim().split("\n")
            .map(line => `> ${line}`)
            .join("\n") + "\n\n";

    if (tag === "li")
        return `- ${inner.trim()}\n`;

    if (tag === "ul" || tag === "ol")
        return inner + "\n";

    if (tag === "p" || tag === "div")
        return inner.trim() ? `${inner.trim()}\n\n` : "";

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

        document.execCommand(
            button.dataset.command,
            false,
            null
        );

        saveDraft();
    });
});

document.querySelectorAll("[data-block]").forEach(button => {

    button.addEventListener("click", () => {
        body.focus();

        document.execCommand(
            "formatBlock",
            false,
            button.dataset.block
        );

        saveDraft();
    });
});

// Insert hyperlink
document.getElementById("linkButton").addEventListener("click", () => {

    const url = prompt("Enter the link URL (include https://):");

    if (!url) return;

    if (!/^https?:\/\//i.test(url)) {
        alert("Please enter a complete URL.");
        return;
    }

    body.focus();
    document.execCommand("createLink", false, url);

    saveDraft();
});

// Clear formatting
document.getElementById("clearFormatButton").addEventListener("click", () => {

    body.focus();
    document.execCommand("removeFormat", false, null);

    saveDraft();
});

// ======================================================
// ARTICLE PREVIEW
// ======================================================

function markdownPreview() {

    let html = escapeHtml(getMarkdown());

    html = html
        .replace(/^### (.*)$/gm, "<h3>$1</h3>")
        .replace(/^## (.*)$/gm, "<h2>$1</h2>")
        .replace(/^# (.*)$/gm, "<h1>$1</h1>")
        .replace(/^\*([^*]+)\*$/gm, "<em>$1</em>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/^> (.*)$/gm, "<blockquote>$1</blockquote>")
        .replace(/^- (.*)$/gm, "<li>$1</li>")
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br>");

    previewContent.innerHTML = `<p>${html}</p>`;
}

document.getElementById("previewButton").addEventListener("click", () => {

    markdownPreview();

    previewPanel.hidden = false;

    previewPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

document.getElementById("closePreviewButton").addEventListener("click", () => {
    previewPanel.hidden = true;
});

// ======================================================
// DOWNLOAD MARKDOWN ARTICLE
// ======================================================

document.getElementById("downloadButton").addEventListener("click", () => {

    const cleanSlug = slugify(slug.value || title.value)
        || "untitled-article";

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