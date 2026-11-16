(() => {
  const title = document.getElementById("articleTitle");
  const subtitle = document.getElementById("articleSubtitle");
  const slug = document.getElementById("articleSlug");
  const body = document.getElementById("articleBody");
  const status = document.getElementById("saveStatus");
  const previewPanel = document.getElementById("previewPanel");
  const previewContent = document.getElementById("previewContent");
  const STORAGE_KEY = "rollawordBlogAdminDraftV1";

  const slugify = value => value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  function saveDraft() {
    const draft = { title: title.value, subtitle: subtitle.value, slug: slug.value, body: body.innerHTML };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      status.textContent = "Draft saved on this device.";
    } catch (error) {
      status.textContent = "Browser storage is unavailable; download your Markdown to keep a copy.";
    }
  }

  function loadDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!draft) return;
      title.value = draft.title || "";
      subtitle.value = draft.subtitle || "";
      slug.value = draft.slug || "";
      body.innerHTML = draft.body || "";
      status.textContent = "Your previous local draft has been restored.";
    } catch (error) {
      status.textContent = "Could not restore the previous draft.";
    }
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function nodeToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes).map(nodeToMarkdown).join("");
    if (tag === "br") return "\n";
    if (tag === "strong" || tag === "b") return `**${inner}**`;
    if (tag === "em" || tag === "i") return `*${inner}*`;
    if (tag === "a") return `[${inner}](${node.getAttribute("href") || ""})`;
    if (tag === "h2") return `## ${inner}\n\n`;
    if (tag === "h3") return `### ${inner}\n\n`;
    if (tag === "blockquote") return inner.trim().split("\n").map(line => `> ${line}`).join("\n") + "\n\n";
    if (tag === "li") return `- ${inner.trim()}\n`;
    if (tag === "ul" || tag === "ol") return inner + "\n";
    if (tag === "p" || tag === "div") return inner.trim() ? `${inner.trim()}\n\n` : "";
    return inner;
  }

  function getMarkdown() {
    const articleTitle = title.value.trim() || "Untitled article";
    const articleSubtitle = subtitle.value.trim();
    let markdown = `# ${articleTitle}\n\n`;
    if (articleSubtitle) markdown += `*${articleSubtitle}*\n\n`;
    markdown += Array.from(body.childNodes).map(nodeToMarkdown).join("");
    return markdown.trim() + "\n";
  }

  function markdownPreview() {
    // Preview is intentionally simple; the downloaded Markdown remains the source of truth.
    let html = escapeHtml(getMarkdown());
    html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>")
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

  document.getElementById("linkButton").addEventListener("click", () => {
    const url = prompt("Enter the link URL (include https://):");
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      alert("Please enter a complete URL beginning with http:// or https://");
      return;
    }
    body.focus();
    document.execCommand("createLink", false, url);
    saveDraft();
  });

  document.getElementById("clearFormatButton").addEventListener("click", () => {
    body.focus();
    document.execCommand("removeFormat", false, null);
    saveDraft();
  });

  document.getElementById("previewButton").addEventListener("click", () => {
    markdownPreview();
    previewPanel.hidden = false;
    previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("closePreviewButton").addEventListener("click", () => {
    previewPanel.hidden = true;
  });

  document.getElementById("downloadButton").addEventListener("click", () => {
    const cleanSlug = slugify(slug.value || title.value) || "untitled-article";
    slug.value = cleanSlug;
    const blob = new Blob([getMarkdown()], { type: "text/markdown;charset=utf-8" });
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

  [title, subtitle, slug, body].forEach(element => {
    element.addEventListener("input", () => {
      if (element === title && !slug.dataset.edited) slug.value = slugify(title.value);
      if (element === slug) slug.dataset.edited = "true";
      saveDraft();
    });
  });

  loadDraft();
})();
