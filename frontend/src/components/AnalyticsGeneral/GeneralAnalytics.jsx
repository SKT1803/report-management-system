import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { getCompanyAnalytics } from "../../utils/api";

import "./GeneralAnalytics.css";

const PERIODS = [
  { value: "7d",  label: "Weekly (last 7 days)" },
  { value: "30d", label: "Last 1 Month (daily)" },
  { value: "6m",  label: "Last 6 Months (monthly)" },
  { value: "12m", label: "Last 1 Year (monthly)" },
];

const COLORS = [
  "#3b82f6","#22c55e","#ef4444","#a855f7","#f59e0b",
  "#06b6d4","#eab308","#10b981","#f97316","#64748b",
];

export default function GeneralAnalytics({ onBack }) {
  const [period, setPeriod] = useState("7d");
  const [scope, setScope] = useState("overview"); // "overview" | "compare"

  const [stats, setStats] = useState({ totalEmployees:0,reportsToday:0,departments:0,avgHours:0 });
  const [overview, setOverview] = useState([]); // [{department, employees, reportsToday}]
  const [cmp, setCmp] = useState({ labels: [], series: [] }); // {labels, series:[{department,points:[]}]}

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const chartRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // Yalnızca aktif scope için veri iste
        const res = await getCompanyAnalytics({ period, scope });
        if (!alive) return;

        const s = res?.stats || {};
        setStats({
          totalEmployees: Number(s.totalEmployees || 0),
          reportsToday:   Number(s.reportsToday   || 0),
          departments:    Number(s.departments    || 0),
          avgHours:       Number(s.avgHours       || 0),
        });

        if (scope === "overview") {
          setOverview(Array.isArray(res?.overview) ? res.overview : []);
          setCmp({ labels: [], series: [] }); // diğer scope’u temizle
        } else if (scope === "compare") {
          const co = res?.compare || { labels: [], series: [] };
          setCmp({
            labels: Array.isArray(co.labels) ? co.labels : [],
            series: Array.isArray(co.series) ? co.series : [],
          });
          setOverview([]); // diğer scope’u temizle
        }
      } catch (e) {
        setErr(e?.message || "Failed to load");
        setStats({ totalEmployees:0,reportsToday:0,departments:0,avgHours:0 });
        setOverview([]);
        setCmp({ labels: [], series: [] });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [period, scope]);

  // comparison grafiği için Recharts datası
  const compareData = useMemo(() => {
    if (!cmp.labels?.length) return [];
    return cmp.labels.map((lbl, i) => {
      const row = { label: lbl };
      for (const s of (cmp.series || [])) {
        row[s.department] = (s.points || [])[i] || 0;
      }
      return row;
    });
  }, [cmp]);

  const hasCompare = compareData.length > 0 && (cmp.series?.length || 0) > 0;

 return (
    <div className="ga-wrap">
      <button className="btn-ghost ga-back" onClick={onBack}>← Back to Dashboard</button>

      <div className="ga-head-row">
        <h1 className="ga-title">Company Overview</h1>
        <div className="ga-controls">
          <label className="ga-label">Scope</label>
          <select className="ga-select" value={scope} onChange={(e)=>setScope(e.target.value)}>
            <option value="overview">Department Overview</option>
            <option value="compare">Departments Comparison</option>
          </select>

          <label className="ga-label">Period</label>
          <select className="ga-select" value={period} onChange={(e)=>setPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {scope === "overview" && (
        <div className="ga-stats">
          <div className="ga-stat"><div className="ga-stat-k">Total Employees</div><div className="ga-stat-v">{stats.totalEmployees}</div></div>
          <div className="ga-stat"><div className="ga-stat-k">Reports Today</div><div className="ga-stat-v">{stats.reportsToday}</div></div>
          <div className="ga-stat"><div className="ga-stat-k">Departments</div><div className="ga-stat-v">{stats.departments}</div></div>
          <div className="ga-stat"><div className="ga-stat-k">Avg Hours</div><div className="ga-stat-v">{stats.avgHours.toFixed(1)}h</div></div>
        </div>
      )}

      <div className="ga-card">
        <div className="ga-card-title">
          {scope === "overview" ? "Department Overview" : "Departments Comparison"}
        </div>
        <div className="ga-card-body" ref={chartRef}>
          {loading ? (
            <div className="ga-nodata">Loading…</div>
          ) : err ? (
            <div className="ga-nodata">{err}</div>
          ) : scope === "overview" ? (
            overview.length === 0 ? (
              <div className="ga-nodata">No data</div>
            ) : (
              <ul className="ga-overview-list">
                {overview.map((d, i) => {
                  const total = Math.max(d.employees || 0, 1);
                  const ratio = Math.min(100, Math.round(((d.reportsToday || 0) / total) * 100));
                  return (
                    <li key={d.department + i} className="ga-ov-item">
                      <div className="ga-ov-left">
                        <div className="ga-ov-name">{d.department}</div>
                        <div className="ga-ov-sub">{d.employees} employees</div>
                      </div>

                      <div className="ga-ov-mid">
                        <div className="ga-ov-bar">
                          <div className="ga-ov-fill" style={{ width: `${ratio}%` }} />
                        </div>
                        <div className="ga-ov-meta">
                          {d.reportsToday}/{d.employees} reports today
                        </div>
                      </div>

                      {/*  yeni: departman avg hours (seçili period) */}
                      <div className="ga-ov-right">
                        Avg. H.: {Number(d.avgHours || 0).toFixed(1)}h
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : hasCompare ? (
            <div className="ga-chart">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {(cmp.series || []).map((s, i) => (
                    <Line
                      key={s.department}
                      type="monotone"
                      dataKey={s.department}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="ga-nodata">No data for the selected period</div>
          )}
        </div>
      </div>
    </div>
  );
}
