import { useEffect, useMemo, useState } from "react";
import { getReportStatus, searchReports, getUserReports } from "../../utils/api";
import "./DepartmentEmployees.css";

export default function DepartmentEmployees({
  onBack,
  adminDepartment,
  myUserId,
  headerRight = null, // başlığın sağ tarafına gelecek özel alan (dropdown vs.)
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [searchItems, setSearchItems] = useState([]);
  const [expanded, setExpanded] = useState(null);

  // per-user cache & loading
  const [userReports, setUserReports] = useState({}); // { [userId]: Report[] }
  const [userLoading, setUserLoading] = useState({}); // { [userId]: boolean }

  // Preview için
  const [openPreview, setOpenPreview] = useState(null); // raporId | null
  const togglePreview = (rid) => setOpenPreview((p) => (p === rid ? null : rid));

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const d = await getReportStatus({ department: adminDepartment, date });
        // admin kendini görmesin
        const items = (d?.items || []).filter((x) => !myUserId || x.userId !== myUserId);
        setStatus(items);
      } catch {
        setStatus([]);
      }
      setLoading(false);
    })();
  }, [adminDepartment, date, myUserId]);

  // Arama: sadece terimi saklamakla kalma; departmandaki raporları da ara
  const doSearch = async (term) => {
    setQ(term);
    setExpanded(null); // aramada açık kartı kapat
    if (!term.trim()) {
      setSearchItems([]);
      return;
    }
    try {
      const d = await searchReports({ q: term.trim(), department: adminDepartment });
      setSearchItems(d?.items || []);
    } catch {
      setSearchItems([]);
    }
  };

  const loadUser = async (uid) => {
    if (userReports[uid] || userLoading[uid]) return;
    setUserLoading((s) => ({ ...s, [uid]: true }));
    try {
      // son 10 rapor gibi davranalım (API'de limit yoksa from/to ile daraltılabilir)
      const d = await getUserReports(uid);
      setUserReports((s) => ({ ...s, [uid]: d?.items || [] }));
    } catch {
      /* ignore */
    }
    setUserLoading((s) => ({ ...s, [uid]: false }));
  };

  // Arama sonuçlarını kullanıcı ID'lerine grupla
  const hitsByUser = useMemo(() => {
    const map = new Map();
    for (const r of searchItems) {
      const uid = r.userId || r.userID || r.UserID;
      if (!uid) continue;
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid).push(r);
    }
    return map;
  }, [searchItems]);

  // Görüntülenecek çalışan listesi:
  // - admin kendisi yok
  // - arama varsa: isimde eşleşme veya kullanıcının raporlarında eşleşme olması gerekir
  const filteredStatus = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return status;
    return status.filter((emp) => {
      const nameMatch = (emp.name || "").toLowerCase().includes(term);
      const hasHit = hitsByUser.has(emp.userId);
      return nameMatch || hasHit;
    });
  }, [status, q, hitsByUser]);

  /* ---- highlight helpers ---- */
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const highlightText = (text, term) => {
    if (!term) return text;
    const rx = new RegExp(`(${escapeRegExp(term)})`, "gi");
    return String(text)
      .split(rx)
      .map((part, i) =>
        rx.test(part) ? (
          <span key={i} className="em-hi">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      );
  };
  /* -------------------------- */

  return (
    <div className="em-wrap">
      <div className="em-top">
        <button className="em-btn em-btn-ghost" onClick={onBack}>← Back to Dashboard</button>

        {/* 🔹 Başlık ve sağ slot aynı satırda */}
        <div className="em-headline">
          <h1 className="em-title">Employee Management</h1>
          {headerRight ? <div className="em-head-right">{headerRight}</div> : null}
        </div>

        <p className="em-sub">Department: <b>{adminDepartment}</b></p>
      </div>

      <div className="em-card em-mb">
        <div className="em-card-content">
          <div className="em-filters-row">
            <input
              type="date"
              className="em-input-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <div className="em-search">
              <span className="em-search-icon">🔎</span>
              <input
                className="em-input"
                placeholder="Search employees or report content…"
                value={q}
                onChange={(e) => doSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="em-card"><div className="em-card-content">Loading…</div></div>
      ) : (
        <div className="em-list">
          {filteredStatus.map((emp) => {
            const isOpen = expanded === emp.userId;
            return (
              <div className="em-card" key={emp.userId}>
                <button
                  className="em-card-header"
                  onClick={() => {
                    const next = isOpen ? null : emp.userId;
                    setExpanded(next);
                    if (!isOpen && next) loadUser(emp.userId);
                  }}
                >
                  <div className="em-head-left">
                    <div className="em-avatar">
                      <span>{(emp.name || "")
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="em-name">{q ? highlightText(emp.name, q) : emp.name}</div>
                      <div className="em-dept">{adminDepartment}</div>
                    </div>
                  </div>
                  <div className="em-head-right-row">
                    <span className={`em-badge ${emp.hasReportToday ? "em-badge-ok" : "em-badge-warn"}`}>
                      {emp.hasReportToday ? "Report Submitted" : "No Report Today"}
                    </span>
                    <span className="em-chevron">{isOpen ? "▾" : "▸"}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="em-card-content em-pt0">
                    <div className="em-divider" />
                    <h4 className="em-h4">Recent Reports</h4>

                    {userLoading[emp.userId] && <p className="em-empty">Loading…</p>}
                    {!userLoading[emp.userId] &&
                      (userReports[emp.userId]?.length ? (
                        <div className="em-reports">
                          {userReports[emp.userId].map((r) => {
                            const rid = r.id || r._id;
                            const isPreview = openPreview === rid;
                            return (
                              <div key={rid} className="em-report">
                                <div className="em-report-top">
                                  <div className="em-report-date">📅 {new Date(r.date).toLocaleDateString()}</div>

                                  <div className="em-report-actions">
                                    <button
                                      className="em-iconbtn"
                                      title={isPreview ? "Close preview" : "Preview"}
                                      onClick={() => togglePreview(rid)}
                                      aria-label="Preview report"
                                    >
                                      👁
                                    </button>
                                    <span className="em-badge em-badge-outline">⏱ {r.hours ?? 0}h</span>
                                  </div>
                                </div>

                                <p className="em-report-text">{q ? highlightText(r.content, q) : r.content}</p>

                                {isPreview && (
                                  <div className="em-preview">
                                    <div className="em-preview-top">
                                      <strong>Report Preview</strong>
                                      <button className="em-close" onClick={() => setOpenPreview(null)} aria-label="Close">✕</button>
                                    </div>
                                    <div className="em-preview-meta">
                                      <span>📅 {new Date(r.date).toLocaleString()}</span>
                                      <span>· ⏱ {r.hours ?? 0}h</span>
                                    </div>
                                    <div className="em-preview-body">
                                      {q ? highlightText(r.content, q) : r.content}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="em-empty">No recent reports</p>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
          {!filteredStatus.length && (
            <div className="em-card"><div className="em-card-content em-center">
              <p className="em-empty">No employees found.</p>
            </div></div>
          )}
        </div>
      )}
    </div>
  );
}
