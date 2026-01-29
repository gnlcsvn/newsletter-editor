/* ========================================================
   Newsletter Editor — Application Logic
   ======================================================== */

(function () {
  "use strict";

  // ─── State ────────────────────────────────────────────
  let blocks = [];
  let selectedId = null;
  let dragId = null;

  // Cursor tracking for inline icon insertion
  let lastRange = null;
  let lastEditableField = null;

  const canvas = document.getElementById("canvas");
  const emptyState = document.getElementById("empty-state");

  // Format toolbar elements
  const formatToolbar = document.getElementById("format-toolbar");
  const linkPopover = document.getElementById("link-popover");
  const linkPopoverInput = document.getElementById("link-popover-input");
  const linkPopoverApply = document.getElementById("link-popover-apply");
  const linkPopoverRemove = document.getElementById("link-popover-remove");
  let savedSelectionRange = null;

  // Size dropdown elements
  const formatSizeBtn = document.getElementById("format-size-btn");
  const formatSizeLabel = document.getElementById("format-size-label");
  const formatSizeMenu = document.getElementById("format-size-menu");

  const SIZE_LABELS = { "1": "Tiny", "2": "Small", "3": "Normal", "4": "H3", "5": "H2", "6": "H1" };
  const SIZE_PX = { "1": 10, "2": 13, "3": 16, "4": 18, "5": 24, "6": 32 };

  // ─── Block Defaults ───────────────────────────────────
  const DEFAULTS = {
    header: () => ({
      title: "Newsletter Title",
      date: "January 2025",
    }),
    text: () => ({
      body: '<font size="4"><b>Section Heading</b></font><br>Write your paragraph text here. Click to edit this content and replace it with your newsletter copy.',
      sideImage: "",
      sideImageRound: false,
    }),
    heading: () => ({
      text: "Section Heading",
    }),
    divider: () => ({}),
    spacer: () => ({ height: 40 }),
    image: () => ({
      url: "",
      caption: "Image caption (optional)",
      cropHeight: 0,
      objectPosition: 50,
      naturalWidth: 0,
      naturalHeight: 0,
    }),
    twocol: () => ({
      leftHeading: "Left Column",
      leftBody: "Content for the left column goes here.",
      rightHeading: "Right Column",
      rightBody: "Content for the right column goes here.",
    }),
    event: () => ({
      month: "JAN",
      day: "15",
      title: "Event Title",
      desc: "Brief description of the event, location, and time.",
    }),
    quote: () => ({
      text: "This is a highlighted quote or important message that you want readers to notice.",
      attribution: "— Attribution",
      sideImage: "",
      sideImageRound: false,
    }),
    button: () => ({
      label: "Learn More",
      url: "https://www.zhdk.ch",
    }),
    icon: () => ({
      name: "star",
      size: 32,
      label: "",
    }),
    footer: () => ({
      org: "Your Organization",
      details:
        "123 Street Name<br>City, ZIP<br>www.example.com",
    }),
  };

  // ─── ID generator ─────────────────────────────────────
  let _id = 0;
  function uid() {
    return "b" + ++_id;
  }

  // ─── Create a new block object ────────────────────────
  function createBlock(type) {
    return { id: uid(), type, data: DEFAULTS[type]() };
  }

  // ─── Phosphor icons for toolbar ─────────────────────
  const ICO = {
    up: '<i class="ph-bold ph-caret-up"></i>',
    down: '<i class="ph-bold ph-caret-down"></i>',
    dup: '<i class="ph-bold ph-copy"></i>',
    del: '<i class="ph-bold ph-trash"></i>',
    img: '<i class="ph-bold ph-image"></i>',
  };

  // ─── Render Canvas ────────────────────────────────────
  function render() {
    // Sync data from DOM before re-render
    syncAllData();
    hideFormatToolbar();

    canvas.innerHTML = "";
    emptyState.classList.toggle("hidden", blocks.length > 0);

    blocks.forEach((block, idx) => {
      const el = document.createElement("div");
      el.className = "block" + (block.id === selectedId ? " selected" : "");
      el.dataset.id = block.id;
      el.setAttribute("draggable", "true");

      // Toolbar
      const tb = document.createElement("div");
      tb.className = "block-toolbar";
      tb.innerHTML =
        `<button data-action="up" title="Move up">${ICO.up}</button>` +
        `<button data-action="down" title="Move down">${ICO.down}</button>` +
        `<button data-action="dup" title="Duplicate">${ICO.dup}</button>` +
        ((block.type === "text" || block.type === "quote") ? `<button data-action="side-image" title="Add side image">${ICO.img}</button>` : "") +
        `<button data-action="del" title="Delete">${ICO.del}</button>`;
      el.appendChild(tb);

      // Content
      const content = renderBlock(block);
      el.appendChild(content);

      canvas.appendChild(el);
    });

    bindBlockEvents();
  }

  // ─── Render individual block content ──────────────────
  // Data values for contenteditable fields are stored as sanitized HTML
  // (text escaped, only <i class="ph ph-*"> and <br> tags allowed).
  // They are output directly into innerHTML without additional escaping.
  function renderBlock(block) {
    const d = block.data;
    const wrap = document.createElement("div");

    switch (block.type) {
      case "header":
        wrap.className = "b-header";
        wrap.innerHTML =
          `<div class="b-header-title" contenteditable="true" data-field="title">${d.title}</div>` +
          `<div class="b-header-date" contenteditable="true" data-field="date">${d.date}</div>`;
        break;

      case "text":
        wrap.className = "b-text";
        if (d.sideImage) {
          const radius = d.sideImageRound ? "50%" : "0";
          wrap.innerHTML =
            `<div class="b-side-image-layout">` +
              `<div class="b-side-image-col">` +
                `<img class="b-side-image-preview" src="${escAttr(d.sideImage)}" alt="" style="border-radius:${radius};" />` +
                `<div class="b-side-image-actions">` +
                  `<button class="b-side-image-radius-btn" type="button" title="Toggle round/square"><i class="ph ph-${d.sideImageRound ? "square" : "circle"}"></i></button>` +
                  `<button class="b-side-image-remove-btn" type="button" title="Remove side image"><i class="ph ph-x"></i></button>` +
                `</div>` +
              `</div>` +
              `<div class="b-side-text-col">` +
                `<div class="b-text-body" contenteditable="true" data-field="body">${d.body}</div>` +
              `</div>` +
            `</div>`;
        } else {
          wrap.innerHTML =
            `<div class="b-text-body" contenteditable="true" data-field="body">${d.body}</div>`;
        }
        break;

      case "heading":
        wrap.className = "b-heading";
        wrap.innerHTML = `<div class="b-heading-text" contenteditable="true" data-field="text">${d.text}</div>`;
        break;

      case "divider":
        wrap.className = "b-divider";
        wrap.innerHTML = '<hr class="b-divider-line" />';
        break;

      case "spacer":
        wrap.className = "b-spacer";
        wrap.innerHTML =
          `<div class="b-spacer-inner" style="height:${d.height}px"></div>` +
          `<span class="b-spacer-label">spacer</span>`;
        break;

      case "image": {
        wrap.className = "b-image";
        const isDataUrl = d.url && d.url.startsWith("data:");
        const cropH = d.cropHeight || 0;
        const objPos = d.objectPosition != null ? d.objectPosition : 50;
        if (d.url) {
          const hasCrop = cropH > 0;
          const containerStyle = hasCrop
            ? `height:${cropH}px; overflow:hidden;`
            : "";
          const imgStyle = hasCrop
            ? `width:100%; height:100%; object-fit:cover; object-position:center ${objPos}%;`
            : `width:100%; display:block;`;
          wrap.innerHTML =
            `<div class="b-image-crop-container" style="${containerStyle}">` +
              `<img class="b-image-preview" src="${escAttr(d.url)}" alt="" style="${imgStyle}" />` +
            `</div>` +
            `<div class="b-image-crop-handle"><div class="b-image-crop-handle-bar"></div></div>` +
            `<div class="b-image-controls">` +
              `<div class="b-image-control-group">` +
                `<span class="b-image-control-label">Height</span>` +
                `<input class="b-image-crop-input" type="number" value="${cropH}" min="0" data-field="cropHeight" />` +
                `<span class="b-image-control-unit">px</span>` +
              `</div>` +
              `<div class="b-image-control-group">` +
                `<span class="b-image-control-label">Position</span>` +
                `<input class="b-image-range" type="range" min="0" max="100" value="${objPos}" data-field="objectPosition" />` +
              `</div>` +
              `<button class="b-image-replace-btn" type="button" title="Replace image"><i class="ph ph-arrow-clockwise"></i></button>` +
              `<button class="b-image-remove-btn" type="button" data-action="image-remove" title="Remove image"><i class="ph ph-trash"></i></button>` +
              `<input class="b-image-file-input" type="file" accept="image/*" />` +
            `</div>` +
            `<div class="b-image-caption" contenteditable="true" data-field="caption">${d.caption}</div>`;
        } else {
          wrap.innerHTML =
            `<div class="b-image-dropzone">` +
              `<i class="ph ph-image"></i>` +
              `<span>Drag &amp; drop an image here</span>` +
              `<button class="b-image-pick-btn" type="button">Choose File</button>` +
              `<input class="b-image-file-input" type="file" accept="image/*" />` +
            `</div>` +
            `<div class="b-image-caption" contenteditable="true" data-field="caption">${d.caption}</div>`;
        }
        break;
      }

      case "twocol":
        wrap.className = "b-twocol";
        wrap.innerHTML =
          `<div class="b-twocol-col">` +
          `<div class="b-twocol-heading" contenteditable="true" data-field="leftHeading">${d.leftHeading}</div>` +
          `<div class="b-twocol-body" contenteditable="true" data-field="leftBody">${d.leftBody}</div>` +
          `</div>` +
          `<div class="b-twocol-col">` +
          `<div class="b-twocol-heading" contenteditable="true" data-field="rightHeading">${d.rightHeading}</div>` +
          `<div class="b-twocol-body" contenteditable="true" data-field="rightBody">${d.rightBody}</div>` +
          `</div>`;
        break;

      case "event":
        wrap.className = "b-event";
        wrap.innerHTML =
          `<div class="b-event-date">` +
          `<div class="b-event-month" contenteditable="true" data-field="month">${d.month}</div>` +
          `<div class="b-event-day" contenteditable="true" data-field="day">${d.day}</div>` +
          `</div>` +
          `<div class="b-event-content">` +
          `<div class="b-event-title" contenteditable="true" data-field="title">${d.title}</div>` +
          `<div class="b-event-desc" contenteditable="true" data-field="desc">${d.desc}</div>` +
          `</div>`;
        break;

      case "quote":
        wrap.className = "b-quote";
        if (d.sideImage) {
          const radius = d.sideImageRound ? "50%" : "0";
          wrap.innerHTML =
            `<div class="b-side-image-layout">` +
              `<div class="b-side-image-col">` +
                `<img class="b-side-image-preview" src="${escAttr(d.sideImage)}" alt="" style="border-radius:${radius};" />` +
                `<div class="b-side-image-actions">` +
                  `<button class="b-side-image-radius-btn" type="button" title="Toggle round/square"><i class="ph ph-${d.sideImageRound ? "square" : "circle"}"></i></button>` +
                  `<button class="b-side-image-remove-btn" type="button" title="Remove side image"><i class="ph ph-x"></i></button>` +
                `</div>` +
              `</div>` +
              `<div class="b-side-text-col">` +
                `<div class="b-quote-inner">` +
                  `<div class="b-quote-text" contenteditable="true" data-field="text">${d.text}</div>` +
                  `<div class="b-quote-attr" contenteditable="true" data-field="attribution">${d.attribution}</div>` +
                `</div>` +
              `</div>` +
            `</div>`;
        } else {
          wrap.innerHTML =
            `<div class="b-quote-inner">` +
            `<div class="b-quote-text" contenteditable="true" data-field="text">${d.text}</div>` +
            `<div class="b-quote-attr" contenteditable="true" data-field="attribution">${d.attribution}</div>` +
            `</div>`;
        }
        break;

      case "button":
        wrap.className = "b-button";
        wrap.innerHTML =
          `<span class="b-button-link" contenteditable="true" data-field="label">${d.label}</span>` +
          `<input class="b-button-url" type="text" value="${escAttr(d.url)}" data-field="url" placeholder="https://..." />`;
        break;

      case "icon":
        wrap.className = "b-icon";
        wrap.innerHTML =
          `<div class="b-icon-preview"><i class="ph ph-${esc(d.name)}" style="font-size:${d.size}px"></i></div>` +
          `<div class="b-icon-name">${esc(d.name)}</div>` +
          `<div class="b-icon-label" contenteditable="true" data-field="label">${d.label}</div>`;
        break;

      case "footer":
        wrap.className = "b-footer";
        wrap.innerHTML =
          `<div class="b-footer-org" contenteditable="true" data-field="org">${d.org}</div>` +
          `<div class="b-footer-details" contenteditable="true" data-field="details">${d.details}</div>`;
        break;
    }

    return wrap;
  }

  // ─── Sync DOM content back into data ──────────────────
  function syncAllData() {
    canvas.querySelectorAll(".block").forEach((el) => {
      const id = el.dataset.id;
      const block = blocks.find((b) => b.id === id);
      if (!block) return;
      syncBlockData(el, block);
    });
  }

  function syncBlockData(el, block) {
    el.querySelectorAll("[data-field]").forEach((field) => {
      const key = field.dataset.field;
      if (field.tagName === "INPUT") {
        if (field.type === "number" || field.type === "range") {
          block.data[key] = parseInt(field.value, 10) || 0;
        } else {
          block.data[key] = field.value;
        }
      } else {
        // For contenteditable, sanitize HTML (preserve icons + line breaks)
        block.data[key] = sanitizeHtml(field.innerHTML);
      }
    });
  }

  // ─── Bind events on rendered blocks ───────────────────
  function bindBlockEvents() {
    // Toolbar actions
    canvas.querySelectorAll(".block-toolbar button").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const blockEl = btn.closest(".block");
        const id = blockEl.dataset.id;
        const action = btn.dataset.action;
        handleToolbarAction(id, action);
      });
    });

    // Selection
    canvas.querySelectorAll(".block").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        if (e.target.closest(".block-toolbar")) return;
        selectedId = el.dataset.id;
        canvas.querySelectorAll(".block").forEach((b) => b.classList.remove("selected"));
        el.classList.add("selected");
      });
    });

    // ── Image block handlers ─────────────────────────────

    // File pick / replace button → trigger hidden file input
    // mousedown must stop propagation & disable draggable so click fires reliably
    canvas.querySelectorAll(".b-image-pick-btn, .b-image-replace-btn").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        btn.closest(".block").setAttribute("draggable", "false");
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        btn.closest(".block").setAttribute("draggable", "true");
        const fileInput = btn.closest(".b-image").querySelector(".b-image-file-input");
        if (fileInput) fileInput.click();
      });
    });

    // File input change → read file as data URL
    canvas.querySelectorAll(".b-image-file-input").forEach((input) => {
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        const blockEl = input.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (!block) return;
        readFileAsDataURL(file).then((dataUrl) => {
          applyImageToBlock(block, dataUrl);
        });
      });
    });

    // Dropzone / crop-container drag events (file drop for image upload)
    canvas.querySelectorAll(".b-image-dropzone, .b-image-crop-container").forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        if (dragId) return; // Block reorder in progress — let it propagate
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add("drag-over");
      });
      zone.addEventListener("dragleave", () => {
        zone.classList.remove("drag-over");
      });
      zone.addEventListener("drop", (e) => {
        if (dragId) return; // Block reorder in progress
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith("image/")) return;
        const blockEl = zone.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (!block) return;
        readFileAsDataURL(file).then((dataUrl) => {
          applyImageToBlock(block, dataUrl);
        });
      });
    });

    // Remove button → reset image to defaults
    canvas.querySelectorAll("[data-action=image-remove]").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        btn.closest(".block").setAttribute("draggable", "false");
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        btn.closest(".block").setAttribute("draggable", "true");
        const blockEl = btn.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (!block) return;
        const defaults = DEFAULTS.image();
        Object.assign(block.data, defaults);
        render();
      });
    });

    // Crop handle drag → adjust cropHeight live
    canvas.querySelectorAll(".b-image-crop-handle").forEach((handle) => {
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const blockEl = handle.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (!block) return;
        const container = blockEl.querySelector(".b-image-crop-container");
        const img = blockEl.querySelector(".b-image-preview");
        const cropInput = blockEl.querySelector(".b-image-crop-input");
        const startY = e.clientY;
        const startHeight = block.data.cropHeight || container.offsetHeight;

        blockEl.setAttribute("draggable", "false");

        function onMouseMove(ev) {
          const delta = ev.clientY - startY;
          const newHeight = Math.max(40, Math.round(startHeight + delta));
          block.data.cropHeight = newHeight;
          container.style.height = newHeight + "px";
          container.style.overflow = "hidden";
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          img.style.objectPosition = "center " + block.data.objectPosition + "%";
          if (cropInput) cropInput.value = newHeight;
        }

        function onMouseUp() {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          blockEl.setAttribute("draggable", "true");
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });

    // Crop height number input → update container live
    canvas.querySelectorAll(".b-image-crop-input").forEach((input) => {
      input.addEventListener("input", () => {
        const blockEl = input.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (!block) return;
        const val = parseInt(input.value, 10) || 0;
        block.data.cropHeight = val;
        const container = blockEl.querySelector(".b-image-crop-container");
        const img = blockEl.querySelector(".b-image-preview");
        if (val > 0) {
          container.style.height = val + "px";
          container.style.overflow = "hidden";
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          img.style.objectPosition = "center " + block.data.objectPosition + "%";
        } else {
          container.style.height = "";
          container.style.overflow = "";
          img.style.width = "100%";
          img.style.height = "";
          img.style.objectFit = "";
          img.style.objectPosition = "";
        }
      });
    });

    // Position range slider → update object-position live
    canvas.querySelectorAll(".b-image-range").forEach((input) => {
      input.addEventListener("input", () => {
        const blockEl = input.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (!block) return;
        const val = parseInt(input.value, 10);
        block.data.objectPosition = val;
        const img = blockEl.querySelector(".b-image-preview");
        if (img && block.data.cropHeight > 0) {
          img.style.objectPosition = "center " + val + "%";
        }
      });
    });

    // Image load → capture natural dimensions
    canvas.querySelectorAll(".b-image-preview").forEach((img) => {
      img.addEventListener("load", () => {
        const blockEl = img.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (block) {
          block.data.naturalWidth = img.naturalWidth;
          block.data.naturalHeight = img.naturalHeight;
        }
      });
      // Handle already-cached images
      if (img.complete && img.naturalWidth) {
        const blockEl = img.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (block) {
          block.data.naturalWidth = img.naturalWidth;
          block.data.naturalHeight = img.naturalHeight;
        }
      }
    });

    // ── Side-image handlers (text / quote blocks) ──────
    canvas.querySelectorAll(".b-side-image-radius-btn").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        btn.closest(".block").setAttribute("draggable", "false");
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        btn.closest(".block").setAttribute("draggable", "true");
        const blockEl = btn.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (!block) return;
        block.data.sideImageRound = !block.data.sideImageRound;
        render();
      });
    });

    canvas.querySelectorAll(".b-side-image-remove-btn").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        btn.closest(".block").setAttribute("draggable", "false");
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        btn.closest(".block").setAttribute("draggable", "true");
        const blockEl = btn.closest(".block");
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (!block) return;
        block.data.sideImage = "";
        block.data.sideImageRound = false;
        render();
      });
    });

    // Drag & Drop
    canvas.querySelectorAll(".block").forEach((el) => {
      el.addEventListener("dragstart", onDragStart);
      el.addEventListener("dragend", onDragEnd);
      el.addEventListener("dragover", onDragOver);
      el.addEventListener("dragleave", onDragLeave);
      el.addEventListener("drop", onDrop);
    });

    // Prevent contenteditable from triggering drag
    canvas.querySelectorAll("[contenteditable]").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        el.closest(".block").setAttribute("draggable", "false");
      });
      el.addEventListener("blur", () => {
        el.closest(".block").setAttribute("draggable", "true");
      });
    });
    canvas.querySelectorAll("input").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        el.closest(".block").setAttribute("draggable", "false");
      });
      el.addEventListener("blur", () => {
        el.closest(".block").setAttribute("draggable", "true");
      });
    });
  }

  // ─── Track cursor position in contenteditable fields ──
  // Saved on every selection change so we can restore it
  // when the user clicks an icon in the sidebar picker.
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const anchor = sel.anchorNode;
    if (!anchor) return;
    const el = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    const field = el && el.closest ? el.closest('[contenteditable="true"]') : null;
    if (field && canvas.contains(field)) {
      lastRange = sel.getRangeAt(0).cloneRange();
      lastEditableField = field;
    }
    updateFormatToolbar();
  });

  // ─── Format Toolbar: show/hide + positioning ────────
  function updateFormatToolbar() {
    // Don't hide toolbar while link popover or size menu is open
    if (linkPopover.style.display !== "none" || formatSizeMenu.style.display !== "none") {
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hideFormatToolbar();
      return;
    }
    const anchor = sel.anchorNode;
    if (!anchor) { hideFormatToolbar(); return; }
    const el = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    const field = el && el.closest ? el.closest('[contenteditable="true"]') : null;
    if (!field || !canvas.contains(field)) {
      hideFormatToolbar();
      return;
    }
    // Position toolbar centered above selection
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { hideFormatToolbar(); return; }

    formatToolbar.style.display = "flex";
    const tbRect = formatToolbar.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - (tbRect.width / 2);
    let top = rect.top - tbRect.height - 8;
    // Flip below if near top edge
    if (top < 4) {
      top = rect.bottom + 8;
    }
    // Clamp horizontal
    if (left < 4) left = 4;
    if (left + tbRect.width > window.innerWidth - 4) left = window.innerWidth - tbRect.width - 4;

    formatToolbar.style.left = left + "px";
    formatToolbar.style.top = top + "px";

    updateFormatButtonStates();
  }

  function hideFormatToolbar() {
    formatToolbar.style.display = "none";
    formatSizeMenu.style.display = "none";
    hideLinkPopover();
  }

  function hideLinkPopover() {
    linkPopover.style.display = "none";
  }

  function updateFormatButtonStates() {
    formatToolbar.querySelectorAll("button[data-command]").forEach((btn) => {
      const cmd = btn.dataset.command;
      if (cmd === "link") {
        // Check if inside an <a> tag
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const node = sel.anchorNode;
          const el = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
          btn.classList.toggle("active", !!(el && el.closest("a")));
        }
      } else {
        try {
          btn.classList.toggle("active", document.queryCommandState(cmd));
        } catch (_) {
          btn.classList.remove("active");
        }
      }
    });

    // Update size label
    try {
      const val = document.queryCommandValue("fontSize");
      formatSizeLabel.textContent = SIZE_LABELS[val] || "Normal";
      // Highlight active option in menu
      formatSizeMenu.querySelectorAll(".format-size-option").forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.size === (val || "3"));
      });
    } catch (_) {
      formatSizeLabel.textContent = "Normal";
    }
  }

  // ─── Format Toolbar: button click handlers ──────────
  formatToolbar.querySelectorAll("button[data-command]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault(); // preserve selection
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const cmd = btn.dataset.command;
      if (cmd === "link") {
        handleLinkFormat();
      } else {
        document.execCommand(cmd, false, null);
        updateFormatButtonStates();
      }
    });
  });

  // ─── Size dropdown logic ──────────────────────────────
  formatSizeBtn.addEventListener("mousedown", (e) => {
    e.preventDefault(); // preserve selection
  });
  formatSizeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const isOpen = formatSizeMenu.style.display !== "none";
    formatSizeMenu.style.display = isOpen ? "none" : "block";
  });

  formatSizeMenu.querySelectorAll(".format-size-option").forEach((opt) => {
    opt.addEventListener("mousedown", (e) => {
      e.preventDefault(); // preserve selection
    });
    opt.addEventListener("click", (e) => {
      e.preventDefault();
      const size = opt.dataset.size;
      if (size === "3") {
        // "Normal" — remove font size formatting
        document.execCommand("removeFormat", false, null);
      } else {
        document.execCommand("fontSize", false, size);
      }
      formatSizeMenu.style.display = "none";
      updateFormatButtonStates();
    });
  });

  // Close size menu when clicking outside
  document.addEventListener("mousedown", (e) => {
    if (formatSizeMenu.style.display !== "none" &&
        !formatSizeBtn.contains(e.target) &&
        !formatSizeMenu.contains(e.target)) {
      formatSizeMenu.style.display = "none";
    }
  });

  // ─── Link popover logic ─────────────────────────────
  function handleLinkFormat() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    // Save current selection
    savedSelectionRange = sel.getRangeAt(0).cloneRange();

    // Check if inside an existing <a>
    const node = sel.anchorNode;
    const el = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
    const existingLink = el && el.closest("a");

    linkPopoverInput.value = existingLink ? existingLink.href : "https://";
    linkPopoverRemove.style.display = existingLink ? "" : "none";

    // Position below toolbar
    const tbRect = formatToolbar.getBoundingClientRect();
    linkPopover.style.display = "flex";
    const lpRect = linkPopover.getBoundingClientRect();
    let left = tbRect.left + (tbRect.width / 2) - (lpRect.width / 2);
    let top = tbRect.bottom + 6;
    if (left < 4) left = 4;
    if (left + lpRect.width > window.innerWidth - 4) left = window.innerWidth - lpRect.width - 4;
    linkPopover.style.left = left + "px";
    linkPopover.style.top = top + "px";

    linkPopoverInput.focus();
    linkPopoverInput.select();
  }

  function applyLink() {
    const url = linkPopoverInput.value.trim();
    if (!url) return;

    // Restore saved selection
    if (savedSelectionRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelectionRange);
    }

    document.execCommand("createLink", false, url);

    // Set target="_blank" on newly created link
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const node = sel.anchorNode;
      const el = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
      const link = el && el.closest("a");
      if (link) link.setAttribute("target", "_blank");
    }

    hideLinkPopover();
    savedSelectionRange = null;
  }

  function removeLink() {
    // Restore saved selection
    if (savedSelectionRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelectionRange);
    }
    document.execCommand("unlink", false, null);
    hideLinkPopover();
    savedSelectionRange = null;
  }

  linkPopoverApply.addEventListener("mousedown", (e) => e.preventDefault());
  linkPopoverApply.addEventListener("click", applyLink);

  linkPopoverRemove.addEventListener("mousedown", (e) => e.preventDefault());
  linkPopoverRemove.addEventListener("click", removeLink);

  linkPopoverInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyLink();
    } else if (e.key === "Escape") {
      e.preventDefault();
      hideLinkPopover();
    }
  });

  // Hide link popover when clicking outside
  document.addEventListener("mousedown", (e) => {
    if (linkPopover.style.display !== "none" &&
        !linkPopover.contains(e.target) &&
        !formatToolbar.contains(e.target)) {
      hideLinkPopover();
    }
  });

  // ─── Toolbar actions ──────────────────────────────────
  function handleToolbarAction(id, action) {
    syncAllData();
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;

    switch (action) {
      case "up":
        if (idx > 0) {
          [blocks[idx - 1], blocks[idx]] = [blocks[idx], blocks[idx - 1]];
        }
        break;
      case "down":
        if (idx < blocks.length - 1) {
          [blocks[idx], blocks[idx + 1]] = [blocks[idx + 1], blocks[idx]];
        }
        break;
      case "dup":
        const clone = JSON.parse(JSON.stringify(blocks[idx]));
        clone.id = uid();
        blocks.splice(idx + 1, 0, clone);
        selectedId = clone.id;
        break;
      case "del":
        blocks.splice(idx, 1);
        if (selectedId === id) selectedId = null;
        break;
      case "side-image": {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.addEventListener("change", () => {
          const file = input.files[0];
          if (!file) return;
          readFileAsDataURL(file).then((dataUrl) => {
            const block = blocks.find((b) => b.id === id);
            if (!block) return;
            block.data.sideImage = dataUrl;
            render();
          });
        });
        input.click();
        return; // async — don't call render() synchronously
      }
    }
    render();
  }

  // ─── Drag & Drop handlers ─────────────────────────────
  function onDragStart(e) {
    dragId = this.dataset.id;
    this.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnd() {
    this.classList.remove("dragging");
    clearDragIndicators();
    dragId = null;
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (this.dataset.id === dragId) return;

    clearDragIndicators();
    const rect = this.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (e.clientY < mid) {
      this.classList.add("drag-over-top");
    } else {
      this.classList.add("drag-over-bottom");
    }
  }

  function onDragLeave() {
    this.classList.remove("drag-over-top", "drag-over-bottom");
  }

  function onDrop(e) {
    e.preventDefault();
    if (!dragId || this.dataset.id === dragId) return;

    syncAllData();
    const fromIdx = blocks.findIndex((b) => b.id === dragId);
    const toIdx = blocks.findIndex((b) => b.id === this.dataset.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const rect = this.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const insertAfter = e.clientY >= mid;

    const [moved] = blocks.splice(fromIdx, 1);
    let newIdx = blocks.findIndex((b) => b.id === this.dataset.id);
    if (insertAfter) newIdx++;
    blocks.splice(newIdx, 0, moved);

    clearDragIndicators();
    render();
  }

  function clearDragIndicators() {
    canvas.querySelectorAll(".drag-over-top, .drag-over-bottom").forEach((el) => {
      el.classList.remove("drag-over-top", "drag-over-bottom");
    });
  }

  // ─── Palette click → add block ────────────────────────
  document.querySelectorAll(".palette-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncAllData();
      const type = btn.dataset.type;
      const block = createBlock(type);
      blocks.push(block);
      selectedId = block.id;
      render();
      // Scroll to bottom
      const wrap = document.querySelector(".canvas-wrap");
      wrap.scrollTop = wrap.scrollHeight;
    });
  });

  // ─── Deselect on canvas background click ──────────────
  canvas.addEventListener("mousedown", (e) => {
    if (e.target === canvas) {
      selectedId = null;
      canvas.querySelectorAll(".block").forEach((b) => b.classList.remove("selected"));
    }
  });

  // ─── Keyboard shortcut: Delete/Backspace to remove ────
  document.addEventListener("keydown", (e) => {
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      selectedId &&
      !document.activeElement.closest("[contenteditable]") &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA"
    ) {
      syncAllData();
      blocks = blocks.filter((b) => b.id !== selectedId);
      selectedId = null;
      render();
    }

    // Ctrl/Cmd+K → open link popover
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      const active = document.activeElement;
      if (active && active.isContentEditable && canvas.contains(active)) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          e.preventDefault();
          handleLinkFormat();
        }
      }
    }
  });

  // ─── Image utilities ─────────────────────────────────

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function applyImageToBlock(block, dataUrl) {
    block.data.url = dataUrl;
    block.data.cropHeight = 0;
    block.data.objectPosition = 50;
    block.data.naturalWidth = 0;
    block.data.naturalHeight = 0;
    render();
  }

  // ─── Canvas-based image cropping for export ─────────

  function cropImageViaCanvas(dataUrl, cropHeight, objectPosition, natW, natH) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const editorW = 560; // canvas 640 − 40*2 padding

        // object-fit:cover scale
        const scaleW = editorW / natW;
        const scaleH = cropHeight / natH;
        const scale = Math.max(scaleW, scaleH);

        const scaledW = natW * scale;
        const scaledH = natH * scale;

        // object-position offsets
        const offsetX = (scaledW - editorW) * 0.5;
        const offsetY = (scaledH - cropHeight) * (objectPosition / 100);

        // Source rect in natural coordinates
        const srcX = offsetX / scale;
        const srcY = offsetY / scale;
        const srcW = editorW / scale;
        const srcH = cropHeight / scale;

        // Output at native source resolution (no downscale — just crop)
        const outW = Math.round(srcW);
        const outH = Math.round(srcH);

        const cvs = document.createElement("canvas");
        cvs.width = outW;
        cvs.height = outH;
        const ctx = cvs.getContext("2d");
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

        resolve(cvs.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = () => reject(new Error("Failed to load image for cropping"));
      img.src = dataUrl;
    });
  }

  function cropSideImage(dataUrl, isRound) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = 120;
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;

        // Center-crop to square (object-fit:cover logic)
        const scale = Math.max(size / natW, size / natH);
        const srcW = size / scale;
        const srcH = size / scale;
        const srcX = (natW - srcW) / 2;
        const srcY = (natH - srcH) / 2;

        const cvs = document.createElement("canvas");
        cvs.width = size;
        cvs.height = size;
        const ctx = cvs.getContext("2d");

        if (isRound) {
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
        }

        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, size, size);
        resolve(cvs.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load side image for cropping"));
      img.src = dataUrl;
    });
  }

  async function prepareExport() {
    const promises = blocks.map(async (block) => {
      if (block.type === "image") {
        delete block.data._exportSrc;
        const d = block.data;
        if (d.cropHeight > 0 && d.url && d.url.startsWith("data:") && d.naturalWidth && d.naturalHeight) {
          try {
            d._exportSrc = await cropImageViaCanvas(
              d.url, d.cropHeight, d.objectPosition,
              d.naturalWidth, d.naturalHeight
            );
          } catch (e) {
            console.warn("Image crop failed for block " + block.id, e);
          }
        }
      }
      if ((block.type === "text" || block.type === "quote") && block.data.sideImage) {
        delete block.data._exportSideImage;
        try {
          block.data._exportSideImage = await cropSideImage(
            block.data.sideImage, block.data.sideImageRound
          );
        } catch (e) {
          console.warn("Side image crop failed for block " + block.id, e);
        }
      }
    });
    await Promise.all(promises);
  }

  // ═══════════════════════════════════════════════════════
  //  EXPORT — Generate Outlook-compatible HTML
  // ═══════════════════════════════════════════════════════

  const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const MSO_FIX = "mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse;";

  function generateHTML() {
    syncAllData();

    const bodyRows = blocks.map((b) => exportBlock(b)).join("\n");

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <title>Newsletter</title>
</head>
<body style="margin:0; padding:0; font-family:${FONT} !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${MSO_FIX}">
    <tr>
      <td align="center" valign="top">

        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center">
        <tr>
        <td>
        <![endif]-->

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; width:100%; ${MSO_FIX} background-color:#ffffff;">
${bodyRows}
        </table>

        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->

      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ─── Export individual blocks ──────────────────────────
  // Uses exportRichText() for contenteditable field data,
  // which converts inline Phosphor <i> tags to <img> for email.
  function exportBlock(block) {
    const d = block.data;
    switch (block.type) {
      case "header":
        return `
          <!-- HEADER -->
          <tr>
            <td style="padding:32px 40px 28px 40px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
              <h1 style="margin:0 0 8px 0; font-family:${FONT} !important; font-size:28px; font-weight:300; color:#000000; line-height:34px; mso-line-height-rule:exactly;">${exportRichText(d.title, 28)}</h1>
              <p style="margin:0; font-family:${FONT} !important; font-size:13px; color:#666666; line-height:18px; mso-line-height-rule:exactly;">${exportRichText(d.date, 13)}</p>
            </td>
          </tr>`;

      case "text":
        if (d.sideImage) {
          const sideImgSrc = d._exportSideImage || d.sideImage;
          return `
          <!-- TEXT BLOCK (with side image) -->
          <tr>
            <td style="padding:24px 40px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${MSO_FIX}">
                <tr>
                  <td width="120" valign="top" style="width:120px; padding-right:20px;">
                    <img src="${escAttr(sideImgSrc)}" alt="" width="120" height="120" style="display:block; width:120px; height:120px;" />
                  </td>
                  <td valign="top" style="font-family:${FONT} !important; mso-line-height-rule:exactly;">
                    <p style="margin:0; font-family:${FONT} !important; font-size:15px; color:#333333; line-height:25px; mso-line-height-rule:exactly;">${exportRichText(d.body, 15)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
        }
        return `
          <!-- TEXT BLOCK -->
          <tr>
            <td style="padding:24px 40px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
              <p style="margin:0; font-family:${FONT} !important; font-size:15px; color:#333333; line-height:25px; mso-line-height-rule:exactly;">${exportRichText(d.body, 15)}</p>
            </td>
          </tr>`;

      case "heading":
        return `
          <!-- HEADING -->
          <tr>
            <td style="padding:24px 40px 8px 40px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
              <h2 style="margin:0; font-family:${FONT} !important; font-size:22px; font-weight:600; color:#000000; line-height:28px; mso-line-height-rule:exactly;">${exportRichText(d.text, 22)}</h2>
            </td>
          </tr>`;

      case "divider":
        return `
          <!-- DIVIDER -->
          <tr>
            <td style="padding:8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${MSO_FIX}">
                <tr>
                  <td bgcolor="#cccccc" height="1" width="100%" style="background-color:#cccccc; height:1px; width:100%; line-height:1px; font-size:1px; mso-line-height-rule:exactly;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>`;

      case "spacer":
        return `
          <!-- SPACER -->
          <tr>
            <td style="font-size:1px; line-height:${d.height}px; height:${d.height}px; mso-line-height-rule:exactly;">&nbsp;</td>
          </tr>`;

      case "image": {
        const imgSrc = d._exportSrc || d.url;
        let imgRow = "";
        if (imgSrc) {
          let heightAttr = "";
          if (d._exportSrc && d.cropHeight > 0 && d.naturalWidth && d.naturalHeight) {
            const editorW = 560, emailW = 520;
            const scaleW = editorW / d.naturalWidth;
            const scaleH = d.cropHeight / d.naturalHeight;
            const scale = Math.max(scaleW, scaleH);
            const srcW = editorW / scale;
            const srcH = d.cropHeight / scale;
            const outH = Math.round(emailW * srcH / srcW);
            heightAttr = ` height="${outH}"`;
          }
          imgRow = `<img src="${escAttr(imgSrc)}" alt="" width="520"${heightAttr} style="display:block; width:100%; max-width:520px; height:auto; border:0;" />`;
          if (imgSrc.length > 200 * 1024) {
            imgRow = `<!-- WARNING: Embedded image exceeds 200KB (${Math.round(imgSrc.length / 1024)}KB). Consider using an external URL. -->\n              ${imgRow}`;
          }
          if (d.cropHeight > 0 && d.url && !d.url.startsWith("data:") && !d._exportSrc) {
            imgRow = `<!-- NOTE: External URL image exported uncropped (CORS prevents canvas cropping). -->\n              ${imgRow}`;
          }
        }
        const captionRow = d.caption
          ? `<p style="margin:8px 0 0 0; font-family:${FONT} !important; font-size:12px; color:#666666; line-height:18px; font-style:italic; mso-line-height-rule:exactly;">${exportRichText(d.caption, 12)}</p>`
          : "";
        return `
          <!-- IMAGE -->
          <tr>
            <td style="padding:24px 40px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
              ${imgRow}
              ${captionRow}
            </td>
          </tr>`;
      }

      case "twocol":
        return `
          <!-- TWO COLUMNS -->
          <tr>
            <td style="padding:24px 30px;">
              <!--[if mso]>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="540" align="center">
              <tr>
              <td width="255" valign="top">
              <![endif]-->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="255" align="left" style="${MSO_FIX}">
                <tr>
                  <td valign="top" style="padding:10px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
                    <h3 style="margin:0 0 8px 0; font-family:${FONT} !important; font-size:17px; font-weight:600; color:#000000; line-height:22px; mso-line-height-rule:exactly;">${exportRichText(d.leftHeading, 17)}</h3>
                    <p style="margin:0; font-family:${FONT} !important; font-size:14px; color:#333333; line-height:22px; mso-line-height-rule:exactly;">${exportRichText(d.leftBody, 14)}</p>
                  </td>
                </tr>
              </table>
              <!--[if mso]>
              </td>
              <td width="30" style="font-size:1px; line-height:1px;">&nbsp;</td>
              <td width="255" valign="top">
              <![endif]-->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="255" align="right" style="${MSO_FIX}">
                <tr>
                  <td valign="top" style="padding:10px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
                    <h3 style="margin:0 0 8px 0; font-family:${FONT} !important; font-size:17px; font-weight:600; color:#000000; line-height:22px; mso-line-height-rule:exactly;">${exportRichText(d.rightHeading, 17)}</h3>
                    <p style="margin:0; font-family:${FONT} !important; font-size:14px; color:#333333; line-height:22px; mso-line-height-rule:exactly;">${exportRichText(d.rightBody, 14)}</p>
                  </td>
                </tr>
              </table>
              <!--[if mso]>
              </td>
              </tr>
              </table>
              <![endif]-->
            </td>
          </tr>
          <!-- Spacer for clearing floats -->
          <tr>
            <td style="font-size:1px; line-height:1px; mso-line-height-rule:exactly;">&nbsp;</td>
          </tr>`;

      case "event":
        return `
          <!-- EVENT -->
          <tr>
            <td style="padding:20px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${MSO_FIX}">
                <tr>
                  <td width="64" valign="top" align="center" style="width:64px; border-width:2px; border-style:solid; border-color:#000000; padding:8px 4px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
                    <p style="margin:0; font-family:${FONT} !important; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#000000; line-height:14px; mso-line-height-rule:exactly;">${exportRichText(d.month, 11)}</p>
                    <p style="margin:0; font-family:${FONT} !important; font-size:28px; font-weight:300; color:#000000; line-height:32px; mso-line-height-rule:exactly;">${exportRichText(d.day, 28)}</p>
                  </td>
                  <td valign="top" style="padding-left:20px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
                    <h3 style="margin:0 0 6px 0; font-family:${FONT} !important; font-size:17px; font-weight:600; color:#000000; line-height:22px; mso-line-height-rule:exactly;">${exportRichText(d.title, 17)}</h3>
                    <p style="margin:0; font-family:${FONT} !important; font-size:14px; color:#333333; line-height:22px; mso-line-height-rule:exactly;">${exportRichText(d.desc, 14)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

      case "quote":
        if (d.sideImage) {
          const sideImgSrc = d._exportSideImage || d.sideImage;
          return `
          <!-- QUOTE (with side image) -->
          <tr>
            <td style="padding:20px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${MSO_FIX}">
                <tr>
                  <td width="120" valign="top" style="width:120px; padding-right:20px;">
                    <img src="${escAttr(sideImgSrc)}" alt="" width="120" height="120" style="display:block; width:120px; height:120px;" />
                  </td>
                  <td valign="top">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${MSO_FIX}">
                      <tr>
                        <td width="3" style="background-color:#000000; width:3px; font-size:1px; line-height:1px; mso-line-height-rule:exactly;">&nbsp;</td>
                        <td style="padding:12px 20px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
                          <p style="margin:0; font-family:${FONT} !important; font-size:16px; color:#333333; line-height:26px; font-style:italic; mso-line-height-rule:exactly;">${exportRichText(d.text, 16)}</p>
                          <p style="margin:8px 0 0 0; font-family:${FONT} !important; font-size:13px; color:#666666; line-height:18px; mso-line-height-rule:exactly;">${exportRichText(d.attribution, 13)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
        }
        return `
          <!-- QUOTE -->
          <tr>
            <td style="padding:20px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${MSO_FIX}">
                <tr>
                  <td width="3" style="background-color:#000000; width:3px; font-size:1px; line-height:1px; mso-line-height-rule:exactly;">&nbsp;</td>
                  <td style="padding:12px 20px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
                    <p style="margin:0; font-family:${FONT} !important; font-size:16px; color:#333333; line-height:26px; font-style:italic; mso-line-height-rule:exactly;">${exportRichText(d.text, 16)}</p>
                    <p style="margin:8px 0 0 0; font-family:${FONT} !important; font-size:13px; color:#666666; line-height:18px; mso-line-height-rule:exactly;">${exportRichText(d.attribution, 13)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

      case "button":
        return `
          <!-- BUTTON -->
          <tr>
            <td align="center" style="padding:20px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${MSO_FIX}">
                <tr>
                  <td align="center" style="background-color:#000000; padding:12px 32px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
                    <a href="${escAttr(d.url)}" target="_blank" style="font-family:${FONT} !important; font-size:14px; font-weight:500; color:#ffffff; text-decoration:none; letter-spacing:0.5px; mso-line-height-rule:exactly;">${exportRichText(d.label, 14)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

      case "icon": {
        const imgSize = d.size || 32;
        // Use weserv.nl proxy to convert SVG to PNG for email client compatibility
        const pngUrl = "https://images.weserv.nl/?url=cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/duotone/" + encodeURIComponent(d.name) + "-duotone.svg&output=png";
        const labelHtml = d.label
          ? `\n              <p style="margin:8px 0 0 0; font-family:${FONT} !important; font-size:13px; color:#333333; line-height:18px; mso-line-height-rule:exactly;">${exportRichText(d.label, 13)}</p>`
          : "";
        return `
          <!-- ICON: ${esc(d.name)} -->
          <tr>
            <td align="center" style="padding:20px 40px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
              <img src="${pngUrl}" width="${imgSize}" height="${imgSize}" alt="${esc(d.name)}" style="display:block; width:${imgSize}px; height:${imgSize}px;" />${labelHtml}
            </td>
          </tr>`;
      }

      case "footer":
        return `
          <!-- FOOTER -->
          <tr>
            <td style="padding:28px 40px; font-family:${FONT} !important; mso-line-height-rule:exactly;">
              <p style="margin:0 0 8px 0; font-family:${FONT} !important; font-size:13px; font-weight:700; color:#000000; letter-spacing:1px; line-height:18px; mso-line-height-rule:exactly;">${exportRichText(d.org, 13)}</p>
              <p style="margin:0; font-family:${FONT} !important; font-size:12px; color:#666666; line-height:20px; mso-line-height-rule:exactly;">${exportRichText(d.details, 12)}</p>
            </td>
          </tr>`;

      default:
        return "";
    }
  }

  // ─── Utility: HTML sanitizer for contenteditable ──────
  // Walks the DOM tree and keeps only:
  //   - Text nodes (escaped)
  //   - <br> elements
  //   - Phosphor icon <i class="ph ph-*"> elements
  // Everything else is stripped (children preserved).
  function sanitizeHtml(html) {
    if (!html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    let result = "";

    function walk(node) {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          result += esc(child.textContent);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase();
          if (tag === "br") {
            result += "<br>";
          } else if (tag === "div" || tag === "p") {
            // Browsers wrap new lines in <div> or <p> — convert to <br>
            if (result.length > 0 && !result.endsWith("<br>")) {
              result += "<br>";
            }
            walk(child);
          } else if (tag === "i" && isPhosphorIcon(child)) {
            // Phosphor icon — preserve (checked before italic <i>)
            const classes = [...child.classList].filter(
              (c) => c === "ph" || c.startsWith("ph-")
            );
            result += '<i class="' + classes.join(" ") + '"></i>';
          } else if (tag === "b" || tag === "strong") {
            result += "<b>";
            walk(child);
            result += "</b>";
          } else if (tag === "i" || tag === "em") {
            result += "<i>";
            walk(child);
            result += "</i>";
          } else if (tag === "u") {
            result += "<u>";
            walk(child);
            result += "</u>";
          } else if (tag === "s" || tag === "strike") {
            result += "<s>";
            walk(child);
            result += "</s>";
          } else if (tag === "a") {
            const href = child.getAttribute("href") || "";
            result += '<a href="' + escAttr(href) + '">';
            walk(child);
            result += "</a>";
          } else if (tag === "font" && child.getAttribute("size")) {
            const size = child.getAttribute("size");
            result += '<font size="' + escAttr(size) + '">';
            walk(child);
            result += "</font>";
          } else {
            // Strip tag, keep children
            walk(child);
          }
        }
      }
    }

    walk(tmp);
    // Trim leading/trailing <br>
    result = result.replace(/^(<br>)+/, "").replace(/(<br>)+$/, "");
    return result;
  }

  function isPhosphorIcon(el) {
    return (
      el.classList.contains("ph") &&
      [...el.classList].some((c) => c.startsWith("ph-") && c !== "ph")
    );
  }

  // ─── Utility: Convert rich text HTML for email export ─
  // Converts inline Phosphor <i> tags to <img> tags pointing
  // to the CDN SVG. Normalizes <br> to <br />.
  function exportRichText(html, fontSize) {
    if (!html) return "";
    var iconSize = Math.round((fontSize || 15) * 1.15);
    return html
      .replace(/<i class="ph ph-([\w-]+)"><\/i>/g, function (match, name) {
        // Use weserv.nl proxy to convert SVG to PNG for email client compatibility
        var pngUrl =
          "https://images.weserv.nl/?url=cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/duotone/" +
          encodeURIComponent(name) +
          "-duotone.svg&output=png";
        return (
          '<img src="' +
          pngUrl +
          '" width="' + iconSize + '" height="' + iconSize + '" alt="' +
          esc(name) +
          '" style="display:inline; vertical-align:-0.125em; width:' + iconSize + 'px; height:' + iconSize + 'px; margin:0 1px;" />'
        );
      })
      .replace(/<font size="(\d)">([\s\S]*?)<\/font>/g, function (match, size, inner) {
        var px = {"1":10,"2":13,"3":16,"4":18,"5":24,"6":32}[size] || 16;
        return '<span style="font-size:' + px + 'px;">' + inner + '</span>';
      })
      .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/g, '<a href="$1" target="_blank" style="color:#0066cc; text-decoration:underline;"><span>$2</span></a>')
      .replace(/<br>/g, "<br />");
  }

  // ─── Utility: HTML escape ─────────────────────────────
  function esc(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(str) {
    return esc(str);
  }

  // ─── Export actions ───────────────────────────────────
  // Preview in new tab
  document.getElementById("btn-preview").addEventListener("click", async () => {
    await prepareExport();
    const html = generateHTML();
    blocks.forEach((b) => { delete b.data._exportSrc; delete b.data._exportSideImage; });
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  });

  // Copy HTML to clipboard
  document.getElementById("btn-copy").addEventListener("click", async () => {
    await prepareExport();
    const html = generateHTML();
    blocks.forEach((b) => { delete b.data._exportSrc; delete b.data._exportSideImage; });
    navigator.clipboard.writeText(html).then(() => {
      showToast("HTML copied to clipboard");
    });
  });

  // Download .html file
  document.getElementById("btn-download").addEventListener("click", async () => {
    await prepareExport();
    const html = generateHTML();
    blocks.forEach((b) => { delete b.data._exportSrc; delete b.data._exportSideImage; });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "newsletter.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded newsletter.html");
  });

  // Modal
  document.getElementById("modal-close").addEventListener("click", () => {
    document.getElementById("modal-overlay").classList.add("hidden");
  });
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.add("hidden");
    }
  });
  document.getElementById("modal-copy").addEventListener("click", () => {
    const code = document.getElementById("modal-code").value;
    navigator.clipboard.writeText(code).then(() => {
      showToast("HTML copied to clipboard");
    });
  });

  // Toast
  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    t.classList.add("visible");
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => {
      t.classList.remove("visible");
      setTimeout(() => t.classList.add("hidden"), 300);
    }, 2000);
  }

  // ═══════════════════════════════════════════════════════
  //  ICON PICKER
  //  Uses the official Phosphor Icons API for catalog data
  //  and the @phosphor-icons/web icon font for display.
  // ═══════════════════════════════════════════════════════

  let allIcons = [];       // Array of { name, tags, category }
  let allIconNames = [];   // Just name strings, for quick rendering
  let iconPickerReady = false;

  // ── Tab switching ──────────────────────────────────────
  document.querySelectorAll(".sidebar-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const panel = tab.dataset.panel;
      document.querySelectorAll(".sidebar-panel").forEach((p) => p.classList.add("hidden"));
      document.getElementById("panel-" + panel).classList.remove("hidden");

      if (panel === "icons" && !iconPickerReady) {
        loadIcons();
      }
    });
  });

  // ── Load icon catalog ─────────────────────────────────
  async function loadIcons() {
    const status = document.getElementById("icon-status");
    status.textContent = "Loading icons\u2026";

    // Strategy 1: Official Phosphor API (full metadata with tags + categories)
    try {
      const res = await fetch("https://api.phosphoricons.com/v1/icons?published=true");
      if (!res.ok) throw new Error("API " + res.status);
      const data = await res.json();
      const list = data.icons || data;
      allIcons = list.map((ic) => ({
        name: ic.name,
        tags: (ic.tags || []).map((t) => t.toLowerCase()),
        category: (ic.category || "").toLowerCase(),
      }));
      allIcons.sort((a, b) => a.name.localeCompare(b.name));
      allIconNames = allIcons.map((ic) => ic.name);
      iconPickerReady = true;
      renderIconGrid(allIcons);
      status.textContent = allIcons.length + " icons available";
      return;
    } catch (_) {
      // API failed, try fallback
    }

    // Strategy 2: Parse icon names from the CDN stylesheet
    try {
      status.textContent = "Loading icons (fallback)\u2026";
      const res = await fetch(
        "https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/regular/style.css"
      );
      const css = await res.text();
      const names = new Set();
      const re = /\.ph\.ph-([\w-]+):before/g;
      let m;
      while ((m = re.exec(css)) !== null) {
        names.add(m[1]);
      }
      allIcons = [...names].sort().map((n) => ({ name: n, tags: [], category: "" }));
      allIconNames = allIcons.map((ic) => ic.name);
      iconPickerReady = true;
      renderIconGrid(allIcons);
      status.textContent = allIcons.length + " icons (tags unavailable)";
    } catch (e) {
      status.textContent = "Failed to load icons. Check your connection.";
    }
  }

  // ── Render icon grid ──────────────────────────────────
  function renderIconGrid(icons) {
    const grid = document.getElementById("icon-grid");
    const LIMIT = 200;
    const shown = icons.slice(0, LIMIT);

    grid.innerHTML = shown
      .map(
        (ic) =>
          `<button class="icon-grid-item" data-name="${ic.name}" title="${ic.name}${ic.category ? " \u2014 " + ic.category : ""}">` +
          `<i class="ph ph-${ic.name}"></i>` +
          `</button>`
      )
      .join("");

    const status = document.getElementById("icon-status");
    if (icons.length === 0) {
      status.textContent = "No icons match your search";
    } else if (icons.length > LIMIT) {
      status.textContent = "Showing " + LIMIT + " of " + icons.length + " \u2014 refine your search";
    } else {
      status.textContent = icons.length + " icon" + (icons.length !== 1 ? "s" : "");
    }

    // Bind mousedown (not click) to prevent focus loss from contenteditable
    grid.querySelectorAll(".icon-grid-item").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Keep focus in contenteditable if active
        insertIcon(btn.dataset.name);
      });
    });
  }

  // ── Insert icon: inline at cursor or as standalone block ──
  function insertIcon(name) {
    const size = parseInt(document.getElementById("icon-size").value) || 32;
    const iconHtml = '<i class="ph ph-' + name + '"></i>';

    // Strategy 1: Insert inline if a contenteditable field in the canvas is focused
    const activeEl = document.activeElement;
    if (activeEl && activeEl.isContentEditable && canvas.contains(activeEl)) {
      document.execCommand("insertHTML", false, iconHtml);
      // Sync the parent block's data
      const blockEl = activeEl.closest(".block");
      if (blockEl) {
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (block) syncBlockData(blockEl, block);
      }
      showToast("Inserted " + name + " icon");
      return;
    }

    // Strategy 2: Restore saved cursor position from before sidebar interaction
    if (lastEditableField && canvas.contains(lastEditableField)) {
      lastEditableField.focus();
      const sel = window.getSelection();
      if (lastRange) {
        sel.removeAllRanges();
        sel.addRange(lastRange);
      }
      document.execCommand("insertHTML", false, iconHtml);
      // Sync the parent block's data
      const blockEl = lastEditableField.closest(".block");
      if (blockEl) {
        const block = blocks.find((b) => b.id === blockEl.dataset.id);
        if (block) syncBlockData(blockEl, block);
      }
      showToast("Inserted " + name + " icon");
      return;
    }

    // Strategy 3: Update currently selected icon block
    syncAllData();
    if (selectedId) {
      const sel = blocks.find((b) => b.id === selectedId);
      if (sel && sel.type === "icon") {
        sel.data.name = name;
        sel.data.size = size;
        render();
        showToast("Changed icon to " + name);
        return;
      }
    }

    // Strategy 4: Create standalone icon block
    const block = createBlock("icon");
    block.data.name = name;
    block.data.size = size;
    blocks.push(block);
    selectedId = block.id;
    render();
    const wrap = document.querySelector(".canvas-wrap");
    wrap.scrollTop = wrap.scrollHeight;
    showToast("Inserted " + name + " icon block");
  }

  // ── Search with debounce (matches name, tags, and category) ──
  let searchTimeout;
  const searchInput = document.getElementById("icon-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const q = searchInput.value.toLowerCase().trim();
        if (!q) {
          renderIconGrid(allIcons);
        } else {
          const terms = q.split(/\s+/);
          const filtered = allIcons.filter((ic) =>
            terms.every(
              (t) =>
                ic.name.includes(t) ||
                ic.category.includes(t) ||
                ic.tags.some((tag) => tag.includes(t))
            )
          );
          renderIconGrid(filtered);
        }
      }, 150);
    });
  }

  // ─── Initialize with a starter template ───────────────
  // If window.EDITOR_INIT_BLOCKS is set (array of {type, data?}),
  // use that instead of the default starter blocks.
  function init() {
    if (window.EDITOR_INIT_BLOCKS && Array.isArray(window.EDITOR_INIT_BLOCKS)) {
      blocks = window.EDITOR_INIT_BLOCKS.map(function (cfg) {
        var block = createBlock(cfg.type);
        if (cfg.data) {
          Object.keys(cfg.data).forEach(function (key) {
            block.data[key] = cfg.data[key];
          });
        }
        return block;
      });
    } else {
      blocks = [
        createBlock("header"),
        createBlock("divider"),
        createBlock("text"),
        createBlock("text"),
        createBlock("event"),
        createBlock("divider"),
        createBlock("footer"),
      ];
    }
    render();
  }

  init();

  // ─── EditorAPI — bridge for external modules (auth, templates) ──
  window.EditorAPI = {
    getBlocks() {
      syncAllData();
      return JSON.parse(JSON.stringify(blocks));
    },
    loadBlocks(newBlocks) {
      blocks = newBlocks.map(function (cfg) {
        var block = createBlock(cfg.type);
        if (cfg.data) {
          Object.keys(cfg.data).forEach(function (key) {
            block.data[key] = cfg.data[key];
          });
        }
        return block;
      });
      selectedId = null;
      render();
    },
    clearBlocks() {
      blocks = [];
      selectedId = null;
      render();
    },
    showToast: showToast,
  };
})();
