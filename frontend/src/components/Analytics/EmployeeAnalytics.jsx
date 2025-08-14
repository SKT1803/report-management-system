import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { apiReports, apiAuth, getDepartments } from "../../utils/api";

import "./EmployeeAnalytics.css";

/* -------------------- helpers -------------------- */
function ymKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeNDaysDailySeriesFromMap(byDateHours, n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = ymd(d);
    out.push({
      label: d.toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
      }),
      hours: byDateHours.get(key) ?? 0,
    });
  }
  return out;
}

function makeNDaysDailySeries(items, n) {
  const byDate = new Map(items.map((r) => [r.date, Number(r.hours ?? 0)]));
  return makeNDaysDailySeriesFromMap(byDate, n);
}

function makeLastNMonthsSeries(items, n) {
  const monthTotals = new Map();

  for (const r of items) {
    if (!r?.date) continue;
    const k = r.date.slice(0, 7);
    const h = Number(r.hours ?? 0);
    monthTotals.set(k, (monthTotals.get(k) ?? 0) + h);
  }

  const out = [];
  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cur);
    d.setMonth(cur.getMonth() - i);
    const key = ymKey(d);
    const label = d.toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
    out.push({ label, hours: monthTotals.get(key) ?? 0 });
  }

  return out;
}

/* -------------------- constants -------------------- */
const PERIODS = [
  { value: "7d", label: "Weekly (last 7 days)" },
  { value: "30d", label: "Last 1 Month (daily)" },
  { value: "6m", label: "Last 6 Months (monthly)" },
  { value: "12m", label: "Last 1 Year (monthly)" },
];

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#a855f7",
  "#f59e0b",
  "#06b6d4",
  "#eab308",
  "#10b981",
  "#f97316",
  "#64748b",
  "#1f2937",
  "#14b8a6",
  "#db2777",
  "#84cc16",
  "#0ea5e9",
];

const escCSV = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCSV(rows, headers, filename) {
  if (!rows?.length) return;

  const header = headers.map(escCSV).join(",");
  const body = rows
    .map((r) => headers.map((h) => escCSV(r[h])).join(","))
    .join("\n");
  const csv = "\ufeff" + header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");

  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".csv") ? filename : filename + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadSVGAsPNG(svgEl, filename) {
  if (!svgEl) return;

  const serializer = new XMLSerializer();
  let svgStr = serializer.serializeToString(svgEl);

  if (!/xmlns=/.test(svgStr))
    svgStr = svgStr.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const { width, height } = svgEl.getBoundingClientRect();
  const img = new Image();

  await new Promise((res) => {
    img.onload = res;
    img.src = url;
  });

  const canvas = document.createElement("canvas");

  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  await new Promise((res) =>
    canvas.toBlob((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = filename.endsWith(".png") ? filename : filename + ".png";
      a.click();
      URL.revokeObjectURL(a.href);
      res();
    })
  );
  URL.revokeObjectURL(url);
}

export default function EmployeeAnalytics({
  onBack,
  userType = "employee",
  initialDepartment = "",
}) {
  // self
  const [allReports, setAllReports] = useState([]);

  // departments (for superadmin)
  const isAdminLike = userType === "admin" || userType === "superadmin";
  const [departments, setDepartments] = useState([]);
  const [deptName, setDeptName] = useState("");

  // department data
  const [deptSeries, setDeptSeries] = useState([]);
  const [deptCards, setDeptCards] = useState({
    totalHours: 0,
    avgHours: 0,
    reportsToday: 0,
    activeEmployees: 0,
  });

  const [deptTop, setDeptTop] = useState([]);

  // compare
  const [cmpData, setCmpData] = useState({ labels: [], series: [] });
  const [cmpMode, setCmpMode] = useState("top"); // "top" | "all"
  const [cmpTop, setCmpTop] = useState(5);

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7d");
  const [error, setError] = useState("");

  // superadmin: default scope "department"; diğerleri "me"
  const [scope, setScope] = useState(
    userType === "superadmin" ? "department" : "me"
  );

  // export ref
  const chartRef = useRef(null);

  // dışarıdan verilen departman değişirse senkronla
  useEffect(() => {
    if (initialDepartment && initialDepartment !== deptName)
      setDeptName(initialDepartment);
  }, [initialDepartment]); // eslint-disable-line

  // superadmin için departman listesini çek + varsayılanı belirle
  useEffect(() => {
    if (userType !== "superadmin") return;
    let mounted = true;
    (async () => {
      try {
        const d = await getDepartments();
        if (!mounted) return;
        const list = d?.departments || [];
        setDepartments(list);

        // deptName yoksa veya listede yoksa ilkini seç
        if ((!deptName || !list.includes(deptName)) && list.length) {
          setDeptName(list[0]);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userType]); // deptName'ı eklemiyoruz -> döngü olmasın

  // veri çekme
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        if (scope === "me") {
          const res = await apiReports.myHistory({ limit: 1000, skip: 0 });
          const list = Array.isArray(res) ? res : res?.items || [];
          const normalized = list.map((r) => ({
            date: r.date,
            hours: Number(r.hours ?? 0),
          }));
          if (!mounted) return;
          setAllReports(normalized);
          setCmpData({ labels: [], series: [] });
          return;
        }

        // --- departman belirleme ---
        let dept = deptName;
        if (!dept) {
          if (userType === "superadmin") {
            // liste henüz gelmediyse bekle
            if (departments.length === 0) {
              setLoading(false);
              return;
            }

            dept = departments[0];

            if (!mounted) return;

            setDeptName(dept);
          } else if (initialDepartment) {
            dept = initialDepartment;

            if (!mounted) return;

            setDeptName(initialDepartment);
          } else {
            const me = await apiAuth.me();
            dept = (me?.user || me)?.department || "";

            if (!mounted) return;

            setDeptName(dept);
          }
        }
        if (!dept) {
          setLoading(false);
          return;
        }

        if (scope === "department") {
          const res = await apiReports.departmentSeries({
            department: dept,
            period,
          });

          const data = res || {};
          const cards = data.cards ?? {
            totalHours: data.totalHours ?? 0,
            avgHours: data.avgHours ?? data.avgHoursPerReport ?? 0,
            reportsToday: data.reportsToday ?? 0,
            activeEmployees: data.activeEmployees ?? 0,
          };

          if (!mounted) return;

          setDeptSeries(data.series ?? []);
          setDeptCards(cards);
          setDeptTop(data.top ?? []);
          setCmpData({ labels: [], series: [] });
        } else if (scope === "compare") {
          const topParam = cmpMode === "all" ? null : cmpTop;
          const res = await apiReports.departmentBreakdown({
            department: dept,
            period,
            top: topParam,
          });

          if (!mounted) return;
          setCmpData({
            labels: Array.isArray(res?.labels) ? res.labels : [],
            series: Array.isArray(res?.series) ? res.series : [],
          });
          setDeptSeries([]);
          setDeptTop([]);
        }
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load");
        setAllReports([]);
        setDeptSeries([]);
        setDeptCards({
          totalHours: 0,
          avgHours: 0,
          reportsToday: 0,
          activeEmployees: 0,
        });
        setDeptTop([]);
        setCmpData({ labels: [], series: [] });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [scope, period, cmpMode, cmpTop, deptName, userType, departments.length]);

  // titles
  const { title, series } = useMemo(() => {
    if (scope === "me") {
      switch (period) {
        case "7d":
          return {
            title: "Daily Working Hours (Last 7 days)",
            series: makeNDaysDailySeries(allReports, 7),
          };
        case "30d":
          return {
            title: "Daily Working Hours (Last 30 days)",
            series: makeNDaysDailySeries(allReports, 30),
          };
        case "6m":
          return {
            title: "Monthly Hours (Last 6 months)",
            series: makeLastNMonthsSeries(allReports, 6),
          };
        case "12m":
          return {
            title: "Monthly Hours (Last 12 months)",
            series: makeLastNMonthsSeries(allReports, 12),
          };
        default:
          return { title: "", series: [] };
      }
    } else if (scope === "department") {
      const labels = {
        "7d": "Last 7 days",
        "30d": "Last 30 days",
        "6m": "Last 6 months",
        "12m": "Last 12 months",
      };
      return {
        title: `Department Hours (${deptName}) • ${labels[period] || ""}`,
        series: deptSeries,
      };
    }
    return { title: "", series: [] };
  }, [period, allReports, scope, deptSeries, deptName]);

  const compareChartData = useMemo(() => {
    if (scope !== "compare" || !cmpData?.labels?.length) return [];
    return cmpData.labels.map((lbl, i) => {
      const row = { label: lbl };
      for (const s of cmpData.series || []) {
        row[s.userName || s.userId] = (s.points || [])[i] || 0;
      }
      return row;
    });
  }, [scope, cmpData]);

  const allZero =
    series.length > 0 && series.every((s) => (s.hours ?? 0) === 0);
  const headerTitle =
    scope === "compare"
      ? `Compare Employees (${deptName}) • ${
          PERIODS.find((p) => p.value === period)?.label || ""
        }`
      : title;

  const fileBase = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const per = period;
    if (scope === "me") return `my-hours_${per}_${today}`;
    if (scope === "department")
      return `dept-${deptName || "dept"}_${per}_${today}`;
    return `compare-${deptName || "dept"}_${per}_${today}`;
  }, [scope, deptName, period]);

  const hasChartData =
    scope === "compare"
      ? compareChartData.length > 0
      : series.length > 0 && !allZero;
  const onExportCSV = () => {
    if (!hasChartData) return;
    if (scope === "compare") {
      const cols = [
        "label",
        ...(cmpData.series || []).map((s) => s.userName || s.userId),
      ];
      downloadCSV(compareChartData, cols, `${fileBase}.csv`);
    } else {
      const rows = series.map((r) => ({ label: r.label, hours: r.hours }));
      downloadCSV(rows, ["label", "hours"], `${fileBase}.csv`);
    }
  };
  const onExportPNG = async () => {
    if (!hasChartData) return;
    const svg = chartRef.current?.querySelector("svg");
    await downloadSVGAsPNG(svg, `${fileBase}.png`);
  };

  return (
    <div className="ac-page">
      <button className="btn-ghost ac-back" onClick={onBack}>
        ← Back to Dashboard
      </button>

      {/* HEADER: title + (superadmin) department switch on the right */}
      <div className="ac-head">
        <h1 className="ac-h1">Working Hours & Activity</h1>
        {userType === "superadmin" && (
          <div className="ac-dept-switch">
            <label className="ac-label">Department</label>
            <select
              className="ac-select"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <p className="ac-sub">Track your work time and trends</p>

      <div className="ac-controls">
        {isAdminLike && (
          <>
            <label className="ac-label">Scope</label>
            <select
              className="ac-select"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              {userType !== "superadmin" && (
                <option value="me">My activity</option>
              )}
              <option value="department">Department ({deptName || "…"})</option>
              <option value="compare">Compare employees</option>
            </select>
          </>
        )}
        <label className="ac-label">Period</label>
        <select
          className="ac-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {scope === "compare" && (
          <>
            <label className="ac-label">Show</label>
            <select
              className="ac-select"
              value={cmpMode === "all" ? "all" : `top-${cmpTop}`}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all") {
                  setCmpMode("all");
                } else {
                  setCmpMode("top");
                  setCmpTop(Number(v.replace("top-", "")) || 5);
                }
              }}
            >
              <option value="top-3">Top 3</option>
              <option value="top-5">Top 5</option>
              <option value="top-10">Top 10</option>
              <option value="all">All employees</option>
            </select>
          </>
        )}
      </div>

      <div className="ac-card">
        <div className="ac-card-header">
          <h3 className="ac-title-sm">{headerTitle}</h3>
          <div className="ac-export">
            <button
              className="btn-sm"
              onClick={onExportCSV}
              disabled={!hasChartData}
            >
              Export CSV
            </button>
            <button
              className="btn-sm"
              onClick={onExportPNG}
              disabled={!hasChartData}
            >
              Export PNG
            </button>
          </div>
        </div>

        <div className="ac-card-content" ref={chartRef}>
          {loading ? (
            <div className="ac-nodata">Loading…</div>
          ) : error ? (
            <div className="ac-nodata">{error}</div>
          ) : scope === "compare" ? (
            compareChartData.length === 0 ? (
              <div className="ac-nodata">No data for the selected period</div>
            ) : (
              <div className="ac-chart">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={compareChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      labelClassName="ac-tooltip-label"
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Legend />
                    {(cmpData.series || []).map((s, i) => (
                      <Line
                        key={s.userId}
                        type="monotone"
                        dataKey={s.userName || s.userId}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className="ac-sub" style={{ marginTop: 8 }}>
                  {cmpMode === "all"
                    ? `Showing all ${
                        cmpData.series?.length || 0
                      } employees with activity in period.`
                    : `Showing top ${
                        cmpData.series?.length || 0
                      } employees by total hours in period.`}
                </div>
              </div>
            )
          ) : allZero ? (
            <div className="ac-nodata">No data for the selected period</div>
          ) : (
            <div className="ac-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(v) => [v, "Hours"]}
                    labelClassName="ac-tooltip-label"
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Bar
                    dataKey="hours"
                    name="Hours"
                    fill="var(--color-hours)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {isAdminLike && scope === "department" && (
        <div className="ac-dept-bottom">
          <div className="ac-stats-row">
            <div className="ac-stat">
              <div className="ac-stat-k">Total hours</div>
              <div className="ac-stat-v">{deptCards.totalHours}</div>
            </div>
            <div className="ac-stat">
              <div className="ac-stat-k">Avg hours / report</div>
              <div className="ac-stat-v">{deptCards.avgHours}</div>
            </div>
            <div className="ac-stat">
              <div className="ac-stat-k">Reports today</div>
              <div className="ac-stat-v">{deptCards.reportsToday}</div>
            </div>
            <div className="ac-stat">
              <div className="ac-stat-k">Active employees</div>
              <div className="ac-stat-v">{deptCards.activeEmployees}</div>
            </div>
          </div>

          <div className="ac-leader">
            <h4 className="ac-leader-title">Top contributors</h4>
            {deptTop.length === 0 ? (
              <div className="ac-nodata" style={{ height: 120 }}>
                No data
              </div>
            ) : (
              <ul className="ac-leader-list">
                {deptTop.map((u, i) => (
                  <li
                    key={(u.userId || u.userName || i) + ""}
                    className="ac-leader-item"
                  >
                    <span className="ac-leader-rank">{i + 1}</span>
                    <span className="ac-leader-name">{u.userName}</span>
                    <span className="ac-leader-hours">{u.hours}h</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
