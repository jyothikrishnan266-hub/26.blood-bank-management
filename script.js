const GROUPS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"
];

const KEY = "lifeflow_blood_bank_v1";

const $ = id => document.getElementById(id);

function initialData() {
  return {
    donors: [],
    requests: [],
    stock: Object.fromEntries(GROUPS.map(group => [group, 0]))
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return initialData();

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") return initialData();

    const data = initialData();

    data.donors = Array.isArray(parsed.donors) ? parsed.donors : [];
    data.requests = Array.isArray(parsed.requests) ? parsed.requests : [];

    GROUPS.forEach(group => {
      const units = Number(parsed.stock?.[group]);
      data.stock[group] =
        Number.isSafeInteger(units) && units >= 0 ? units : 0;
    });

    return data;
  } catch {
    return initialData();
  }
}

let data = loadData();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Storage error:", error);
    alert("Could not save data. Check browser storage settings.");
    return false;
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function fillGroupSelect(id, includeAll = false) {
  const select = $(id);
  select.innerHTML = includeAll
    ? '<option value="All">All Blood Groups</option>'
    : "";

  GROUPS.forEach(group => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    select.appendChild(option);
  });
}

[
  "stockGroup",
  "donorGroup",
  "requestGroup"
].forEach(id => fillGroupSelect(id));

fillGroupSelect("donorFilter", true);

function showMessage(id, message, isError = false) {
  $(id).textContent = message;
  $(id).style.color = isError ? "#c52b39" : "#21834d";
}

function renderInventory() {
  $("inventoryGrid").innerHTML = GROUPS.map(group => `
    <div class="blood-card">
      <strong>${escapeHTML(group)}</strong>
      <span>${data.stock[group]} units</span>
    </div>
  `).join("");

  $("totalUnits").textContent = GROUPS.reduce(
    (sum, group) => sum + data.stock[group], 0
  );
}

function renderStats() {
  $("totalDonors").textContent = data.donors.length;

  $("pendingRequests").textContent = data.requests.filter(
    request => request.status === "Pending"
  ).length;

  renderInventory();
}

function renderDonors() {
  const query = $("donorSearch").value.trim().toLowerCase();
  const group = $("donorFilter").value;

  const filtered = data.donors.filter(donor => {
    const matchesQuery =
      donor.name.toLowerCase().includes(query) ||
      donor.city.toLowerCase().includes(query);

    return matchesQuery &&
      (group === "All" || donor.group === group);
  });

  $("donorTable").innerHTML = filtered.length
    ? filtered.map(donor => `
      <tr>
        <td>${escapeHTML(donor.name)}</td>
        <td>${donor.age}</td>
        <td><span class="pill">${escapeHTML(donor.group)}</span></td>
        <td>${escapeHTML(donor.phone)}</td>
        <td>${escapeHTML(donor.city)}</td>
        <td>
          <button class="delete-btn"
            data-delete-donor="${escapeHTML(donor.id)}">
            Delete
          </button>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="6" class="empty">No donors found.</td></tr>';
}

function renderRequests() {
  $("requestTable").innerHTML = data.requests.length
    ? data.requests.map(request => `
      <tr>
        <td>${escapeHTML(request.patient)}</td>
        <td>${escapeHTML(request.hospital)}</td>
        <td><span class="pill">${escapeHTML(request.group)}</span></td>
        <td>${request.units}</td>
        <td>${escapeHTML(request.status)}</td>
        <td>
          ${request.status === "Pending"
            ? `<button class="resolve-btn"
                data-fulfill="${escapeHTML(request.id)}">
                Fulfill
              </button>`
            : ""}
          <button class="delete-btn"
            data-delete-request="${escapeHTML(request.id)}">
            Delete
          </button>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="6" class="empty">No blood requests yet.</td></tr>';
}

function renderAll() {
  renderStats();
  renderDonors();
  renderRequests();
}

// Register a donor.
$("donorForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("donorName").value.trim();
  const age = Number($("donorAge").value);
  const group = $("donorGroup").value;
  const phone = $("donorPhone").value.trim();
  const city = $("donorCity").value.trim();

  if (!name || !city || !phone || !GROUPS.includes(group) ||
      !Number.isInteger(age) || age < 18 || age > 120) {
    alert("Enter valid donor details. Donor age must be at least 18.");
    return;
  }

  const donor = {
    id: createId(),
    name,
    age,
    group,
    phone,
    city
  };

  data.donors.push(donor);

  if (!persist()) {
    data.donors.pop();
    return;
  }

  event.target.reset();
  renderAll();
});

// Search and filter donors.
$("donorSearch").addEventListener("input", renderDonors);
$("donorFilter").addEventListener("change", renderDonors);

// Delete donor.
$("donorTable").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-donor]");
  if (!button) return;

  const id = button.dataset.deleteDonor;
  const donor = data.donors.find(item => item.id === id);

  if (!donor || !confirm(`Delete donor ${donor.name}?`)) return;

  const previous = data.donors;
  data.donors = previous.filter(item => item.id !== id);

  if (!persist()) {
    data.donors = previous;
    return;
  }

  renderAll();
});

// Add or remove stock.
$("stockForm").addEventListener("submit", event => {
  event.preventDefault();

  const group = $("stockGroup").value;
  const units = Number($("stockUnits").value);
  const action = $("stockAction").value;

  if (!GROUPS.includes(group) ||
      !Number.isSafeInteger(units) || units < 1 || units > 10000) {
    showMessage("stockMessage", "Enter a valid number of units.", true);
    return;
  }

  const previous = data.stock[group];
  const next = action === "add"
    ? previous + units
    : previous - units;

  if (!Number.isSafeInteger(next) || next < 0) {
    showMessage(
      "stockMessage",
      "Insufficient stock. Cannot remove more units than available.",
      true
    );
    return;
  }

  data.stock[group] = next;

  if (!persist()) {
    data.stock[group] = previous;
    return;
  }

  $("stockUnits").value = "";
  showMessage("stockMessage", "Blood inventory updated.");
  renderAll();
});

// Submit a blood request.
$("requestForm").addEventListener("submit", event => {
  event.preventDefault();

  const patient = $("patientName").value.trim();
  const hospital = $("hospital").value.trim();
  const group = $("requestGroup").value;
  const units = Number($("requestUnits").value);

  if (!patient || !hospital || !GROUPS.includes(group) ||
      !Number.isSafeInteger(units) || units < 1 || units > 1000) {
    showMessage("requestMessage", "Enter valid request details.", true);
    return;
  }

  const request = {
    id: createId(),
    patient,
    hospital,
    group,
    units,
    status: "Pending"
  };

  data.requests.push(request);

  if (!persist()) {
    data.requests.pop();
    return;
  }

  event.target.reset();
  showMessage(
    "requestMessage",
    "Request recorded as Pending. Stock has not been issued."
  );
  renderAll();
});

// Fulfill a request only if sufficient stock is recorded.
// This is a demonstration workflow, not clinical compatibility approval.
$("requestTable").addEventListener("click", event => {
  const fulfillButton = event.target.closest("[data-fulfill]");
  const deleteButton = event.target.closest("[data-delete-request]");

  if (fulfillButton) {
    const request = data.requests.find(
      item => item.id === fulfillButton.dataset.fulfill
    );

    if (!request || request.status !== "Pending") return;

    if (data.stock[request.group] < request.units) {
      alert(`Insufficient recorded ${request.group} stock.`);
      return;
    }

    const message =
      `Fulfill request for ${request.patient}?\n` +
      `${request.units} unit(s) of ${request.group} will be deducted.\n` +
      "Confirm only after authorized compatibility and release checks.";

    if (!confirm(message)) return;

    const oldStock = data.stock[request.group];
    const oldStatus = request.status;

    data.stock[request.group] -= request.units;
    request.status = "Fulfilled";

    if (!persist()) {
      data.stock[request.group] = oldStock;
      request.status = oldStatus;
      return;
    }

    showMessage("requestMessage", "Request marked fulfilled.");
    renderAll();
    return;
  }

  if (deleteButton) {
    const id = deleteButton.dataset.deleteRequest;
    const request = data.requests.find(item => item.id === id);

    if (!request || !confirm("Delete this blood request?")) return;

    const previous = data.requests;
    data.requests = previous.filter(item => item.id !== id);

    if (!persist()) {
      data.requests = previous;
      return;
    }

    renderAll();
  }
});

renderAll();