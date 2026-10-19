(function () {
  "use strict";

  var STORAGE_KEY = "po_builder_draft_v3";
  var ORIGINAL_TITLE = document.title;
  var DEFAULT_LOGO_PATH = "logo.png";
  var SINGLE_ROLE_TYPES = ["qty", "rate", "discount", "tax", "amount"];
  var NUMERIC_TYPES = ["qty", "rate", "discount", "tax", "amount", "number"];
  var TYPE_LABELS = {
    text: "Text",
    number: "Number",
    qty: "Quantity",
    rate: "Rate / Price",
    discount: "Discount %",
    tax: "GST %",
    amount: "Amount / Total"
  };

  var INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Ladakh",
    "Lakshadweep", "Jammu and Kashmir", "Puducherry"
  ];

  var DEFAULT_COMPANY = {
    companyName: "Gift Plus",
    companyAddress: "Ground Floor, 9th Main, Dwarakanagar, Chikkabanavara, Bengaluru - 560090",
    companyContact: "Phone: 8920310249 · Email: giftplus0024@gmail.com",
    companyGSTIN: "29BXCPT1687G1ZZ",
    companyPAN: "BXCPT1687G",
    companyState: "Karnataka"
  };

  var columns = [];
  var rows = [];
  var uid = 0;
  function nextId(prefix) { uid += 1; return prefix + "_" + Date.now().toString(36) + uid; }

  function defaultColumns() {
    return [
      { id: "description", label: "Description", type: "text", visible: true },
      { id: "hsn", label: "HSN/SAC", type: "text", visible: false },
      { id: "qty", label: "Qty", type: "qty", visible: true },
      { id: "unit", label: "Unit", type: "text", visible: false },
      { id: "rate", label: "Rate", type: "rate", visible: true },
      { id: "discount", label: "Discount %", type: "discount", visible: false },
      { id: "tax", label: "GST %", type: "tax", visible: false },
      { id: "amount", label: "Amount", type: "amount", visible: true }
    ];
  }

  function emptyRow() {
    var values = {};
    columns.forEach(function (c) { values[c.id] = ""; });
    return { id: nextId("row"), values: values };
  }

  function defaultRows() {
    return [emptyRow()];
  }

  // ---------- DOM refs ----------
  var $ = function (sel) { return document.querySelector(sel); };
  var headRow = $("#itemsHeadRow");
  var body = $("#itemsBody");
  var itemsTable = $("#itemsTable");
  var formTableScroll = $("#formTableScroll");
  var previewTable = $("#previewTable");
  var previewTableScroll = $("#previewTableScroll");
  var pageEl = $("#poPage");
  var scalerEl = document.querySelector(".page-scaler");
  var saveStatus = $("#saveStatus");
  var toastEl = $("#toast");

  // ---------- Helpers ----------
  function getField(name) { return document.querySelector('[data-field="' + name + '"]'); }
  function getFieldValue(name) { var el = getField(name); return el ? el.value : ""; }
  function setFieldValue(name, val) { var el = getField(name); if (el) el.value = val; }
  function getCurrencySymbol() { return "₹"; }
  function parseNum(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function formatMoney(n) {
    var sym = getCurrencySymbol();
    var fixed = (Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sym + fixed;
  }
  function formatDateDisplay(iso) {
    if (!iso) return "";
    var parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function findCol(type) { return columns.filter(function (c) { return c.type === type; })[0]; }
  function visibleColumns() { return columns.filter(function (c) { return c.visible; }); }

  var toastTimer = null;
  function showToast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.className = "toast" + (isError ? " error" : "");
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.add("hidden"); }, 2200);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  // ---------- State selects ----------
  function populateStateSelect(selectEl) {
    selectEl.innerHTML = "";
    var blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Select State";
    selectEl.appendChild(blank);
    INDIAN_STATES.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      selectEl.appendChild(opt);
    });
  }

  // ---------- Live preview sync (form inputs -> static preview text) ----------
  function syncPreview() {
    document.querySelectorAll("[data-preview]").forEach(function (el) {
      var key = el.dataset.preview;
      var source = getField(key);
      if (!source) return;
      var text = source.value;
      if (el.dataset.format === "date") {
        text = formatDateDisplay(source.value);
      } else if (source.tagName === "SELECT") {
        text = source.value ? source.options[source.selectedIndex].text : "";
      }
      el.textContent = text;
    });
    updateNotesPreview();
  }

  function updateNotesPreview() {
    var notesEl = document.querySelector('[data-preview="notes"]');
    if (!notesEl) return;
    var base = getFieldValue("notes");
    var checkbox = $("#taxApplicableCheckbox");
    var extra = (checkbox && checkbox.checked) ? "GST will be applicable extra on the total amount." : "";
    notesEl.textContent = base && extra ? (base + "\n" + extra) : (base || extra);
  }

  function setPreviewText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ---------- Row amount / tax computation ----------
  function rowAmount(row) {
    var qtyCol = findCol("qty"), rateCol = findCol("rate"), discCol = findCol("discount"), amountCol = findCol("amount");
    if (qtyCol && rateCol) {
      var qty = parseNum(row.values[qtyCol.id]);
      var rate = parseNum(row.values[rateCol.id]);
      var disc = discCol ? parseNum(row.values[discCol.id]) : 0;
      return qty * rate * (1 - disc / 100);
    }
    if (amountCol) return parseNum(row.values[amountCol.id]);
    return 0;
  }

  function rowGstRate(row) {
    var taxCol = findCol("tax");
    if (!taxCol) return 0;
    return parseNum(row.values[taxCol.id]);
  }

  function rowTax(row, amount) {
    var taxCol = findCol("tax");
    if (!taxCol) return 0;
    return amount * rowGstRate(row) / 100;
  }

  function isInterState() {
    var companyState = getFieldValue("companyState");
    var vendorState = getFieldValue("vendorState");
    if (!companyState || !vendorState) return false;
    return companyState !== vendorState;
  }

  // ---------- Form (editable) table ----------
  function renderFormTable() {
    var cols = visibleColumns();
    headRow.innerHTML = "";
    var thNo = document.createElement("th");
    thNo.textContent = "#";
    thNo.className = "row-no";
    headRow.appendChild(thNo);

    cols.forEach(function (col) {
      var th = document.createElement("th");
      th.setAttribute("data-type", col.type);
      var labelSpan = document.createElement("span");
      labelSpan.className = "col-head-label";
      labelSpan.textContent = col.label;
      th.appendChild(labelSpan);
      headRow.appendChild(th);
    });

    var thAction = document.createElement("th");
    thAction.className = "row-remove-cell";
    headRow.appendChild(thAction);

    body.innerHTML = "";
    rows.forEach(function (row, idx) {
      body.appendChild(renderFormRow(row, idx, cols));
    });
  }

  function renderFormRow(row, idx, cols) {
    var qtyCol = findCol("qty"), rateCol = findCol("rate");
    var autoAmount = !!(qtyCol && rateCol);

    var tr = document.createElement("tr");
    tr.setAttribute("data-row-id", row.id);

    var tdNo = document.createElement("td");
    tdNo.className = "row-no";
    tdNo.textContent = idx + 1;
    tr.appendChild(tdNo);

    cols.forEach(function (col) {
      var td = document.createElement("td");
      td.setAttribute("data-type", col.type);
      td.setAttribute("data-col-id", col.id);

      if (col.type === "amount" && autoAmount) {
        td.className = "num-cell";
        var span = document.createElement("span");
        span.className = "computed-cell";
        span.textContent = formatMoney(rowAmount(row));
        td.appendChild(span);
      } else {
        var input = document.createElement("input");
        input.className = "cell-field";
        input.value = row.values[col.id] || "";
        if (NUMERIC_TYPES.indexOf(col.type) !== -1) {
          input.type = "number";
          input.step = "any";
          td.className = "num-cell";
        } else {
          input.type = "text";
        }
        input.addEventListener("input", function () {
          row.values[col.id] = input.value;
          refreshRowComputed(row.id);
          recalcTotals();
          renderPreviewTable();
          persist();
        });
        td.appendChild(input);
      }
      tr.appendChild(td);
    });

    var tdAction = document.createElement("td");
    tdAction.className = "row-remove-cell";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "row-remove-btn";
    btn.title = "Remove row";
    btn.textContent = "×";
    btn.disabled = rows.length <= 1;
    btn.addEventListener("click", function () { removeRow(row.id); });
    tdAction.appendChild(btn);
    tr.appendChild(tdAction);

    return tr;
  }

  function refreshRowComputed(rowId) {
    var row = rows.filter(function (r) { return r.id === rowId; })[0];
    if (!row) return;
    var qtyCol = findCol("qty"), rateCol = findCol("rate"), amountCol = findCol("amount");
    if (amountCol && amountCol.visible && qtyCol && rateCol) {
      var tr = body.querySelector('tr[data-row-id="' + rowId + '"]');
      if (!tr) return;
      var cell = tr.querySelector('td[data-col-id="' + amountCol.id + '"] .computed-cell');
      if (cell) cell.textContent = formatMoney(rowAmount(row));
    }
  }

  // ---------- Preview (read-only) table ----------
  function renderPreviewTable() {
    var cols = visibleColumns();
    var qtyCol = findCol("qty"), rateCol = findCol("rate");
    var autoAmount = !!(qtyCol && rateCol);
    var headEl = $("#previewHeadRow"), bodyEl = $("#previewBody");
    if (!headEl || !bodyEl) return;

    headEl.innerHTML = "";
    var thNo = document.createElement("th");
    thNo.textContent = "#";
    thNo.className = "row-no";
    headEl.appendChild(thNo);
    cols.forEach(function (col) {
      var th = document.createElement("th");
      th.setAttribute("data-type", col.type);
      th.textContent = col.label;
      headEl.appendChild(th);
    });

    bodyEl.innerHTML = "";
    rows.forEach(function (row, idx) {
      var tr = document.createElement("tr");
      var tdNo = document.createElement("td");
      tdNo.className = "row-no";
      tdNo.textContent = idx + 1;
      tr.appendChild(tdNo);

      cols.forEach(function (col) {
        var td = document.createElement("td");
        td.setAttribute("data-type", col.type);
        if (NUMERIC_TYPES.indexOf(col.type) !== -1) td.className = "num-cell";
        if (col.type === "amount" && autoAmount) {
          td.textContent = formatMoney(rowAmount(row));
        } else {
          td.textContent = row.values[col.id] || "";
        }
        tr.appendChild(td);
      });
      bodyEl.appendChild(tr);
    });
  }

  // ---------- Totals ----------
  function recalcTotals() {
    var subtotal = rows.reduce(function (sum, r) { return sum + rowAmount(r); }, 0);
    var taxTotal = rows.reduce(function (sum, r) { return sum + rowTax(r, rowAmount(r)); }, 0);
    var shipping = parseNum(getFieldValue("shippingCharge"));
    var other = parseNum(getFieldValue("otherCharges"));
    var discount = parseNum(getFieldValue("overallDiscount"));
    var rawGrand = subtotal + taxTotal + shipping + other - discount;
    var roundedGrand = Math.round(rawGrand);
    var roundOff = roundedGrand - rawGrand;

    setPreviewText("previewSubtotal", formatMoney(subtotal));
    setPreviewText("previewTax", formatMoney(taxTotal));
    setPreviewText("previewShipping", formatMoney(shipping));
    setPreviewText("previewOther", formatMoney(other));
    setPreviewText("previewDiscount", formatMoney(discount));
    setPreviewText("previewRoundOff", (roundOff >= 0 ? "+" : "-") + formatMoney(Math.abs(roundOff)));
    setPreviewText("previewGrandTotal", formatMoney(roundedGrand));

    var wordsEl = $("#amountInWords");
    if (wordsEl) wordsEl.textContent = roundedGrand > 0 ? ("Rupees " + numberToWords(roundedGrand) + " Only") : "—";

    updatePurchaseTypeLabel();
    renderGstSummary();
  }

  function updatePurchaseTypeLabel() {
    var companyState = getFieldValue("companyState");
    var vendorState = getFieldValue("vendorState");
    var formEl = $("#formPurchaseType");
    var previewEl = $("#previewPurchaseType");
    if (!companyState || !vendorState) {
      if (formEl) formEl.textContent = "Select both states below";
      if (previewEl) previewEl.textContent = "—";
      return;
    }
    var label = isInterState() ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)";
    if (formEl) formEl.textContent = label;
    if (previewEl) previewEl.textContent = label;
  }

  function numberToWords(num) {
    if (num === 0) return "Zero";
    var a = ["", "one ", "two ", "three ", "four ", "five ", "six ", "seven ", "eight ", "nine ", "ten ", "eleven ", "twelve ", "thirteen ", "fourteen ", "fifteen ", "sixteen ", "seventeen ", "eighteen ", "nineteen "];
    var b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

    var numAsString = Math.round(num).toString();
    if (numAsString.length > 9) return "overflow";
    var n = ("000000000" + numAsString).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return "";
    var str = "";
    str += (parseInt(n[1], 10) !== 0) ? (a[Number(n[1])] || b[n[1][0]] + " " + a[n[1][1]]) + "crore " : "";
    str += (parseInt(n[2], 10) !== 0) ? (a[Number(n[2])] || b[n[2][0]] + " " + a[n[2][1]]) + "lakh " : "";
    str += (parseInt(n[3], 10) !== 0) ? (a[Number(n[3])] || b[n[3][0]] + " " + a[n[3][1]]) + "thousand " : "";
    str += (parseInt(n[4], 10) !== 0) ? (a[Number(n[4])] || b[n[4][0]] + " " + a[n[4][1]]) + "hundred " : "";
    str += (parseInt(n[5], 10) !== 0) ? (a[Number(n[5])] || b[n[5][0]] + " " + a[n[5][1]]) : "";
    return str.trim().split(" ").map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join(" ");
  }

  // ---------- GST (CGST/SGST/IGST) summary ----------
  function renderGstSummary() {
    var wrap = $("#gstSummaryWrap");
    var table = $("#gstSummaryTable");
    var taxCol = findCol("tax");

    if (!taxCol) {
      wrap.classList.add("hidden");
      table.innerHTML = "";
      return;
    }

    var groups = {};
    var hasAny = false;
    rows.forEach(function (row) {
      var raw = row.values[taxCol.id];
      if (raw === "" || raw === undefined || raw === null) return;
      var rate = parseNum(raw);
      var amount = rowAmount(row);
      if (amount === 0 && rate === 0) return;
      hasAny = true;
      if (!groups[rate]) groups[rate] = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
      var itemTax = amount * rate / 100;
      groups[rate].taxableValue += amount;
      if (isInterState()) {
        groups[rate].igst += itemTax;
      } else {
        groups[rate].cgst += itemTax / 2;
        groups[rate].sgst += itemTax / 2;
      }
    });

    if (!hasAny) {
      wrap.classList.add("hidden");
      table.innerHTML = "";
      return;
    }

    wrap.classList.remove("hidden");
    var interState = isInterState();
    var rates = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });

    var totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    var bodyRows = rates.map(function (rate) {
      var g = groups[rate];
      totalTaxable += g.taxableValue;
      totalCgst += g.cgst;
      totalSgst += g.sgst;
      totalIgst += g.igst;
      if (interState) {
        return "<tr><td>" + formatMoney(g.taxableValue) + "</td><td>" + rate + "%</td><td>" + formatMoney(g.igst) + "</td></tr>";
      }
      return "<tr><td>" + formatMoney(g.taxableValue) + "</td><td>" + (rate / 2) + "%</td><td>" + formatMoney(g.cgst) + "</td><td>" + (rate / 2) + "%</td><td>" + formatMoney(g.sgst) + "</td></tr>";
    }).join("");

    var head = interState
      ? "<thead><tr><th>Taxable Value</th><th>IGST Rate</th><th>IGST Amount</th></tr></thead>"
      : "<thead><tr><th>Taxable Value</th><th>CGST Rate</th><th>CGST Amt</th><th>SGST Rate</th><th>SGST Amt</th></tr></thead>";

    var foot = interState
      ? "<tfoot><tr><td>" + formatMoney(totalTaxable) + "</td><td></td><td>" + formatMoney(totalIgst) + "</td></tr></tfoot>"
      : "<tfoot><tr><td>" + formatMoney(totalTaxable) + "</td><td></td><td>" + formatMoney(totalCgst) + "</td><td></td><td>" + formatMoney(totalSgst) + "</td></tr></tfoot>";

    table.innerHTML = head + "<tbody>" + bodyRows + "</tbody>" + foot;
  }

  // ---------- Full re-render (structural changes: rows/columns/bulk field load) ----------
  function renderAll() {
    renderFormTable();
    syncPreview();
    renderPreviewTable();
    recalcTotals();
    refreshLayout();
  }

  // ---------- Row ops ----------
  function addRow() {
    rows.push(emptyRow());
    renderAll();
    persist();
    var trs = body.querySelectorAll("tr");
    var last = trs[trs.length - 1];
    if (last) { var firstInput = last.querySelector("input"); if (firstInput) firstInput.focus(); }
  }

  function removeRow(id) {
    if (rows.length <= 1) return;
    rows = rows.filter(function (r) { return r.id !== id; });
    renderAll();
    persist();
  }

  // ---------- Column ops (hide/show, never delete) ----------
  function addColumn(label, type) {
    label = (label || "").trim();
    if (!label) return;
    if (SINGLE_ROLE_TYPES.indexOf(type) !== -1 && findCol(type)) {
      showToast("Only one '" + TYPE_LABELS[type] + "' column is allowed. Toggle the existing one instead.", true);
      return;
    }
    var col = { id: nextId("col"), label: label, type: type, visible: true };
    var amountIdx = columns.findIndex(function (c) { return c.type === "amount"; });
    if (amountIdx === -1) columns.push(col);
    else columns.splice(amountIdx, 0, col);

    rows.forEach(function (r) { r.values[col.id] = ""; });
    renderAll();
    renderColumnsList();
    persist();
  }

  function toggleColumnVisibility(id) {
    var col = columns.filter(function (c) { return c.id === id; })[0];
    if (!col) return;
    if (col.visible && visibleColumns().length <= 1) {
      showToast("At least one visible column is required.", true);
      return;
    }
    col.visible = !col.visible;
    renderAll();
    renderColumnsList();
    persist();
  }

  function renderColumnsList() {
    var list = $("#columnsList");
    list.innerHTML = "";
    columns.forEach(function (col) {
      var chip = document.createElement("div");
      chip.className = "column-chip" + (col.visible ? "" : " is-hidden");
      var left = document.createElement("span");
      left.innerHTML = escapeHtml(col.label) + '<span class="chip-type">' + TYPE_LABELS[col.type] + "</span>";
      var toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "chip-toggle" + (col.visible ? "" : " is-shown");
      toggleBtn.textContent = col.visible ? "Hide" : "Show";
      toggleBtn.addEventListener("click", function () { toggleColumnVisibility(col.id); });
      chip.appendChild(left);
      chip.appendChild(toggleBtn);
      list.appendChild(chip);
    });
  }

  // ---------- Responsive: shrink a table's font to avoid wrap/overflow ----------
  var BASE_FONT = 12.5, MIN_FONT = 7.5;
  function fitTableToWidth(table, container) {
    if (!table || !container) return;
    table.style.fontSize = BASE_FONT + "px";
    var size = BASE_FONT;
    var guard = 0;
    while (table.scrollWidth > container.clientWidth && size > MIN_FONT && guard < 40) {
      size -= 0.4;
      table.style.fontSize = size.toFixed(1) + "px";
      guard += 1;
    }
  }

  function fitAllTables() {
    fitTableToWidth(itemsTable, formTableScroll);
    fitTableToWidth(previewTable, previewTableScroll);
  }

  // ---------- Responsive: scale whole A4 preview page to fit viewport ----------
  function scalePage() {
    if (!pageEl || !scalerEl) return;
    pageEl.style.transform = "scale(1)";
    var naturalWidth = pageEl.offsetWidth;
    var naturalHeight = pageEl.offsetHeight;
    var available = scalerEl.clientWidth - 16;
    var scale = Math.min(1, available / naturalWidth);
    pageEl.style.transform = "scale(" + scale + ")";
    scalerEl.style.height = (naturalHeight * scale + 24) + "px";
  }

  function refreshLayout() {
    fitAllTables();
    scalePage();
  }

  // ---------- Autosave ----------
  function serialize() {
    var fields = {};
    document.querySelectorAll("[data-field]").forEach(function (el) { fields[el.dataset.field] = el.value; });
    var logoImg = $("#logoImg");
    fields.companyLogo = logoImg.getAttribute("src") === DEFAULT_LOGO_PATH ? "" : logoImg.src;
    fields.shipSameAsCompany = $("#shipSameAsCompany").checked;
    fields.taxApplicable = $("#taxApplicableCheckbox").checked;
    return { fields: fields, columns: columns, rows: rows };
  }

  var persist = debounce(function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
      saveStatus.textContent = "Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) { /* storage unavailable - ignore */ }
  }, 400);

  function applyLogo(dataUrl) {
    var src = dataUrl || DEFAULT_LOGO_PATH;
    var img = $("#logoImg");
    if (img) img.src = src;
    var previewImg = $("#previewLogoImg");
    if (previewImg) previewImg.src = src;
  }

  function generatePoNumber() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return "PO-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + Math.floor(100 + Math.random() * 900);
  }

  function seedDefaultCompany() {
    Object.keys(DEFAULT_COMPANY).forEach(function (key) {
      setFieldValue(key, DEFAULT_COMPANY[key]);
    });
    applyLogo("");
  }

  function loadDraft() {
    populateStateSelect($("#companyStateSelect"));
    populateStateSelect($("#vendorStateSelect"));

    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }

    if (!raw) {
      columns = defaultColumns();
      rows = defaultRows();
      seedDefaultCompany();
      setFieldValue("poNumber", generatePoNumber());
      setFieldValue("poDate", new Date().toISOString().slice(0, 10));
      renderColumnsList();
      renderAll();
      return;
    }

    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (!parsed) {
      columns = defaultColumns();
      rows = defaultRows();
      seedDefaultCompany();
      renderColumnsList();
      renderAll();
      return;
    }

    columns = parsed.columns && parsed.columns.length ? parsed.columns : defaultColumns();
    columns.forEach(function (c) { if (typeof c.visible !== "boolean") c.visible = true; });
    rows = parsed.rows && parsed.rows.length ? parsed.rows : defaultRows();

    var fields = parsed.fields || {};
    Object.keys(fields).forEach(function (key) {
      if (key === "companyLogo" || key === "shipSameAsCompany" || key === "taxApplicable") return;
      setFieldValue(key, fields[key]);
    });
    applyLogo(fields.companyLogo || "");
    $("#shipSameAsCompany").checked = !!fields.shipSameAsCompany;
    toggleShipSame($("#shipSameAsCompany").checked, true);
    $("#taxApplicableCheckbox").checked = !!fields.taxApplicable;

    if (!getFieldValue("poNumber")) setFieldValue("poNumber", generatePoNumber());

    renderColumnsList();
    renderAll();
  }

  function resetAll() {
    if (!confirm("Start a new purchase order? This clears the current draft.")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    document.querySelectorAll("[data-field]").forEach(function (el) { el.value = ""; });
    applyLogo("");
    $("#shipSameAsCompany").checked = false;
    $("#taxApplicableCheckbox").checked = false;
    columns = defaultColumns();
    rows = defaultRows();
    seedDefaultCompany();
    setFieldValue("poNumber", generatePoNumber());
    setFieldValue("poDate", new Date().toISOString().slice(0, 10));
    setFieldValue("shippingCharge", "0");
    setFieldValue("otherCharges", "0");
    setFieldValue("overallDiscount", "0");
    setFieldValue("terms", "Goods and quantities must match the specifications in this purchase order. Please reference the PO number on all invoices, packing slips, and correspondence.");
    renderColumnsList();
    renderAll();
    persist();
    showToast("New purchase order started");
  }

  // ---------- Ship-to same-as-company ----------
  function toggleShipSame(checked, skipCopy) {
    ["shipName", "shipAddress", "shipContact"].forEach(function (f) {
      var el = getField(f);
      el.disabled = checked;
    });
    if (checked && !skipCopy) {
      setFieldValue("shipName", getFieldValue("companyName"));
      setFieldValue("shipAddress", getFieldValue("companyAddress"));
      setFieldValue("shipContact", getFieldValue("companyContact"));
    }
    syncPreview();
  }

  // ---------- Print / download filename ----------
  function buildFileName() {
    var name = (getFieldValue("companyName") || "Purchase Order").trim() || "Purchase Order";
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var dateStr = pad(d.getDate()) + "-" + pad(d.getMonth() + 1) + "-" + d.getFullYear();
    return (name + " " + dateStr).replace(/[\\/:*?"<>|]/g, "-");
  }

  // ---------- Wire up ----------
  function init() {
    function handleFieldChange(e) {
      if (e.target.matches("[data-field]")) { persist(); syncPreview(); }
    }
    document.addEventListener("input", handleFieldChange);
    document.addEventListener("change", handleFieldChange);

    $("#btnAddRow").addEventListener("click", addRow);
    $("#btnNew").addEventListener("click", resetAll);
    $("#btnDownload").addEventListener("click", function () { window.print(); });

    var btnColumns = $("#btnColumns"), panel = $("#columnsPanel");
    btnColumns.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.classList.toggle("hidden");
    });
    document.addEventListener("click", function (e) {
      if (!panel.classList.contains("hidden") && !panel.contains(e.target) && e.target !== btnColumns) {
        panel.classList.add("hidden");
      }
    });

    $("#addColumnForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var nameInput = $("#newColName"), typeSelect = $("#newColType");
      addColumn(nameInput.value, typeSelect.value);
      nameInput.value = "";
      nameInput.focus();
    });

    var logoUpload = $("#logoUpload"), logoInput = $("#logoInput");
    logoUpload.addEventListener("click", function (e) { e.preventDefault(); logoInput.click(); });
    logoInput.addEventListener("change", function () {
      var file = logoInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { applyLogo(reader.result); persist(); };
      reader.readAsDataURL(file);
    });

    $("#shipSameAsCompany").addEventListener("change", function (e) {
      toggleShipSame(e.target.checked, false);
      persist();
    });

    $("#taxApplicableCheckbox").addEventListener("change", function () {
      updateNotesPreview();
      persist();
    });

    ["companyName", "companyAddress", "companyContact"].forEach(function (f) {
      getField(f).addEventListener("input", function () {
        if ($("#shipSameAsCompany").checked) toggleShipSame(true, false);
      });
    });

    ["shippingCharge", "otherCharges", "overallDiscount", "companyState", "vendorState"].forEach(function (f) {
      getField(f).addEventListener("input", recalcTotals);
      getField(f).addEventListener("change", recalcTotals);
    });

    window.addEventListener("resize", debounce(refreshLayout, 150));
    window.addEventListener("beforeprint", function () {
      fitAllTables();
      document.title = buildFileName();
    });
    window.addEventListener("afterprint", function () {
      document.title = ORIGINAL_TITLE;
    });

    loadDraft();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
