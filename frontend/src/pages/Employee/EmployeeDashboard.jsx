import { useEffect, useMemo, useState } from "react";
import { FileText, History, BarChart3, Bell, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopBar from "../../components/TopBar/TopBar";
import MessagePanel from "../../components/Reminders/MessagePanel";
import { apiAuth, apiReports } from "../../utils/api";

import "./EmployeeDashboard.css";

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [hasReportToday, setHasReportToday] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiAuth.me(); // {user: {...}, todayReport?: {...}}
        if (!mounted) return;

        const user = data?.user ?? data ?? null;
        setMe(user);

        if (data?.todayReport !== undefined) {
          setHasReportToday(Boolean(data.todayReport));
        } else {
          try {
            const t = await apiReports.myToday();
            setHasReportToday(Boolean(t?.report));
          } catch {
            setHasReportToday(false);
          }
        }
      } catch {
        navigate("/login");
      }
    })();
    return () => (mounted = false);
  }, [navigate]);

  const status = useMemo(() => {
    if (hasReportToday) return { ok: true, text: "Report uploaded", Icon: CheckCircle2 };
    return { ok: false, text: "No report today", Icon: AlertTriangle };
  }, [hasReportToday]);

  const StatusIcon = status.Icon;

  return (
    <div className="ed-page-wrap">
      <TopBar />

      <div className="ed-header-row">
        <div className="ed-bell">
          <Bell className="ed-icon" />
          <div className={`ed-alert ${status.ok ? "ok" : "warn"}`}>
            <StatusIcon size={16} />
            <span>{status.text}</span>
          </div>
        </div>
      </div>

      {/* ---- 3 kolonlu yerleşim ---- */}
      <div className="ed-grid">
        {/* Sol: Info */}
        <section className="ed-left">
          <div className="ed-card">
            <div className="ed-card-title">Info</div>
            <div className="ed-info-list">
              <div className="ed-info-row">
                <span className="ed-info-key">Name</span>
                <span className="ed-info-val">{me?.name || "-"}</span>
              </div>
              <div className="ed-info-row">
                <span className="ed-info-key">Department</span>
                <span className="ed-info-val">{me?.department || "-"}</span>
              </div>
              <div className="ed-info-row">
                <span className="ed-info-key">Entry Date</span>
                <span className="ed-info-val">
                  {me?.entryDate
                    ? new Date(me.entryDate).toLocaleDateString()
                    : me?.createdAt
                    ? new Date(me.createdAt).toLocaleDateString()
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Orta: Quick Actions 2xN */}
        <section className="ed-center">
          <div className="ed-actions">
            <button className="ed-action" onClick={() => navigate("/employee/editor")}>
              <span className={`ed-dot ${hasReportToday ? "ok" : ""}`} />
              <div className="ed-iconwrap ed-blue">
                <FileText size={28} />
              </div>
              <div className="ed-action-title">
                {hasReportToday ? "Edit Today’s Report" : "Write Report"}
              </div>
              <div className="ed-action-sub">
                {hasReportToday ? "Update your report for today" : "Create your daily work report"}
              </div>
            </button>

            <button className="ed-action" onClick={() => navigate("/employee/reports")}>
              <div className="ed-iconwrap ed-green">
                <History size={28} />
              </div>
              <div className="ed-action-title">View Reports</div>
              <div className="ed-action-sub">Browse and search past reports</div>
            </button>

            <button className="ed-action" onClick={() => navigate("/employee/analysis")}>
              <div className="ed-iconwrap ed-purple">
                <BarChart3 size={28} />
              </div>
              <div className="ed-action-title">Analysis</div>
              <div className="ed-action-sub">Working hours & trends</div>
            </button>
          </div>
        </section>

        {/* Sağ: Messages */}
        <div className="ed-messages">
          <MessagePanel includeNoReportWarning={!hasReportToday} />
        </div>
      </div>
    </div>
  );
}
