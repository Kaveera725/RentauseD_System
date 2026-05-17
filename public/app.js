const statusMessage = document.getElementById("statusMessage");
const itemList = document.getElementById("itemList");
const bookingList = document.getElementById("bookingList");
const notificationList = document.getElementById("notificationList");
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
}

async function refreshNotifications() {
  const { notifications } = await api("/api/notifications");
  renderList(notificationList, notifications, notificationCard);
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
  await refreshBookings();
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
    await refreshBookings();
    await refreshNotifications();
  } catch (_error) {
    bookingList.innerHTML = "<p class='hint'>Login to see your bookings.</p>";
    notificationList.innerHTML = "<p class='hint'>Login to see notifications.</p>";
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
