redirectIfLoggedIn();

const form = document.getElementById("login-form");
const errorBox = document.getElementById("error-box");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.remove("show");
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Login failed.");

    saveSession(data.token, data.user);
    window.location.href = "/dashboard.html";
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add("show");
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
});
