import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Send, BarChart3, PieChart } from "lucide-react";
import TopBar from "../../components/TopBar/TopBar";
import MessagePanel from "../../components/Reminders/MessagePanel";
import EnhancedReminderManager from "../../components/EnhancedReminderManager/EnhancedReminderManager";
import { apiAuth } from "../../utils/api";
import { useToast } from "../../components/Toast/ToastProvider";
import "./SuperadminDashboard.css";

export default function SuperadminDashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [me, setMe] = useState(null);
  const [showReminders, setShowReminders] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiAuth.me();
        if (!mounted) return;
        setMe(data?.user ?? data ?? null);
      } catch {
        navigate("/login");
      }
    })();
    return () => (mounted = false);
  }, [navigate]);

  return (
    <div className="sd-page-wrap">
      <TopBar />

      <div className="sd-grid">
        {/* Sol: Info */}
        <section className="sd-left">
          <div className="sd-card">
            <div className="sd-card-title">Info</div>
            <div className="sd-info-list">
              <div className="sd-info-row">
                <span className="sd-info-key">Name</span>
                <span className="sd-info-val">{me?.name || "-"}</span>
              </div>
              <div className="sd-info-row">
                <span className="sd-info-key">Role</span>
                <span className="sd-info-val">{me?.role || "superadmin"}</span>
              </div>
              <div className="sd-info-row">
                <span className="sd-info-key">Entry Date</span>
                <span className="sd-info-val">
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

        {/* Orta: Hızlı aksiyonlar */}
        <section className="sd-center">
          <div className="sd-actions">
            <button
              className="sd-action"
              onClick={() => navigate("/superadmin/employees")}
            >
              <div className="sd-iconwrap sd-purple"><Users size={28} /></div>
              <div className="sd-action-title">Manage Employees</div>
              <div className="sd-action-sub">Browse all employees in a department</div>
            </button>

            <button
              className="sd-action"
              onClick={() => navigate("/superadmin/analysis")}
            >
              <div className="sd-iconwrap sd-blue"><BarChart3 size={28} /></div>
              <div className="sd-action-title">Analysis</div>
              <div className="sd-action-sub">Department & employee trends</div>
            </button>


            <button
              className="sd-action"
              onClick={() => navigate("/superadmin/overview")}
            >
              <div className="sd-iconwrap sd-green"><PieChart size={28} /></div>
              <div className="sd-action-title">Company Overview</div>
              <div className="sd-action-sub">Org-wide summary & trends</div>
            </button>


            <button className="sd-action" onClick={() => setShowReminders(true)}>
              <div className="sd-iconwrap sd-orange"><Send size={28} /></div>
              <div className="sd-action-title">Send Message</div>
              <div className="sd-action-sub">Company-wide or per department</div>
            </button>
          </div>
        </section>

        {/* Sağ: Messages */}
        <div className="sd-messages">
          <MessagePanel includeNoReportWarning={false} />
        </div>
      </div>

      {showReminders && (
        <EnhancedReminderManager
          userRole="superadmin"
          userName={me?.name || "-"}
          userDepartment="all"
          onClose={() => setShowReminders(false)}
          notify={(msg, type) => (type === "error" ? toast.error(msg) : toast.success(msg))}
        />
      )}
    </div>
  );
}
