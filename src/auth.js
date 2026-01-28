import { supabase } from "./supabase.js";
import { initTemplateManager } from "./templates.js";

const authScreen = document.getElementById("auth-screen");
const editorScreen = document.getElementById("editor-screen");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const authToggle = document.getElementById("auth-toggle");
const authError = document.getElementById("auth-error");
const authConfirmation = document.getElementById("auth-confirmation");
const signOutBtn = document.getElementById("btn-signout");
const userEmailEl = document.getElementById("user-email");

let isSignUp = false;

// --- View switching ---
function showAuth() {
  authScreen.classList.remove("hidden");
  editorScreen.classList.add("hidden");
  authError.textContent = "";
  authConfirmation.classList.add("hidden");
}

function showEditor(user) {
  authScreen.classList.add("hidden");
  editorScreen.classList.remove("hidden");
  userEmailEl.textContent = user.email;
  initTemplateManager(user);
}

// --- Form toggle: Sign In / Sign Up ---
authToggle.addEventListener("click", (e) => {
  e.preventDefault();
  isSignUp = !isSignUp;
  authSubmit.textContent = isSignUp ? "Sign Up" : "Sign In";
  authToggle.textContent = isSignUp
    ? "Already have an account? Sign In"
    : "Don't have an account? Sign Up";
  authError.textContent = "";
  authConfirmation.classList.add("hidden");
});

// --- Form submit ---
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  authConfirmation.classList.add("hidden");

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    authError.textContent = "Please enter email and password.";
    return;
  }

  authSubmit.disabled = true;
  authSubmit.textContent = isSignUp ? "Signing up..." : "Signing in...";

  try {
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // If email confirmation is enabled, the session may be null
      if (data.session) {
        showEditor(data.session.user);
      } else {
        authConfirmation.classList.remove("hidden");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      showEditor(data.session.user);
    }
  } catch (err) {
    authError.textContent = err.message || "Authentication failed.";
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = isSignUp ? "Sign Up" : "Sign In";
  }
});

// --- Sign out ---
signOutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showAuth();
});

// --- Session persistence ---
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    showAuth();
  }
});

// --- Restore session on load ---
async function init() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    showEditor(session.user);
  } else {
    showAuth();
  }
}

init();
