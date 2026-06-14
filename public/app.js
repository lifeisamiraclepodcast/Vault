const form = document.getElementById("generatorForm");
const ideaInput = document.getElementById("idea");
const prefixInput = document.getElementById("prefix");
const toneInput = document.getElementById("tone");
const platformInput = document.getElementById("platform");
const titleOutput = document.getElementById("titleOutput");
const descriptionOutput = document.getElementById("descriptionOutput");
const hashtagsOutput = document.getElementById("hashtagsOutput");
const thumbnailPromptOutput = document.getElementById("thumbnailPromptOutput");
const thumbnailPreview = document.getElementById("thumbnailPreview");
const thumbnailNote = document.getElementById("thumbnailNote");
const titleCount = document.getElementById("titleCount");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const downloadLink = document.getElementById("downloadLink");
const buttons = Array.from(document.querySelectorAll("button[data-action]"));

let thumbnailBlobUrl = "";

function setBusy(isBusy) {
  form.classList.toggle("is-busy", isBusy);
  buttons.forEach((button) => {
    button.disabled = isBusy;
  });
}

function setStatus(message, kind = "ready") {
  statusText.textContent = message;
  statusText.classList.toggle("is-error", kind === "error");
  statusDot.style.background = kind === "error" ? "var(--danger)" : "var(--accent-2)";
  statusDot.style.boxShadow =
    kind === "error" ? "0 0 20px rgba(255, 111, 125, 0.75)" : "0 0 20px rgba(124, 247, 195, 0.75)";
}

function updateTitleCount() {
  const length = titleOutput.value.trim().length;
  titleCount.textContent = `${length} / 75`;
  titleCount.style.color = length > 75 ? "var(--danger)" : "var(--accent)";
  titleCount.style.borderColor = length > 75 ? "rgba(255, 111, 125, 0.3)" : "rgba(255, 179, 71, 0.25)";
}

function getPayload() {
  return {
    idea: ideaInput.value.trim(),
    prefix: prefixInput.value.trim(),
    tone: toneInput.value,
    platform: platformInput.value,
  };
}

async function callApi(action) {
  const response = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getPayload()),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Request failed for ${action}.`);
  }

  return data.data;
}

function clearThumbnailPreview() {
  if (thumbnailBlobUrl) {
    URL.revokeObjectURL(thumbnailBlobUrl);
    thumbnailBlobUrl = "";
  }

  thumbnailPreview.innerHTML = "<p>Image preview will appear here.</p>";
  downloadLink.hidden = true;
  downloadLink.removeAttribute("href");
  thumbnailNote.hidden = true;
  thumbnailNote.textContent = "";
}

function renderThumbnail(base64, mimeType) {
  clearThumbnailPreview();

  const img = document.createElement("img");
  img.alt = "Generated thumbnail preview";
  img.src = `data:${mimeType};base64,${base64}`;
  thumbnailPreview.replaceChildren(img);

  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  thumbnailBlobUrl = URL.createObjectURL(blob);
  downloadLink.href = thumbnailBlobUrl;
  downloadLink.hidden = false;
}

async function runAction(action) {
  if (!ideaInput.value.trim()) {
    setStatus("Add a topic or rough idea first.", "error");
    ideaInput.focus();
    return;
  }

  setBusy(true);
  setStatus(`Generating ${action.replace("-", " ")}...`);

  try {
    if (action === "title") {
      const data = await callApi("title");
      titleOutput.value = data.title || "";
      updateTitleCount();
      setStatus("Title ready.");
      return;
    }

    if (action === "description") {
      const data = await callApi("description");
      descriptionOutput.value = data.description || "";
      hashtagsOutput.value = Array.isArray(data.hashtags) ? data.hashtags.join(" ") : "";
      setStatus("Description and hashtags ready.");
      return;
    }

    if (action === "thumbnail-prompt") {
      const data = await callApi("thumbnail-prompt");
      thumbnailPromptOutput.value = data.thumbnailPrompt || "";
      setStatus("Thumbnail prompt ready.");
      return;
    }

    if (action === "thumbnail") {
      const data = await callApi("thumbnail");
      thumbnailPromptOutput.value = data.thumbnailPrompt || "";
      if (data.imageAvailable && data.imageBase64) {
        renderThumbnail(data.imageBase64, data.mimeType || "image/png");
        setStatus("Thumbnail image ready.");
      } else {
        clearThumbnailPreview();
        thumbnailPromptOutput.value = data.thumbnailPrompt || thumbnailPromptOutput.value;
        thumbnailNote.hidden = false;
        thumbnailNote.textContent = data.error
          ? `Thumbnail prompt returned, but image generation fell back: ${data.error}`
          : "Thumbnail prompt returned, but image generation was unavailable.";
        setStatus("Thumbnail prompt ready. Image fallback used.");
      }
    }
  } catch (error) {
    setStatus(error.message || "Something went wrong.", "error");
  } finally {
    setBusy(false);
  }
}

buttons.forEach((button) => {
  button.addEventListener("click", () => runAction(button.dataset.action));
});

titleOutput.addEventListener("input", updateTitleCount);

updateTitleCount();
setStatus("Ready when you are.");