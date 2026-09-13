requireLogin();

const token = getToken();
const authHeader = { Authorization: `Bearer ${token}` };

const grid = document.getElementById("file-grid");
const greeting = document.getElementById("greeting");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const dropzone = document.getElementById("dropzone");
const storageFill = document.getElementById("storage-fill");
const storageAmount = document.getElementById("storage-amount");
const logoutBtn = document.getElementById("logout-btn");
const searchInput = document.getElementById("search-input");
const newFolderBtn = document.getElementById("new-folder-btn");
const breadcrumbEl = document.getElementById("breadcrumb");

const user = getUser();
if (user) greeting.textContent = `Welcome back, ${user.name}`;

// currentFolderId is read from the URL (?folder=<id>) so links/back-button work
const urlParams = new URLSearchParams(window.location.search);
let currentFolderId = urlParams.get("folder") || null;
let currentPreviewObjectUrl = null;
let shareModalFileId = null;
let lastLoadedFiles = [];

logoutBtn.addEventListener("click", () => {
  clearSession();
  window.location.href = "/login.html";
});

function goToFolder(folderId) {
  window.location.href = folderId ? `/dashboard.html?folder=${folderId}` : "/dashboard.html";
}

// ---------- Breadcrumb ----------
async function loadBreadcrumb() {
  if (!currentFolderId) {
    breadcrumbEl.innerHTML = `<span class="crumb current">My Files</span>`;
    return;
  }

  const res = await fetch(`${API_BASE}/folders/${currentFolderId}/path`, { headers: authHeader });
  if (!res.ok) return;
  const data = await res.json();

  const rootCrumb = `<span class="crumb" onclick="goToFolder(null)">My Files</span><span class="sep">/</span>`;
  const chain = data.path
    .map((f, i) => {
      const isLast = i === data.path.length - 1;
      return isLast
        ? `<span class="crumb current">${escapeHtml(f.name)}</span>`
        : `<span class="crumb" onclick="goToFolder('${f.id}')">${escapeHtml(f.name)}</span><span class="sep">/</span>`;
    })
    .join("");

  breadcrumbEl.innerHTML = rootCrumb + chain;
}

// ---------- Load folders + files together ----------
async function loadContents(searchTerm) {
  grid.innerHTML = `<div class="spinner" style="grid-column: 1 / -1;"></div>`;
  const isSearch = !!(searchTerm && searchTerm.trim());

  const folderPromise = isSearch
    ? Promise.resolve({ folders: [] }) // search only looks at files, across all folders
    : fetch(`${API_BASE}/folders?parent=${currentFolderId || ""}`, { headers: authHeader }).then((r) => r.json());

  const fileUrl = isSearch
    ? `${API_BASE}/files?q=${encodeURIComponent(searchTerm.trim())}`
    : `${API_BASE}/files?folderId=${currentFolderId || ""}`;

  const [folderData, fileRes] = await Promise.all([
    folderPromise,
    fetch(fileUrl, { headers: authHeader }),
  ]);

  if (fileRes.status === 401) return handleExpiredSession();
  const fileData = await fileRes.json();

  lastLoadedFiles = fileData.files;
  renderGrid(folderData.folders || [], fileData.files, isSearch);
}

function renderGrid(folders, files, isSearch) {
  if (!folders.length && !files.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>${isSearch ? "No matches" : "Nothing here yet"}</h3>
        <p>${isSearch ? "Try a different search term." : "Upload a file or create a folder to get started."}</p>
      </div>`;
    return;
  }

  const folderCards = folders
    .map(
      (f) => `
        <div class="folder-card" onclick="goToFolder('${f._id}')">
          <div class="file-icon">DIR</div>
          <div class="file-name">${escapeHtml(f.name)}</div>
          <div class="file-meta">Folder</div>
          <div class="file-actions">
            <button onclick="event.stopPropagation(); deleteFolder('${f._id}')" class="delete-btn">Delete</button>
          </div>
        </div>`
    )
    .join("");

  const fileCards = files
    .map((f) => {
      const ext = (f.name.split(".").pop() || "FILE").slice(0, 4).toUpperCase();
      const date = new Date(f.uploadDate).toLocaleDateString();
      const sharedBadge = f.shared ? " · Shared" : "";
      return `
        <div class="file-card">
          <div class="file-icon">${ext}</div>
          <div class="file-name">${escapeHtml(f.name)}</div>
          <div class="file-meta">${formatBytes(f.size)} · ${date}${sharedBadge}</div>
          <div class="file-actions">
            ${f.previewable ? `<button onclick="openPreview('${f.id}')">Preview</button>` : ""}
            <button onclick="downloadFile('${f.id}', '${escapeHtml(f.name)}')">Download</button>
          </div>
          <div class="file-actions" style="margin-top:8px;">
            <button onclick="renameFile('${f.id}')">Rename</button>
            <button onclick="openShareModal('${f.id}')">Share</button>
            <button class="delete-btn" onclick="deleteFile('${f.id}')">Delete</button>
          </div>
        </div>`;
    })
    .join("");

  grid.innerHTML = folderCards + fileCards;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Search ----------
let searchDebounce;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadContents(searchInput.value), 300);
});

// ---------- New folder ----------
newFolderBtn.addEventListener("click", async () => {
  const name = prompt("Folder name:");
  if (!name || !name.trim()) return;

  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), parentId: currentFolderId }),
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.message || "Could not create folder.", "error");

  loadContents(searchInput.value);
});

async function deleteFolder(id) {
  if (!(await customConfirm("Delete this folder and everything inside it? This can't be undone."))) return;

  const res = await fetch(`${API_BASE}/folders/${id}`, { method: "DELETE", headers: authHeader });
  const data = await res.json();
  if (!res.ok) return showToast(data.message || "Could not delete folder.", "error");

  await Promise.all([loadContents(searchInput.value), loadStorage()]);
  showToast("Folder deleted.", "success");
}

// ---------- Storage meter ----------
async function loadStorage() {
  const res = await fetch(`${API_BASE}/files/storage`, { headers: authHeader });
  if (res.status === 401) return handleExpiredSession();
  const data = await res.json();
  const pct = Math.min(100, (data.used / data.max) * 100);
  storageFill.style.width = `${pct}%`;
  storageAmount.textContent = `${formatBytes(data.used)} of ${formatBytes(data.max)}`;
}

// ---------- Upload ----------
uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) uploadFile(fileInput.files[0]);
});

["dragover", "dragenter"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  })
);

["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
  })
);

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  if (currentFolderId) formData.append("folderId", currentFolderId);

  uploadBtn.textContent = "Uploading…";
  uploadBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: "POST",
      headers: authHeader,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Upload failed.");

    await Promise.all([loadContents(searchInput.value), loadStorage()]);
    showToast(`"${file.name}" uploaded.`, "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    uploadBtn.textContent = "Upload file";
    uploadBtn.disabled = false;
    fileInput.value = "";
  }
}

// ---------- Download ----------
async function downloadFile(id, name) {
  const res = await fetch(`${API_BASE}/files/${id}/download`, { headers: authHeader });
  if (!res.ok) return showToast("Could not download file.", "error");

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ---------- Rename ----------
async function renameFile(id) {
  const file = lastLoadedFiles.find((f) => f.id === id);
  const newName = prompt("New file name:", file ? file.name : "");
  if (!newName || !newName.trim()) return;

  const res = await fetch(`${API_BASE}/files/${id}`, {
    method: "PATCH",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName.trim() }),
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.message || "Could not rename file.", "error");

  loadContents(searchInput.value);
  showToast("File renamed.", "success");
}

// ---------- Delete ----------
async function deleteFile(id) {
  if (!(await customConfirm("Delete this file? This can't be undone."))) return;

  const res = await fetch(`${API_BASE}/files/${id}`, {
    method: "DELETE",
    headers: authHeader,
  });
  if (!res.ok) return showToast("Could not delete file.", "error");

  await Promise.all([loadContents(searchInput.value), loadStorage()]);
  showToast("File deleted.", "success");
}

// ---------- Preview modal ----------
async function openPreview(id) {
  const file = lastLoadedFiles.find((f) => f.id === id);
  const nameEl = document.getElementById("preview-name");
  const bodyEl = document.getElementById("preview-body");

  nameEl.textContent = file ? file.name : "Preview";
  bodyEl.innerHTML = `<div class="preview-fallback">Loading preview…</div>`;
  openModal("preview-modal");

  const res = await fetch(`${API_BASE}/files/${id}/preview`, { headers: authHeader });
  if (!res.ok) {
    bodyEl.innerHTML = `<div class="preview-fallback">Couldn't load this preview.</div>`;
    return;
  }

  const blob = await res.blob();
  currentPreviewObjectUrl = window.URL.createObjectURL(blob);

  if (file && file.type && file.type.startsWith("image/")) {
    bodyEl.innerHTML = `<img src="${currentPreviewObjectUrl}" alt="${escapeHtml(file.name)}">`;
  } else if (file && file.type === "application/pdf") {
    bodyEl.innerHTML = `<iframe src="${currentPreviewObjectUrl}"></iframe>`;
  } else {
    bodyEl.innerHTML = `<div class="preview-fallback">Preview not available for this file type — try downloading it instead.</div>`;
  }
}

// ---------- Share modal ----------
function openShareModal(id) {
  shareModalFileId = id;
  const file = lastLoadedFiles.find((f) => f.id === id);

  document.getElementById("share-link-row").style.display = "none";
  document.getElementById("revoke-row").style.display = file && file.shared ? "flex" : "none";
  document.getElementById("share-link-input").value = "";
  document.getElementById("expiry-select").value = "0";
  document.getElementById("nfc-section").style.display = "none";
  document.getElementById("nfc-status").textContent = "";

  openModal("share-modal");
}

document.getElementById("generate-link-btn").addEventListener("click", async () => {
  const hours = parseInt(document.getElementById("expiry-select").value) || 0;

  const res = await fetch(`${API_BASE}/files/${shareModalFileId}/share`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresInHours: hours }),
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.message || "Could not create share link.", "error");

  document.getElementById("share-link-input").value = data.shareUrl;
  document.getElementById("share-link-row").style.display = "flex";
  document.getElementById("revoke-row").style.display = "flex";

  // Only Chrome on Android exposes NDEFReader — offer the NFC option when it's there
  if ("NDEFReader" in window) {
    document.getElementById("nfc-section").style.display = "block";
  }

  loadContents(searchInput.value); // refresh "Shared" badge in the background
});

// ---------- Write the current share link to a physical NFC tag ----------
document.getElementById("nfc-write-btn").addEventListener("click", async () => {
  const statusEl = document.getElementById("nfc-status");
  const shareUrl = document.getElementById("share-link-input").value;

  if (!shareUrl) {
    statusEl.textContent = "Generate a share link first.";
    return;
  }

  if (!("NDEFReader" in window)) {
    statusEl.textContent = "NFC writing isn't supported on this browser/device (Chrome for Android only).";
    return;
  }

  try {
    const ndef = new NDEFReader();
    statusEl.textContent = "Hold your phone against a blank NFC tag now…";
    await ndef.write({ records: [{ recordType: "url", data: shareUrl }] });
    statusEl.textContent = "✅ Link written! Anyone can now tap that tag to open this file.";
  } catch (err) {
    statusEl.textContent = `Couldn't write to a tag: ${err.message || "make sure NFC is turned on and a writable tag is nearby."}`;
  }
});

document.getElementById("copy-link-btn").addEventListener("click", () => {
  const input = document.getElementById("share-link-input");
  input.select();
  navigator.clipboard?.writeText(input.value).catch(() => document.execCommand("copy"));
  showToast("Link copied to clipboard.", "success");
});

document.getElementById("revoke-link-btn").addEventListener("click", async () => {
  const res = await fetch(`${API_BASE}/files/${shareModalFileId}/share`, {
    method: "DELETE",
    headers: authHeader,
  });
  if (!res.ok) return showToast("Could not revoke link.", "error");

  closeModal("share-modal");
  loadContents(searchInput.value);
  showToast("Share link revoked.", "success");
});

// ---------- Generic modal helpers ----------
function openModal(id) {
  document.getElementById(id).classList.add("show");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("show");
  if (id === "preview-modal") {
    document.getElementById("preview-body").innerHTML = "";
    if (currentPreviewObjectUrl) {
      window.URL.revokeObjectURL(currentPreviewObjectUrl);
      currentPreviewObjectUrl = null;
    }
  }
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.show").forEach((el) => closeModal(el.id));
  }
});

function handleExpiredSession() {
  clearSession();
  window.location.href = "/login.html";
}

loadBreadcrumb();
loadContents();
loadStorage();
