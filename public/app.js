const statusMessage = document.getElementById("statusMessage");
const itemList = document.getElementById("itemList");
const bookingList = document.getElementById("bookingList");
const notificationList = document.getElementById("notificationList");
const ownerDashboard = document.getElementById("ownerDashboard");
const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.getElementById("calendarGrid");
const calendarList = document.getElementById("calendarList");
const adminItems = document.getElementById("adminItems");
const adminBookings = document.getElementById("adminBookings");
const adminStats = document.getElementById("adminStats");

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function setStatus(text) {
  statusMessage.textContent = text;
}

function renderList(container, items, renderer) {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = "<p class='hint'>Nothing here yet.</p>";
    return;
  }
  items.forEach((item) => container.appendChild(renderer(item)));
}

function itemCard(item) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    ${item.image_path ? `<img src="${item.image_path}" alt="${item.title}" />` : ""}
    <strong>${item.title}</strong>
    <span>${item.category} • ${item.location}</span>
    <span>$${item.price_per_day}/day</span>
    <span class="hint">Owner: ${item.owner_name}</span>
    <button class="btn btn--ghost" data-id="${item.id}">Request booking</button>
  `;
  card.querySelector("button").addEventListener("click", () => openBooking(item.id));
  return card;
}

function bookingCard(booking) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <strong>${booking.item_title}</strong>
    <span>${booking.start_date} → ${booking.end_date}</span>
    <span>Status: ${booking.status}</span>
  `;
  return card;
}

function notificationCard(notification) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <span>${notification.message}</span>
    <span class="hint">${new Date(notification.created_at).toLocaleString()}</span>
  `;
  return card;
}

function ownerItemCard(item, bookings) {
  const card = document.createElement("div");
  card.className = "card";
  const statusLine = item.status === "rejected" && item.rejection_reason
    ? `Rejected: ${item.rejection_reason}`
    : `Status: ${item.status}`;
  const bookingHtml = bookings.length
    ? bookings
        .map(
          (booking) =>
            `<li>${booking.start_date} → ${booking.end_date} • ${booking.status} • ${booking.renter_name}</li>`
        )
        .join("")
    : "<li class='hint'>No bookings yet.</li>";
  card.innerHTML = `
    <strong>${item.title}</strong>
    <span class="hint">${statusLine}</span>
    <ul class="owner-bookings">${bookingHtml}</ul>
  `;
  return card;
}

function parseYmd(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatMonthTitle(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function buildBookedDaySet(bookings, viewDate) {
  const bookedDays = new Set();
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  bookings.forEach((booking) => {
    const start = parseYmd(booking.start_date);
    const end = parseYmd(booking.end_date);
    const rangeStart = start > monthStart ? start : monthStart;
    const rangeEnd = end < monthEnd ? end : monthEnd;
    if (rangeStart > rangeEnd) {
      return;
    }
    let current = rangeStart;
    while (current <= rangeEnd) {
      bookedDays.add(current.getDate());
      current = addDays(current, 1);
    }
  });
  return bookedDays;
}

function renderCalendar(bookings) {
  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
  calendarTitle.textContent = formatMonthTitle(viewDate);
  calendarGrid.innerHTML = "";

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  labels.forEach((label) => {
    const cell = document.createElement("div");
    cell.className = "calendar__cell calendar__cell--label";
    cell.textContent = label;
    calendarGrid.appendChild(cell);
  });

  const firstDay = viewDate.getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const bookedDays = buildBookedDaySet(bookings, viewDate);

  for (let i = 0; i < firstDay; i += 1) {
    const empty = document.createElement("div");
    empty.className = "calendar__cell";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement("div");
    const isBooked = bookedDays.has(day);
    cell.className = `calendar__cell${isBooked ? " calendar__cell--booked" : ""}`;
    cell.innerHTML = `
      <span>${day}</span>
      ${isBooked ? "<span class='calendar__dot'></span>" : ""}
    `;
    calendarGrid.appendChild(cell);
  }

  const upcoming = bookings
    .filter((booking) => parseYmd(booking.end_date) >= today)
    .sort((a, b) => parseYmd(a.start_date) - parseYmd(b.start_date))
    .slice(0, 6)
    .map(
      (booking) =>
        `<div class="card"><strong>${booking.item_title}</strong><span>${booking.start_date} → ${booking.end_date}</span><span class="hint">${booking.status}</span></div>`
    )
    .join("");

  calendarList.innerHTML = upcoming || "<p class='hint'>No upcoming bookings.</p>";
}

function adminItemCard(item) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <strong>${item.title}</strong>
    <span>Owner: ${item.owner_name}</span>
    <div class="hint">${item.description}</div>
    <div class="hint">${item.category} • ${item.location}</div>
    <div class="hint">$${item.price_per_day}/day</div>
    <div class="admin-actions">
      <button class="btn" data-action="approve">Approve</button>
      <button class="btn btn--ghost" data-action="reject">Reject</button>
    </div>
  `;
  card.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const approved = button.dataset.action === "approve";
      const reason = approved ? "" : prompt("Rejection reason?") || "";
      updateItem(item.id, approved, reason);
    });
  });
  return card;
}

function adminBookingCard(booking) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <strong>${booking.item_title}</strong>
    <span>Renter: ${booking.renter_name}</span>
    <span>${booking.start_date} → ${booking.end_date}</span>
    <div class="admin-actions">
      <button class="btn" data-action="approve">Approve</button>
      <button class="btn btn--ghost" data-action="reject">Reject</button>
    </div>
  `;
  card.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const approved = button.dataset.action === "approve";
      const reason = approved ? "" : prompt("Rejection reason?") || "";
      updateBooking(booking.id, approved, reason);
    });
  });
  return card;
}

async function refreshMe() {
  const { user } = await api("/api/me");
  if (!user) {
    setStatus("Not logged in.");
    return null;
  }
  setStatus(`Logged in as ${user.name} (${user.role}).`);
  return user;
}

async function refreshItems() {
  const { items } = await api("/api/items");
  renderList(itemList, items, itemCard);
}

async function refreshBookings() {
  const { bookings } = await api("/api/bookings/my");
  renderList(bookingList, bookings, bookingCard);
  return bookings;
}

async function refreshNotifications() {
  const { notifications } = await api("/api/notifications");
  renderList(notificationList, notifications, notificationCard);
}

async function refreshOwnerDashboard() {
  const { items, bookings } = await api("/api/owner/dashboard");
  const bookingMap = bookings.reduce((map, booking) => {
    if (!map[booking.item_id]) {
      map[booking.item_id] = [];
    }
    map[booking.item_id].push(booking);
    return map;
  }, {});
  renderList(ownerDashboard, items, (item) => ownerItemCard(item, bookingMap[item.id] || []));
}

async function refreshAdmin() {
  try {
    const [items, bookings, stats] = await Promise.all([
      api("/api/admin/items"),
      api("/api/admin/bookings"),
      api("/api/admin/stats")
    ]);
    renderList(adminItems, items.items, adminItemCard);
    renderList(adminBookings, bookings.bookings, adminBookingCard);
    adminStats.innerHTML = `
      <div class="card">Users: ${stats.users}</div>
      <div class="card">Items: ${stats.items}</div>
      <div class="card">Bookings: ${stats.bookings}</div>
    `;
  } catch (error) {
    adminItems.innerHTML = "<p class='hint'>Admin access required.</p>";
    adminBookings.innerHTML = "";
    adminStats.innerHTML = "";
  }
}

async function openBooking(itemId) {
  const startDate = prompt("Start date (YYYY-MM-DD)");
  const endDate = prompt("End date (YYYY-MM-DD)");
  if (!startDate || !endDate) {
    return;
  }
  await api("/api/bookings", {
    method: "POST",
    body: JSON.stringify({ itemId, startDate, endDate })
  });
  setStatus("Booking request submitted.");
  const bookings = await refreshBookings();
  renderCalendar(bookings);
}

async function updateItem(itemId, approved, reason) {
  await api(`/api/admin/items/${itemId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approved, reason })
  });
  await refreshAdmin();
}

async function updateBooking(bookingId, approved, reason) {
  await api(`/api/admin/bookings/${bookingId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approved, reason })
  });
  await refreshAdmin();
}

async function boot() {
  await refreshMe();
  await refreshItems();
  try {
    const bookings = await refreshBookings();
    await refreshNotifications();
    await refreshOwnerDashboard();
    renderCalendar(bookings);
  } catch (_error) {
    bookingList.innerHTML = "<p class='hint'>Login to see your bookings.</p>";
    notificationList.innerHTML = "<p class='hint'>Login to see notifications.</p>";
    ownerDashboard.innerHTML = "<p class='hint'>Login as an owner to see item history.</p>";
    calendarTitle.textContent = "Booking calendar";
    calendarGrid.innerHTML = "";
    calendarList.innerHTML = "<p class='hint'>Login to see upcoming bookings.</p>";
  }
  await refreshAdmin();
}

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const itemForm = document.getElementById("itemForm");
const reviewForm = document.getElementById("reviewForm");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await boot();
  } catch (error) {
    setStatus(error.message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setStatus("Registered. Please log in.");
  } catch (error) {
    setStatus(error.message);
  }
});

itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(itemForm);
  try {
    await api("/api/items", {
      method: "POST",
      body: formData
    });
    setStatus("Item submitted for approval.");
    itemForm.reset();
  } catch (error) {
    setStatus(error.message);
  }
});

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(reviewForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api("/api/reviews", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setStatus("Review submitted.");
    reviewForm.reset();
  } catch (error) {
    setStatus(error.message);
  }
});

const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  await boot();
});

document.getElementById("refreshItems").addEventListener("click", refreshItems);
document.getElementById("refreshAdmin").addEventListener("click", refreshAdmin);

boot();
