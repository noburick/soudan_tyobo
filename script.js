const CURRENT_STORAGE_KEY = "soudan_tyobo_records";
const LEGACY_STORAGE_KEY = "soudanTyoboRecords";
const RECORDS_BACKUP_KEY = "soudan_tyobo_records_backup";
const AMMO_TYPES_STORAGE_KEY = "soudan_tyobo_ammo_types";
const AMMO_TYPES_BACKUP_KEY = "soudan_tyobo_ammo_types_backup";
const GRAMS_COMPARISON_EPSILON = 0.01;

const form = document.getElementById("record-form");
const ammoTypeForm = document.getElementById("ammo-type-form");
const ammoTypeSelect = document.getElementById("ammoTypeSelect");
const ammoTypesBody = document.getElementById("ammo-types-body");
const inventoryBody = document.getElementById("inventory-body");
const historyBody = document.getElementById("history-body");
const exportCsvButton = document.getElementById("export-csv");

function generateId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseStoredArray(raw) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }

  function isValidGrams(value) {
    return !Number.isNaN(value) && value >= 0.1;
  }
}

function saveArrayWithBackup(primaryKey, backupKey, items) {
  const serialized = JSON.stringify(items);
  localStorage.setItem(primaryKey, serialized);
  localStorage.setItem(backupKey, serialized);
}

function loadArrayWithBackup(primaryKey, backupKey, legacyKey) {
  const candidates = [
    localStorage.getItem(primaryKey),
    legacyKey ? localStorage.getItem(legacyKey) : null,
    localStorage.getItem(backupKey),
  ];

  for (const raw of candidates) {
    const parsed = parseStoredArray(raw);
    if (parsed) {
      saveArrayWithBackup(primaryKey, backupKey, parsed);
      return parsed;
    }
  }

  return [];
}

function loadRecords() {
  return loadArrayWithBackup(CURRENT_STORAGE_KEY, RECORDS_BACKUP_KEY, LEGACY_STORAGE_KEY);
}

function saveRecords(records) {
  saveArrayWithBackup(CURRENT_STORAGE_KEY, RECORDS_BACKUP_KEY, records);
}

function addRecord(record) {
  const records = loadRecords();
  records.push(record);
  saveRecords(records);
}

function deleteRecord(recordId) {
  const records = loadRecords().filter((record) => record.id !== recordId);
  saveRecords(records);
}

function loadAmmoTypes() {
  const loaded = loadArrayWithBackup(AMMO_TYPES_STORAGE_KEY, AMMO_TYPES_BACKUP_KEY, null);
  const normalized = loaded
    .map((item) => ({
      id: String(item.id || ""),
      ammoName: String(item.ammoName || "").trim(),
      caliber: String(item.caliber || "").trim(),
      shotSize: String(item.shotSize || "").trim(),
      grams: Number(item.grams),
    }))
    .filter(
      (item) =>
        item.id &&
        item.ammoName &&
        item.caliber &&
        item.shotSize &&
        isValidGrams(item.grams)
    );

  if (normalized.length !== loaded.length) {
    saveAmmoTypes(normalized);
  }

  return normalized;
}

function saveAmmoTypes(ammoTypes) {
  saveArrayWithBackup(AMMO_TYPES_STORAGE_KEY, AMMO_TYPES_BACKUP_KEY, ammoTypes);
}

function addAmmoType(ammoType) {
  const ammoTypes = loadAmmoTypes();
  const duplicated = ammoTypes.some(
    (item) =>
      item.ammoName === ammoType.ammoName &&
      item.caliber === ammoType.caliber &&
      item.shotSize === ammoType.shotSize &&
      Math.abs(Number(item.grams) - Number(ammoType.grams)) < GRAMS_COMPARISON_EPSILON
  );

  if (duplicated) {
    return false;
  }

  ammoTypes.push(ammoType);
  saveAmmoTypes(ammoTypes);
  return true;
}

function deleteAmmoType(ammoTypeId) {
  const ammoTypes = loadAmmoTypes().filter((item) => item.id !== ammoTypeId);
  saveAmmoTypes(ammoTypes);
}

function getTypeLabel(type) {
  return type === "purchase" ? "購入" : "使用";
}

function createAmmoKey(record) {
  return JSON.stringify([record.ammoName, record.caliber, record.shotSize, record.grams]);
}

function calculateInventory(records) {
  const stockMap = new Map();

  for (const record of records) {
    const key = createAmmoKey(record);
    const current = stockMap.get(key) || {
      ammoName: record.ammoName,
      caliber: record.caliber,
      shotSize: record.shotSize,
      grams: record.grams,
      stock: 0,
    };

    const sign = record.type === "purchase" ? 1 : -1;
    current.stock += sign * Number(record.quantity);
    stockMap.set(key, current);
  }

  return Array.from(stockMap.values()).sort((a, b) => {
    if (a.caliber !== b.caliber) return a.caliber.localeCompare(b.caliber, "ja");
    return a.ammoName.localeCompare(b.ammoName, "ja");
  });
}

function escapeCsvValue(value) {
  const normalized = String(value ?? "").replace(/"/g, '""');
  return `"${normalized}"`;
}

function exportToCsv(records) {
  const header = ["日付", "装弾名", "口径", "号数", "グラム数", "区分", "数量", "用途・メモ"];
  const rows = records.map((record) => [
    record.date,
    record.ammoName,
    record.caliber,
    record.shotSize,
    record.grams,
    getTypeLabel(record.type),
    record.quantity,
    record.memo,
  ]);

  const csv = [header, ...rows]
    .map((line) => line.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `soudan_tyobo_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatDateForInput() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sortedAmmoTypes(ammoTypes) {
  return [...ammoTypes].sort((a, b) => {
    const caliberA = String(a.caliber ?? "");
    const caliberB = String(b.caliber ?? "");
    const ammoNameA = String(a.ammoName ?? "");
    const ammoNameB = String(b.ammoName ?? "");

    if (caliberA !== caliberB) return caliberA.localeCompare(caliberB, "ja");
    if (ammoNameA !== ammoNameB) return ammoNameA.localeCompare(ammoNameB, "ja");
    return Number(a.grams) - Number(b.grams);
  });
}

function findAmmoTypeById(ammoTypeId) {
  if (!ammoTypeId) return null;
  return loadAmmoTypes().find((ammoType) => ammoType.id === ammoTypeId) || null;
}

function createCell(label, value) {
  const td = document.createElement("td");
  td.dataset.label = label;
  td.textContent = String(value ?? "");
  return td;
}

function createEmptyCell(colspan, message) {
  const td = document.createElement("td");
  td.className = "empty";
  td.colSpan = colspan;
  td.textContent = message;
  return td;
}

function renderAmmoTypeOptions(ammoTypes, selectedAmmoTypeId = "") {
  const sorted = sortedAmmoTypes(ammoTypes);
  ammoTypeSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "選択しない（手入力）";
  ammoTypeSelect.appendChild(defaultOption);

  for (const ammoType of sorted) {
    const option = document.createElement("option");
    option.value = ammoType.id;
    option.textContent = `${ammoType.ammoName} / ${ammoType.caliber} / ${ammoType.shotSize} / ${ammoType.grams}g`;
    ammoTypeSelect.appendChild(option);
  }

  if (selectedAmmoTypeId && sorted.some((ammoType) => ammoType.id === selectedAmmoTypeId)) {
    ammoTypeSelect.value = selectedAmmoTypeId;
  }
}

function renderAmmoTypes(ammoTypes) {
  const sorted = sortedAmmoTypes(ammoTypes);
  ammoTypesBody.innerHTML = "";

  if (sorted.length === 0) {
    const tr = document.createElement("tr");
    tr.appendChild(createEmptyCell(5, "登録済み装弾がありません"));
    ammoTypesBody.appendChild(tr);
    return;
  }

  for (const ammoType of sorted) {
    const tr = document.createElement("tr");
    tr.appendChild(createCell("装弾名", ammoType.ammoName));
    tr.appendChild(createCell("口径", ammoType.caliber));
    tr.appendChild(createCell("号数", ammoType.shotSize));
    tr.appendChild(createCell("g", ammoType.grams));

    const deleteCell = document.createElement("td");
    deleteCell.dataset.label = "削除";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-delete";
    button.dataset.id = ammoType.id;
    button.textContent = "削除";
    deleteCell.appendChild(button);

    tr.appendChild(deleteCell);
    ammoTypesBody.appendChild(tr);
  }
}

function renderInventory(records) {
  const inventory = calculateInventory(records);
  inventoryBody.innerHTML = "";

  if (inventory.length === 0) {
    const tr = document.createElement("tr");
    tr.appendChild(createEmptyCell(5, "在庫データがありません"));
    inventoryBody.appendChild(tr);
    return;
  }

  for (const item of inventory) {
    const tr = document.createElement("tr");
    tr.appendChild(createCell("装弾名", item.ammoName));
    tr.appendChild(createCell("口径", item.caliber));
    tr.appendChild(createCell("号数", item.shotSize));
    tr.appendChild(createCell("g", item.grams));
    tr.appendChild(createCell("残数", item.stock));
    inventoryBody.appendChild(tr);
  }
}

function renderHistory(records) {
  historyBody.innerHTML = "";

  if (records.length === 0) {
    const tr = document.createElement("tr");
    tr.appendChild(createEmptyCell(9, "履歴がありません"));
    historyBody.appendChild(tr);
    return;
  }

  const sorted = [...records].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt - a.createdAt;
  });

  for (const record of sorted) {
    const tr = document.createElement("tr");
    tr.appendChild(createCell("日付", record.date));
    tr.appendChild(createCell("装弾名", record.ammoName));
    tr.appendChild(createCell("口径", record.caliber));
    tr.appendChild(createCell("号数", record.shotSize));
    tr.appendChild(createCell("g", record.grams));
    tr.appendChild(createCell("区分", getTypeLabel(record.type)));
    tr.appendChild(createCell("数量", record.quantity));
    tr.appendChild(createCell("メモ", record.memo || ""));

    const deleteCell = document.createElement("td");
    deleteCell.dataset.label = "削除";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-delete";
    button.dataset.id = record.id;
    button.textContent = "削除";
    deleteCell.appendChild(button);

    tr.appendChild(deleteCell);
    historyBody.appendChild(tr);
  }
}

function refreshUi(selectedAmmoTypeId = "") {
  const ammoTypes = loadAmmoTypes();
  renderAmmoTypeOptions(ammoTypes, selectedAmmoTypeId);
  renderAmmoTypes(ammoTypes);

  const records = loadRecords();
  renderInventory(records);
  renderHistory(records);
}

function fillRecordFieldsByAmmoType(ammoTypeId) {
  if (!ammoTypeId) return;

  const selected = findAmmoTypeById(ammoTypeId);
  if (!selected) return;

  document.getElementById("ammoName").value = selected.ammoName;
  document.getElementById("caliber").value = selected.caliber;
  document.getElementById("shotSize").value = selected.shotSize;
  document.getElementById("grams").value = selected.grams;
}

ammoTypeForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(ammoTypeForm);
  const ammoType = {
    id: generateId(),
    ammoName: String(formData.get("ammoName") || "").trim(),
    caliber: String(formData.get("caliber") || "").trim(),
    shotSize: String(formData.get("shotSize") || "").trim(),
    grams: Number(formData.get("grams")),
  };

  const hasRequiredTextFields = Boolean(ammoType.ammoName && ammoType.caliber && ammoType.shotSize);
  const hasValidGrams = isValidGrams(ammoType.grams);

  if (!hasRequiredTextFields || !hasValidGrams) {
    alert("装弾種類の必須項目を正しく入力してください。");
    return;
  }

  const added = addAmmoType(ammoType);
  if (!added) {
    alert("同じ装弾種類はすでに登録されています。");
    return;
  }

  ammoTypeForm.reset();
  refreshUi(ammoType.id);
  fillRecordFieldsByAmmoType(ammoType.id);
});

ammoTypeSelect.addEventListener("change", () => {
  fillRecordFieldsByAmmoType(ammoTypeSelect.value);
});

ammoTypesBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const id = target.dataset.id;
  if (!id) return;
  if (!confirm("この装弾種類を削除しますか？（記帳済みデータは残ります）")) return;

  deleteAmmoType(id);
  refreshUi();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const selectedAmmoTypeId = String(formData.get("ammoTypeId") || "");
  const quantity = Number(formData.get("quantity"));

  if (!Number.isInteger(quantity) || quantity <= 0) {
    alert("数量は1以上の整数を入力してください。");
    return;
  }

  let ammoName = String(formData.get("ammoName") || "").trim();
  let caliber = String(formData.get("caliber") || "").trim();
  let shotSize = String(formData.get("shotSize") || "").trim();
  let grams = Number(formData.get("grams"));

  if (selectedAmmoTypeId) {
    const selected = findAmmoTypeById(selectedAmmoTypeId);
    if (!selected) {
      alert("選択した装弾種類が見つかりません。再選択してください。");
      refreshUi();
      return;
    }

    ammoName = selected.ammoName;
    caliber = selected.caliber;
    shotSize = selected.shotSize;
    grams = Number(selected.grams);
  }

  const record = {
    id: generateId(),
    createdAt: Date.now(),
    date: String(formData.get("date") || ""),
    ammoName,
    caliber,
    shotSize,
    grams,
    type: String(formData.get("type") || "purchase"),
    quantity,
    memo: String(formData.get("memo") || "").trim(),
  };

  const hasRequiredTextFields = Boolean(record.date && record.ammoName && record.caliber && record.shotSize);
  const hasValidGrams = isValidGrams(record.grams);

  if (!hasRequiredTextFields || !hasValidGrams) {
    alert("必須項目を正しく入力してください。");
    return;
  }

  addRecord(record);
  form.reset();
  document.getElementById("date").value = formatDateForInput();
  refreshUi(selectedAmmoTypeId);
  fillRecordFieldsByAmmoType(selectedAmmoTypeId);
});

historyBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const id = target.dataset.id;
  if (!id) return;
  if (!confirm("この履歴を削除しますか？")) return;

  deleteRecord(id);
  refreshUi(ammoTypeSelect.value);
});

exportCsvButton.addEventListener("click", () => {
  const records = loadRecords();
  exportToCsv(records);
});

document.getElementById("date").value = formatDateForInput();
refreshUi();
