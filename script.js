const STORAGE_KEY = "soudanTyoboRecords";

const form = document.getElementById("record-form");
const inventoryBody = document.getElementById("inventory-body");
const historyBody = document.getElementById("history-body");
const exportCsvButton = document.getElementById("export-csv");

function generateId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("記録の読み込みに失敗しました", error);
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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

function getTypeLabel(type) {
  return type === "purchase" ? "購入" : "使用";
}

function createAmmoKey(record) {
  return [record.ammoName, record.caliber, record.shotSize, record.grams].join("|");
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

function renderInventory(records) {
  const inventory = calculateInventory(records);
  inventoryBody.innerHTML = "";

  if (inventory.length === 0) {
    inventoryBody.innerHTML = `<tr><td class="empty" colspan="5">在庫データがありません</td></tr>`;
    return;
  }

  for (const item of inventory) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.ammoName}</td>
      <td>${item.caliber}</td>
      <td>${item.shotSize}</td>
      <td>${item.grams}</td>
      <td>${item.stock}</td>
    `;
    inventoryBody.appendChild(tr);
  }
}

function renderHistory(records) {
  historyBody.innerHTML = "";

  if (records.length === 0) {
    historyBody.innerHTML = `<tr><td class="empty" colspan="9">履歴がありません</td></tr>`;
    return;
  }

  const sorted = [...records].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt - a.createdAt;
  });

  for (const record of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${record.date}</td>
      <td>${record.ammoName}</td>
      <td>${record.caliber}</td>
      <td>${record.shotSize}</td>
      <td>${record.grams}</td>
      <td>${getTypeLabel(record.type)}</td>
      <td>${record.quantity}</td>
      <td>${record.memo || ""}</td>
      <td><button class="btn-delete" data-id="${record.id}" type="button">削除</button></td>
    `;
    historyBody.appendChild(tr);
  }
}

function refreshUi() {
  const records = loadRecords();
  renderInventory(records);
  renderHistory(records);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const quantity = Number(formData.get("quantity"));

  if (!Number.isInteger(quantity) || quantity <= 0) {
    alert("数量は1以上の整数を入力してください。");
    return;
  }

  const record = {
    id: generateId(),
    createdAt: Date.now(),
    date: String(formData.get("date") || ""),
    ammoName: String(formData.get("ammoName") || "").trim(),
    caliber: String(formData.get("caliber") || "").trim(),
    shotSize: String(formData.get("shotSize") || "").trim(),
    grams: Number(formData.get("grams")),
    type: String(formData.get("type") || "purchase"),
    quantity,
    memo: String(formData.get("memo") || "").trim(),
  };

  if (!record.date || !record.ammoName || !record.caliber || !record.shotSize || Number.isNaN(record.grams) || record.grams < 0) {
    alert("必須項目を正しく入力してください。");
    return;
  }

  addRecord(record);
  form.reset();
  document.getElementById("date").value = formatDateForInput();
  refreshUi();
});

historyBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const id = target.dataset.id;
  if (!id) return;
  if (!confirm("この履歴を削除しますか？")) return;

  deleteRecord(id);
  refreshUi();
});

exportCsvButton.addEventListener("click", () => {
  const records = loadRecords();
  exportToCsv(records);
});

document.getElementById("date").value = formatDateForInput();
refreshUi();
