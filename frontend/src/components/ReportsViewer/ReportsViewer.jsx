import { useEffect, useMemo, useState } from "react";
import { apiReports } from "../../utils/api";
import "./ReportsViewer.css";

function fmtDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString();
}

export default function ReportsViewer({ onBack }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [idx, setIdx] = useState(0);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiReports.myHistory({ limit: 200, skip: 0 });
        if (!mounted) return;

        // Backend {items:[...]} ya da doğrudan [...] dönebilir
        const list = Array.isArray(res)
          ? res
          : res?.items || res?.data || [];

        setItems(list);
        setIdx(0);
        setErr("");
      } catch (e) {
        setErr(e?.message || "Failed to load reports.");
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((r) => (r?.content || "").toLowerCase().includes(q));
  }, [items, search]);

  const current = filtered[idx] || null;

  return (
    <div className="reports-container">
      <div className="reports-header">
        <button onClick={onBack} className="btn-ghost back-btn">
          ← Back to Dashboard
        </button>
        <h1 className="title">Reports History</h1>
        <p className="subtitle">Browse and search through your past reports</p>
      </div>

      <div className="card search-card">
        <div className="search-wrapper">
          <input
            placeholder="Search reports by keyword..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIdx(0);
            }}
            className="search-input"
          />
        </div>
        {search && (
          <p className="search-info">
            Found {filtered.length} report(s) containing "{search}"
          </p>
        )}
      </div>

      {loading ? (
        <div className="card empty-card">
          <p className="empty-text">Loading...</p>
        </div>
      ) : err ? (
        <div className="card empty-card">
          <p className="empty-text">Failed to load reports. {err}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-card">
          <p className="empty-text">No reports found.</p>
        </div>
      ) : (
        <>
          <div className="nav-controls">
            <div className="nav-buttons">
              <button
                onClick={() =>
                  setIdx((p) => (p - 1 + filtered.length) % filtered.length)
                }
                disabled={filtered.length <= 1}
                className="btn-outline"
              >
                ←
              </button>
              <span className="nav-index">
                {idx + 1} of {filtered.length}
              </span>
              <button
                onClick={() => setIdx((p) => (p + 1) % filtered.length)}
                disabled={filtered.length <= 1}
                className="btn-outline"
              >
                →
              </button>
            </div>
            <div className="nav-note">Most recent reports appear first</div>
          </div>

          {current && (
            <div className="card report-card">
              <div className="card-header">
                <h2 className="report-title">
                  📅 Report for {fmtDate(current.date)}
                </h2>
                {typeof current.hours === "number" && (
                  <span className="rv-badge">{current.hours}h</span>
                )}
              </div>
              <div className="card-content">
                <p className="report-content">{current.content}</p>
              </div>
            </div>
          )}

          <div className="all-reports">
            <h3 className="section-title">All Reports</h3>
            <div className="report-grid">
              {filtered.map((r, i) => (
                <div
                  key={r.id || r._id || `${r.date}-${i}`}
                  className={`card report-thumb ${
                    i === idx ? "active-thumb" : ""
                  }`}
                  onClick={() => setIdx(i)}
                >
                  <div className="thumb-header">
                    <span className="thumb-date">{fmtDate(r.date)}</span>
                    {typeof r.hours === "number" && (
                      <span className="rv-badge">{r.hours}h</span>
                    )}
                  </div>
                  <p className="thumb-text">
                    {(r.content || "").slice(0, 100)}
                    {r.content && r.content.length > 100 ? "..." : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
