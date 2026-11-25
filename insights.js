// insights.js – Smart Spend Advisor, daily safe-to-spend and chart.
// These functions only calculate/display. app.js owns the data and calls them.

var categoryChart = null; // holds the Chart.js object so we can update it

function formatMoney(amount) {
  return "₹" + Number(amount).toFixed(2);
}

// Returns today's month as "YYYY-MM" (matches the date input format).
function getCurrentMonthKey() {
  var now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
}

// Keep only expenses whose date starts with the current "YYYY-MM".
function getCurrentMonthExpenses(expenses) {
  var key = getCurrentMonthKey();
  return expenses.filter(function (e) { return e.date.startsWith(key); });
}

function sumExpenses(list) {
  return list.reduce(function (total, e) { return total + e.amount; }, 0);
}

// Builds { Food: 120, Travel: 50, ... } from a list of expenses.
function getCategoryTotals(list) {
  var totals = {};
  list.forEach(function (e) { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  return totals;
}

// Name of the category with the highest total (or null if none).
function getHighestCategory(totals) {
  var best = null;
  Object.keys(totals).forEach(function (c) { if (best === null || totals[c] > totals[best]) best = c; });
  return best;
}

// Days left in this month, counting today. Last day of month => 1.
function getDaysRemaining() {
  var now = new Date();
  var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1;
}

// Daily Safe-to-Spend = (Budget - Expenses) / Days Remaining
function calculateDailySafe(budget, spent) {
  var remaining = budget - spent;
  var days = getDaysRemaining();
  var daily = 0, message;
  if (budget <= 0) {
    message = "Set a monthly budget to see your daily safe-to-spend amount.";
  } else if (remaining <= 0) {
    daily = 0;
    message = "You have used your whole budget (over by " + formatMoney(Math.abs(remaining)) + "). Your safe daily amount is ₹0.00 – avoid spending more this month.";
  } else if (days <= 0) {
    daily = remaining;
    message = "The month is over. You have " + formatMoney(remaining) + " left to carry forward.";
  } else {
    daily = remaining / days;
    message = "You have " + formatMoney(remaining) + " left for " + days + " day" + (days === 1 ? "" : "s") + ", so you can safely spend about " + formatMoney(daily) + " per day.";
  }
  return { remaining: remaining, days: days, daily: daily, message: message };
}

// Creates the list of advice messages from real expense data.
function generateAdvice(budget, list) {
  var advice = [];
  var spent = sumExpenses(list);
  var totals = getCategoryTotals(list);

  if (budget <= 0) {
    advice.push({ type: "info", text: "Set your monthly budget so the advisor can analyse your spending." });
  }
  if (list.length === 0) {
    advice.push({ type: "info", text: "No expenses recorded this month yet. Add one to get personalised advice." });
    return advice;
  }

  if (budget > 0) {
    var percent = Math.round((spent / budget) * 100);
    if (percent >= 100) {
      advice.push({ type: "bad", text: "You have spent " + percent + "% of your monthly budget – you are over budget. Stop non-essential spending." });
    } else if (percent >= 80) {
      advice.push({ type: "warn", text: "You have spent " + percent + "% of your monthly budget. Try reducing unnecessary expenses." });
    } else {
      advice.push({ type: "good", text: "Your spending is currently within your budget (" + percent + "% used). Keep it up!" });
    }
  }

  var top = getHighestCategory(totals);
  var topShare = Math.round((totals[top] / spent) * 100);
  advice.push({ type: "info", text: top + " is your highest spending category this month (" + formatMoney(totals[top]) + ", " + topShare + "% of spending)." });
  if (topShare >= 50 && Object.keys(totals).length > 1) {
    advice.push({ type: "warn", text: "More than half your spending goes to " + top + ". Look for ways to cut back there." });
  }

  var wantTotal = sumExpenses(list.filter(function (e) { return e.type === "Want"; }));
  var wantShare = Math.round((wantTotal / spent) * 100);
  if (wantShare > 40) {
    advice.push({ type: "warn", text: wantShare + "% of your spending is on Wants. Try shifting some money to Needs or savings." });
  } else {
    advice.push({ type: "good", text: "Only " + wantShare + "% of your spending is on Wants – a healthy balance." });
  }
  return advice;
}

function renderAdvisor(budget, list) {
  var ul = document.getElementById("advisorList");
  ul.innerHTML = "";
  generateAdvice(budget, list).forEach(function (a) {
    var li = document.createElement("li");
    li.className = a.type;
    li.textContent = a.text;
    ul.appendChild(li);
  });
}

// Doughnut chart + text summary for the current month.
function renderSpendingAnalysis(list) {
  var totals = getCategoryTotals(list);
  var labels = Object.keys(totals);
  var values = labels.map(function (c) { return totals[c]; });
  var canvas = document.getElementById("categoryChart");
  var empty = document.getElementById("chartEmpty");
  var summary = document.getElementById("summaryList");
  var hasData = labels.length > 0;

  canvas.classList.toggle("d-none", !hasData);
  empty.classList.toggle("d-none", hasData);

  var colors = ["#7c3aed", "#0f1b3d", "#a78bfa", "#3b5bdb", "#c4b5fd", "#64708f"];
  if (categoryChart) {            // update the existing chart
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = values;
    categoryChart.update();
  } else if (typeof Chart !== "undefined") {   // first time: create it
    categoryChart = new Chart(canvas, {
      type: "doughnut",
      data: { labels: labels, datasets: [{ data: values, backgroundColor: colors }] },
      options: { plugins: { legend: { position: "bottom" } } }
    });
  }

  var spent = sumExpenses(list);
  summary.innerHTML = "";
  var rows = ["Transactions this month: " + list.length, "Total spent: " + formatMoney(spent)];
  if (hasData) rows.push("Average per transaction: " + formatMoney(spent / list.length));
  labels.forEach(function (c) { rows.push(c + ": " + formatMoney(totals[c])); });
  rows.forEach(function (r) { var li = document.createElement("li"); li.textContent = r; summary.appendChild(li); });
}
