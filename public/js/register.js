redirectIfLoggedIn();

const form = document.getElementById("register-form");
const errorBox = document.getElementById("error-box");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.remove("show");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account…";

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Registration failed.");

    saveSession(data.token, data.user);
    window.location.href = "/dashboard.html";
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add("show");
    submitBtn.disabled = false;
    submitBtn.textContent = "Create account";
  }
});
