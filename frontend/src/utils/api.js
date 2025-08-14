import { getToken, logout } from "./auth";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/* -------------------- core fetch -------------------- */
export async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });

  if (res.status === 401) {
    logout();
    throw new Error("Unauthorized");
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data;
}

/* -------------------- AUTH -------------------- */
export const apiAuth = {
  login(email, password) {
    return apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  register({ name, email, password, role, department }) {
    return apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role, department }),
    });
  },
  me() {
    return apiFetch("/me");
  },
};

/* -------------------- REPORTS -------------------- */
export const apiReports = {
  // POST /reports  (bugüne upsert)
  upsertMyReport({ content, hours }) {
    return apiFetch("/reports", {
      method: "POST",
      body: JSON.stringify({ content, hours }),
    });
  },

  // GET /reports/me/today
  myToday() {
    return apiFetch("/reports/me/today");
  },

  // GET /reports/me/history?limit=&skip=
  myHistory({ limit = 50, skip = 0 } = {}) {
    const p = new URLSearchParams();
    if (limit) p.set("limit", String(limit));
    if (skip) p.set("skip", String(skip));
    const qs = p.toString() ? `?${p.toString()}` : "";
    return apiFetch(`/reports/me/history${qs}`);
  },

  // GET /reports/today?date=YYYY-MM-DD
  today({ date } = {}) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiFetch(`/reports/today${qs}`);
  },

  // GET /reports/search?q=&department=&from=&to=
  search({ q = "", department = "", from = "", to = "" } = {}) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (department) p.set("department", department);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString() ? `?${p.toString()}` : "";
    return apiFetch(`/reports/search${qs}`);
  },

  // GET /reports/status?department=&date=
  status({ department, date } = {}) {
    const p = new URLSearchParams();
    if (department) p.set("department", department);
    if (date) p.set("date", date);
    const qs = p.toString() ? `?${p.toString()}` : "";
    return apiFetch(`/reports/status${qs}`);
  },

  // GET /reports/user/:id?from=&to=   (admin/superadmin)
  byUser({ id, from = "", to = "" } = {}) {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString() ? `?${p.toString()}` : "";
    return apiFetch(`/reports/user/${encodeURIComponent(id)}${qs}`);
  },


  // GET /reports/department/series?department=&period=7d|30d|6m|12m
departmentSeries({ department = "", period = "7d" } = {}) {
  const p = new URLSearchParams();
  if (department) p.set("department", department);
  if (period) p.set("period", period);
  const qs = p.toString() ? `?${p.toString()}` : "";
  return apiFetch(`/reports/department/series${qs}`);
},

// Department per-user breakdown
departmentBreakdown({ department = "", period = "7d", top = 5 } = {}) {
  const p = new URLSearchParams();
  if (department) p.set("department", department);
  if (period)     p.set("period", period);
  if (top != null) p.set("top", String(top));
  const qs = p.toString() ? `?${p.toString()}` : "";
  return apiFetch(`/reports/department/breakdown${qs}`);
},

};

/* -------------------- REMINDERS / MESSAGES -------------------- */

export const apiReminders = {
  // department verilirse (superadmin için): o departmana + "all"a giden aktif mesajlar
  listMy({ department = "" } = {}) {
    const p = new URLSearchParams();
    if (department) p.set("department", department);
    const qs = p.toString() ? `?${p.toString()}` : "";
    return apiFetch(`/reminders${qs}`);
  },

  listSent({ includeInactive = false } = {}) {
    const qs = includeInactive ? "?includeInactive=1" : "";
    return apiFetch(`/reminders/sent${qs}`);
  },

  create({ content, type, targetDepartment, duration }) {
    return apiFetch("/reminders", {
      method: "POST",
      body: JSON.stringify({ content, type, targetDepartment, duration }),
    });
  },

  remove(id) {
    return apiFetch(`/reminders/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

/* -------------------- ANALYTICS (Company) -------------------- */
export const apiAnalytics = {
  // GET /analytics/company?period=7d|30d|6m|12m&scope=overview|compare|both
  company({ period = "7d", scope = "both" } = {}) {
    const p = new URLSearchParams();
    if (period) p.set("period", period);
    if (scope)  p.set("scope", scope);
    const qs = p.toString() ? `?${p.toString()}` : "";
    return apiFetch(`/analytics/company${qs}`);
  },
};

/* -------------------- DEPARTMENTS -------------------- */
export const apiDepartments = {
  list() {
    return apiFetch("/departments");
  },
};

/* -------------------- HEALTH -------------------- */
export const apiHealth = {
  health() {
    return apiFetch("/health");
  },
};

/* -------- Aliases (komponentlerin kullandığı kısa isimler) -------- */
export const upsertMyReport = (payload) => apiReports.upsertMyReport(payload);
export const getMyTodayReport = () => apiReports.myToday();
export const getMyHistory = (args) => apiReports.myHistory(args);
export const getReportsToday = (args) => apiReports.today(args);
export const searchReports = (args) => apiReports.search(args);
export const getReportStatus = (args) => apiReports.status(args);
export const getUserReports = (userId, a, b) => {
  let from = "", to = "";
  if (typeof a === "object" && a !== null) {
    from = a.from || "";
    to = a.to || "";
  } else {
    from = a || "";
    to = b || "";
  }
  return apiReports.byUser({ id: userId, from, to });
};
export const getDepartments = () => apiDepartments.list();
export const listMyReminders = (args) => apiReminders.listMy(args);
export const listSentReminders = (args) => apiReminders.listSent(args);
export const createReminder = (args) => apiReminders.create(args);
export const deleteReminder = (id) => apiReminders.remove(id);
export const getCompanyAnalytics = (args) => apiAnalytics.company(args);


