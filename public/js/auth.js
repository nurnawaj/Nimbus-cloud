// Small shared helpers used by every page.

const API_BASE = "/api";

function saveSession(token, user) {
  localStorage.setItem("nimbus_token", token);
  localStorage.setItem("nimbus_user", JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem("nimbus_token");
}

function getUser() {
  const raw = localStorage.getItem("nimbus_user");
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem("nimbus_token");
  localStorage.removeItem("nimbus_user");
}

// Redirects to login if there's no token — call at the top of protected pages.
function requireLogin() {
  if (!getToken()) {
    window.location.href = "/login.html";
  }
}

// If already logged in, skip the login/register screen.
function redirectIfLoggedIn() {
  if (getToken()) {
    window.location.href = "/dashboard.html";
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
