import { useEffect, useState, useMemo, useCallback } from "react";
import { listMyReminders, listSentReminders, getDepartments } from "../../utils/api";
import "./MessagePanel.css";
import { on } from "../../utils/bus";
import { getUser } from "../../utils/auth";

const MINE = "__mine__";

export default function MessagePanel({ includeNoReportWarning = false }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [departments, setDepartments] = useState([]);
  const [filter, setFilter] = useState(MINE); // süperadmin: MINE | <department>
  const me = getUser();
  const isSuper = String(me?.role || "").toLowerCase() === "superadmin";

  // departmanları çek (yalnızca superadmin)
  useEffect(() => {
    if (!isSuper) return;
    let mounted = true;
    (async () => {
      try {
        const res = await getDepartments();
        if (!mounted) return;
        setDepartments(res?.departments || []);
      } catch {
        /* ignore */
      }
    })();
    return () => { mounted = false; };
  }, [isSuper]);

  // veriyi getir
  const fetchReminders = useCallback(async () => {
    try {
      let res;
      if (isSuper) {
        if (filter === MINE) {
          // kendi gönderdiğim aktif mesajlar
          res = await listSentReminders({ includeInactive: false });
        } else if (filter) {
          // seçili departmana giden aktif mesajlar (all + dept)
          res = await listMyReminders({ department: filter });
        } else {
          // fallback
          res = await listSentReminders({ includeInactive: false });
        }
      } else {
        // admin/employee: kendisinin görebileceği mesajlar
        res = await listMyReminders();
      }

      const list = Array.isArray(res) ? res : res?.items || [];
      setItems(list);
      setErr("");
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setItems([]);
        setErr("");
        return;
      }
      setErr(msg || "Failed to load messages.");
    }
  }, [isSuper, filter]);

  // ilk yükleme & filter değişince
  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  // event-bus + tab görünürlüğü
  useEffect(() => {
    const un = on("reminders:changed", fetchReminders);
    const onVis = () => { if (document.visibilityState === "visible") fetchReminders(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { un(); document.removeEventListener("visibilitychange", onVis); };
  }, [fetchReminders]);

  // Gün sonu ISO ve sentetik uyarı (çalışan panelinde kullanılabilir)
  const endOfTodayISO = useMemo(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString();
  }, []);
  const sysNoReport = useMemo(() => {
    if (!includeNoReportWarning) return null;
    return {
      id: "__sys_no_report_today",
      type: "warning",
      content: "Bugünkü raporun yüklenmedi. Lütfen gün bitmeden raporunu ekle.",
      senderName: "System",
      createdAt: new Date().toISOString(),
      expiresAt: endOfTodayISO,
      _synthetic: true,
    };
  }, [includeNoReportWarning, endOfTodayISO]);

  let display = Array.isArray(items) && !err ? items.slice() : [];
  if (sysNoReport) display.unshift(sysNoReport);

  // başlık altı bilgi
  const hint =
    isSuper
      ? (filter === MINE
          ? "Showing messages you sent."
          : `Showing messages sent to ${filter} (includes company-wide).`)
      : "";

  return (
    <div className="mp-card">
      <div className="mp-head-row">
        <div className="mp-head">Messages</div>

        {isSuper && (
          <div className="mp-filter">
            <label className="mp-filter-label">Scope</label>
            <select
              className="mp-filter-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value={MINE}>My messages</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isSuper && <div className="mp-subhint">{hint}</div>}

      <div className="mp-body">
        {display.length === 0 ? (
          <div className="mp-empty">No messages</div>
        ) : (
          <ul className="mp-list">
            {display.map((m, i) => {
              const key = m.id || m._id || i;
              const type = (m.type || "info").toLowerCase();
              const created = m.createdAt ? new Date(m.createdAt).toLocaleString() : "";
              const expires = m.expiresAt ? new Date(m.expiresAt).toLocaleString() : "";
              const dept = m.targetDepartment || m.department;
              return (
                <li key={key} className={`mp-item mp-${type}`}>
                  <div className="mp-text">{m.content}</div>
                  <div className="mp-meta">
                    {dept ? <span>• {dept === "all" ? "All Departments" : dept}</span> : null}
                    {m.senderName ? <span> • {m.senderName}</span> : null}
                    {created ? <span> • {created}</span> : null}
                    {expires ? <span> • Expires: {expires}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
