import { supabase } from "./supabase.js";

let currentUser = null;
let currentTemplateId = null;
let initialized = false;

const MAX_JSON_SIZE = 5 * 1024 * 1024; // 5MB warning threshold

// DOM elements (resolved once on init)
let templateNameInput;
let saveBtn;
let newBtn;
let templateList;

export function initTemplateManager(user) {
  currentUser = user;
  currentTemplateId = null;

  if (!initialized) {
    templateNameInput = document.getElementById("template-name");
    saveBtn = document.getElementById("btn-save-template");
    newBtn = document.getElementById("btn-new-template");
    templateList = document.getElementById("template-list");

    saveBtn.addEventListener("click", saveTemplate);
    newBtn.addEventListener("click", newTemplate);

    // Ctrl/Cmd+S shortcut
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveTemplate();
      }
    });

    initialized = true;
  }

  loadTemplateList();
}

// --- Save (insert or update) ---
async function saveTemplate() {
  if (!currentUser) return;

  const blocks = window.EditorAPI.getBlocks();
  const name = templateNameInput.value.trim() || "Untitled";

  // Size warning
  const json = JSON.stringify(blocks);
  if (json.length > MAX_JSON_SIZE) {
    const sizeMB = (json.length / (1024 * 1024)).toFixed(1);
    window.EditorAPI.showToast(
      `Warning: Template is ${sizeMB}MB. Consider using external image URLs.`
    );
  }

  const record = {
    user_id: currentUser.id,
    name,
    blocks,
  };

  let error;
  if (currentTemplateId) {
    // Update existing
    ({ error } = await supabase
      .from("templates")
      .update({ name, blocks, updated_at: new Date().toISOString() })
      .eq("id", currentTemplateId));
  } else {
    // Insert new
    const { data, error: insertError } = await supabase
      .from("templates")
      .insert(record)
      .select("id")
      .single();
    error = insertError;
    if (data) currentTemplateId = data.id;
  }

  if (error) {
    window.EditorAPI.showToast("Save failed: " + error.message);
    return;
  }

  window.EditorAPI.showToast("Template saved");
  loadTemplateList();
}

// --- New template ---
function newTemplate() {
  currentTemplateId = null;
  templateNameInput.value = "";
  window.EditorAPI.clearBlocks();
  highlightActive();
  window.EditorAPI.showToast("New template");
}

// --- Load template list ---
async function loadTemplateList() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("templates")
    .select("id, name, updated_at")
    .eq("user_id", currentUser.id)
    .order("updated_at", { ascending: false });

  if (error) {
    templateList.innerHTML =
      '<div class="tpl-empty">Failed to load templates</div>';
    return;
  }

  if (!data || data.length === 0) {
    templateList.innerHTML =
      '<div class="tpl-empty">No saved templates yet</div>';
    return;
  }

  templateList.innerHTML = data
    .map((t) => {
      const date = new Date(t.updated_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const isActive = t.id === currentTemplateId;
      return `<div class="tpl-item${isActive ? " active" : ""}" data-id="${t.id}">
        <div class="tpl-item-info">
          <span class="tpl-item-name">${escHtml(t.name)}</span>
          <span class="tpl-item-date">${date}</span>
        </div>
        <div class="tpl-item-actions">
          <button class="tpl-load-btn" data-id="${t.id}" title="Load template">Load</button>
          <button class="tpl-dup-btn" data-id="${t.id}" title="Duplicate template"><i class="ph ph-copy"></i></button>
          <button class="tpl-delete-btn" data-id="${t.id}" title="Delete template"><i class="ph ph-trash"></i></button>
        </div>
      </div>`;
    })
    .join("");

  // Bind load buttons
  templateList.querySelectorAll(".tpl-load-btn").forEach((btn) => {
    btn.addEventListener("click", () => loadTemplate(btn.dataset.id));
  });

  // Bind duplicate buttons
  templateList.querySelectorAll(".tpl-dup-btn").forEach((btn) => {
    btn.addEventListener("click", () => duplicateTemplate(btn.dataset.id));
  });

  // Bind delete buttons
  templateList.querySelectorAll(".tpl-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteTemplate(btn.dataset.id));
  });
}

// --- Load a template ---
async function loadTemplate(id) {
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, blocks")
    .eq("id", id)
    .single();

  if (error || !data) {
    window.EditorAPI.showToast("Failed to load template");
    return;
  }

  currentTemplateId = data.id;
  templateNameInput.value = data.name;
  window.EditorAPI.loadBlocks(data.blocks);
  highlightActive();
  window.EditorAPI.showToast('Loaded "' + data.name + '"');
}

// --- Duplicate a template ---
async function duplicateTemplate(id) {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("templates")
    .select("name, blocks")
    .eq("id", id)
    .single();

  if (error || !data) {
    window.EditorAPI.showToast("Failed to duplicate template");
    return;
  }

  const newName = "Copy of " + data.name;

  const { error: insertError } = await supabase
    .from("templates")
    .insert({
      user_id: currentUser.id,
      name: newName,
      blocks: data.blocks,
    });

  if (insertError) {
    window.EditorAPI.showToast("Duplicate failed: " + insertError.message);
    return;
  }

  window.EditorAPI.showToast('Duplicated "' + data.name + '"');
  loadTemplateList();
}

// --- Delete a template ---
async function deleteTemplate(id) {
  if (!confirm("Delete this template? This cannot be undone.")) return;

  const { error } = await supabase.from("templates").delete().eq("id", id);

  if (error) {
    window.EditorAPI.showToast("Delete failed: " + error.message);
    return;
  }

  if (currentTemplateId === id) {
    currentTemplateId = null;
    templateNameInput.value = "";
  }

  window.EditorAPI.showToast("Template deleted");
  loadTemplateList();
}

// --- Highlight active template in list ---
function highlightActive() {
  if (!templateList) return;
  templateList.querySelectorAll(".tpl-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === currentTemplateId);
  });
}

// --- Utility ---
function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
