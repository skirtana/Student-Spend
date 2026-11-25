// app.js – data, validation, transactions, localStorage and dashboard updates.

var expenses = [];       // array of {id, title, amount, category, date, type}
var monthlyBudget = 0;
var editingId = null;    // id of the expense being edited (null = adding new)

function $(id) { return document.getElementById(id); }

// ---------- localStorage ----------
function saveData() {
  localStorage.setItem("studentspend_expenses", JSON.stringify(expenses));
  localStorage.setItem("studentspend_budget", String(monthlyBudget));
}

function loadData() {
  try {
    expenses = JSON.parse(localStorage.getItem("studentspend_expenses")) || [];
    monthlyBudget = Number(localStorage.getItem("studentspend_budget")) || 0;
  } catch (err) {
    expenses = []; monthlyBudget = 0;   // corrupted data: start fresh
  }
}

// ---------- Helpers ----------
function todayString() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Stops user text from being treated as HTML.
function escapeHtml(text) {
  var div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showFormError(message) {
  var box = $("formError");
  box.textContent = message;
  box.classList.toggle("d-none", message === "");
}

// ---------- Budget ----------
function handleBudgetSubmit(event) {
  event.preventDefault();
  var value = Number($("budgetInput").value);
  if (!value || value <= 0) {
    $("budgetMsg").textContent = "Enter a budget greater than zero.";
    return;
  }
  $("budgetMsg").textContent = "";
  monthlyBudget = value;
  saveData();
  updateDashboard();
}

// ---------- Expense form ----------
// Returns an error string, or "" when everything is valid.
function validateExpense(title, amount, category, date, type) {
  if (title.trim() === "") return "Please enter an expense title.";
  if (isNaN(amount) || amount <= 0) return "Amount must be a number greater than zero.";
  if (category === "") return "Please choose a category.";
  if (date === "") return "Please choose a date.";
  if (type === "") return "Please choose Need or Want.";
  return "";
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  var title = $("expTitle").value;
  var amount = parseFloat($("expAmount").value);
  var category = $("expCategory").value;
  var date = $("expDate").value;
  var type = $("expType").value;

  var error = validateExpense(title, amount, category, date, type);
  if (error) { showFormError(error); return; }
  showFormError("");

  if (editingId === null) {
    expenses.push({ id: Date.now(), title: title.trim(), amount: amount, category: category, date: date, type: type });
  } else {
    var item = expenses.find(function (e) { return e.id === editingId; });
    item.title = title.trim(); item.amount = amount; item.category = category; item.date = date; item.type = type;
  }
  saveData();
  resetForm();
  updateDashboard();
}

function resetForm() {
  $("expenseForm").reset();
  $("expDate").value = todayString();
  editingId = null;
  $("formTitle").textContent = "Add expense";
  $("submitBtn").textContent = "Add expense";
  $("cancelEditBtn").classList.add("d-none");
  showFormError("");
}

// Fill the form with an existing expense so it can be changed.
function startEdit(id) {
  var e = expenses.find(function (x) { return x.id === id; });
  if (!e) return;
  editingId = id;
  $("expTitle").value = e.title; $("expAmount").value = e.amount;
  $("expCategory").value = e.category; $("expDate").value = e.date; $("expType").value = e.type;
  $("formTitle").textContent = "Edit expense";
  $("submitBtn").textContent = "Save changes";
  $("cancelEditBtn").classList.remove("d-none");
  $("expTitle").focus();
}

function deleteExpense(id) {
  if (!confirm("Delete this expense?")) return;
  expenses = expenses.filter(function (e) { return e.id !== id; });
  if (editingId === id) resetForm();
  saveData();
  updateDashboard();
}

// ---------- Transaction table ----------
function renderTransactions() {
  var search = $("searchInput").value.trim().toLowerCase();
  var cat = $("filterCategory").value;
  var type = $("filterType").value;

  var shown = expenses.filter(function (e) {
    return e.title.toLowerCase().includes(search) && (cat === "" || e.category === cat) && (type === "" || e.type === type);
  }).sort(function (a, b) { return b.date.localeCompare(a.date); });   // newest first

  var body = $("txBody");
  if (shown.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">' +
      (expenses.length === 0 ? "No expenses yet. Add your first one using the form." : "No expenses match your search or filters.") + "</td></tr>";
    return;
  }
  body.innerHTML = shown.map(function (e) {
    return "<tr><td>" + escapeHtml(e.title) + "</td><td>" + formatMoney(e.amount) + "</td><td>" + e.category + "</td><td>" + e.date +
      '</td><td><span class="badge ' + (e.type === "Need" ? "badge-need" : "badge-want") + '">' + e.type + "</span></td>" +
      '<td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="' + e.id + '" aria-label="Edit"><i class="bi bi-pencil"></i></button>' +
      '<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="' + e.id + '" aria-label="Delete"><i class="bi bi-trash"></i></button></td></tr>';
  }).join("");
}

// ---------- Dashboard ----------
// Re-draws everything. Called after every change.
function updateDashboard() {
  var monthList = getCurrentMonthExpenses(expenses);   // from insights.js
  var spent = sumExpenses(monthList);
  var daily = calculateDailySafe(monthlyBudget, spent);

  $("cardBudget").textContent = formatMoney(monthlyBudget);
  $("cardSpent").textContent = formatMoney(spent);
  $("cardRemaining").textContent = formatMoney(daily.remaining);
  $("cardDaily").textContent = formatMoney(daily.daily);
  $("dailyMessage").textContent = daily.message;

  renderAdvisor(monthlyBudget, monthList);
  renderSpendingAnalysis(monthList);
  renderTransactions();
}

// ---------- Start-up ----------
function init() {
  loadData();
  $("budgetInput").value = monthlyBudget || "";
  $("expDate").value = todayString();

  $("budgetForm").addEventListener("submit", handleBudgetSubmit);
  $("expenseForm").addEventListener("submit", handleExpenseSubmit);
  $("cancelEditBtn").addEventListener("click", resetForm);
  ["searchInput", "filterCategory", "filterType"].forEach(function (id) {
    $(id).addEventListener("input", renderTransactions);
  });
  // One listener handles all Edit/Delete buttons (event delegation).
  $("txBody").addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-action]");
    if (!btn) return;
    var id = Number(btn.dataset.id);
    if (btn.dataset.action === "edit") startEdit(id); else deleteExpense(id);
  });
  updateDashboard();
}

document.addEventListener("DOMContentLoaded", init);
