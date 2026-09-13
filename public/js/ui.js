// Shared UI layer — dark mode, toast notifications, a custom confirm dialog,
// and a small ripple effect on buttons. Loaded on every page.

// ---------- Dark mode ----------
// The <html> element already gets data-theme set by an inline script in
// <head> (before paint, so there's no flash of the wrong theme). This just
// wires up the toggle switch.
function initThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  toggle.textContent = isDark ? "☀️" : "🌙";

  toggle.addEventListener("click", () => {
    const nowDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = nowDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("nimbus_theme", next);
    toggle.textContent = next === "dark" ? "☀️" : "🌙";
  });
}

// ---------- Toasts (replaces alert()) ----------
let toastContainer;

function ensureToastContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement("div");
  toastContainer.id = "toast-container";
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function showToast(message, type = "info") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // trigger enter animation
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ---------- Custom confirm dialog (replaces confirm()) ----------
let confirmModal, confirmMessageEl, confirmYesBtn, confirmNoBtn, confirmResolve;

function ensureConfirmModal() {
  if (confirmModal) return;

  confirmModal = document.createElement("div");
  confirmModal.className = "modal-overlay";
  confirmModal.id = "confirm-modal";
  confirmModal.innerHTML = `
    <div class="modal-box" style="max-width:380px;">
      <div class="modal-header">
        <h3>Are you sure?</h3>
      </div>
      <p class="sub" id="confirm-message" style="margin-top:0;"></p>
      <div class="modal-actions">
        <button class="secondary-btn" id="confirm-no-btn">Cancel</button>
        <button class="btn-primary" id="confirm-yes-btn" style="background:#9B3B3B;">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(confirmModal);

  confirmMessageEl = document.getElementById("confirm-message");
  confirmYesBtn = document.getElementById("confirm-yes-btn");
  confirmNoBtn = document.getElementById("confirm-no-btn");

  confirmYesBtn.addEventListener("click", () => resolveConfirm(true));
  confirmNoBtn.addEventListener("click", () => resolveConfirm(false));
  confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) resolveConfirm(false);
  });
}

function resolveConfirm(result) {
  confirmModal.classList.remove("show");
  if (confirmResolve) confirmResolve(result);
  confirmResolve = null;
}

function customConfirm(message) {
  ensureConfirmModal();
  confirmMessageEl.textContent = message;
  confirmModal.classList.add("show");
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

// ---------- Button ripple effect ----------
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || btn.disabled) return;

  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

document.addEventListener("DOMContentLoaded", initThemeToggle);
