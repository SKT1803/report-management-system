import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  History,
  BarChart3,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Users,
  Send,
  UserPlus,
} from "lucide-react";
import TopBar from "../../components/TopBar/TopBar";
import MessagePanel from "../../components/Reminders/MessagePanel";
import { apiAuth, apiReports } from "../../utils/api";
import DepartmentEmployeeAdder from "../../components/DepartmentEmployeeAdder/DepartmentEmployeeAdder";
import EnhancedReminderManager from "../../components/EnhancedReminderManager/EnhancedReminderManager"; 
import { useToast } from "../../components/Toast/ToastProvider";

import "./AdminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [showAdder, setShowAdder] = useState(false);
  const [showReminders, setShowReminders] = useState(false); 

  const [me, setMe] = useState(null);
  const [hasReportToday, setHasReportToday] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiAuth.me();
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
    <div className="ad-page-wrap">
      <TopBar />

      <div className="ad-header-row">
        <div className="ad-bell">
          <Bell className="ad-icon" />
          <div className={`ad-alert ${status.ok ? "ok" : "warn"}`}>
            <StatusIcon size={16} />
            <span>{status.text}</span>
          </div>
        </div>
      </div>

      <div className="ad-grid">
        <section className="ad-left">
          <div className="ad-card">
            <div className="ad-card-title">Info</div>
            <div className="ad-info-list">
              <div className="ad-info-row">
                <span className="ad-info-key">Name</span>
                <span className="ad-info-val">{me?.name || "-"}</span>
              </div>
              <div className="ad-info-row">
                <span className="ad-info-key">Department</span>
                <span className="ad-info-val">{me?.department || "-"}</span>
              </div>
              <div className="ad-info-row">
                <span className="ad-info-key">Role</span>
                <span className="ad-info-val">{me?.role || "admin"}</span>
              </div>
              <div className="ad-info-row">
                <span className="ad-info-key">Entry Date</span>
                <span className="ad-info-val">
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

        <section className="ad-center">
          <div className="ad-actions">
            <button className="ad-action" onClick={() => navigate("/admin/editor")}>
              <span className={`ad-dot ${hasReportToday ? "ok" : ""}`} />
              <div className="ad-iconwrap ad-blue"><FileText size={28} /></div>
              <div className="ad-action-title">
                {hasReportToday ? "Edit Today’s Report" : "Write Report"}
              </div>
              <div className="ad-action-sub">
                {hasReportToday ? "Update your report for today" : "Create your daily work report"}
              </div>
            </button>

            <button className="ad-action" onClick={() => navigate("/admin/reports")}>
              <div className="ad-iconwrap ad-green"><History size={28} /></div>
              <div className="ad-action-title">View Reports</div>
              <div className="ad-action-sub">Browse and search past reports</div>
            </button>

            <button className="ad-action" onClick={() => navigate("/admin/employees")}>
              <div className="ad-iconwrap ad-purple"><Users size={28} /></div>
              <div className="ad-action-title">Manage Team</div>
              <div className="ad-action-sub">View employee reports and status</div>
            </button>

            <button className="ad-action" onClick={() => navigate("/admin/analysis")}>
              <div className="ad-iconwrap ad-blue"><BarChart3 size={28} /></div>
              <div className="ad-action-title">Analysis</div>
              <div className="ad-action-sub">Department working hours & trends</div>
            </button>

            {/* Send Message: MODAL */}
            <button className="ad-action" onClick={() => setShowReminders(true)}>
              <div className="ad-iconwrap ad-orange"><Send size={28} /></div>
              <div className="ad-action-title">Send Message</div>
              <div className="ad-action-sub">Create and send a department notice</div>
            </button>

            {/* Add Employees: MODAL */}
            <button className="ad-action" onClick={() => setShowAdder(true)}>
              <div className="ad-iconwrap ad-purple"><UserPlus size={28} /></div>
              <div className="ad-action-title">Add Employees</div>
              <div className="ad-action-sub">Single add or CSV import</div>
            </button>
          </div>
        </section>

        <div className="ad-messages">
          <MessagePanel includeNoReportWarning={!hasReportToday} />
        </div>
      </div>

      {/* Add Employees Modal */}
      {showAdder && (
        <DepartmentEmployeeAdder
          userRole={me?.role || "admin"}
          department={me?.department || ""}
          onClose={() => setShowAdder(false)}
          notify={(msg, type) => (type === "error" ? toast.error(msg) : toast.success(msg))}
        />
      )}

      {/* Send Message Modal */}
      {showReminders && (
        <EnhancedReminderManager
          userRole={me?.role || "admin"}
          userName={me?.name || "-"}
          userDepartment={me?.department || "-"}
          onClose={() => setShowReminders(false)}
          notify={(msg, type) => (type === "error" ? toast.error(msg) : toast.success(msg))}
        />
      )}
    </div>
  );
}
