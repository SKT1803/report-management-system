import { useEffect, useState } from "react";
import {
  getDepartments,
  listSentReminders,
  createReminder,
  deleteReminder,
} from "../../utils/api";

import "./CompanyReminderManager.css";

export default function CompanyReminderManager({ onClose }) {
  const [message, setMessage] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [duration, setDuration] = useState("temporary");
  const [departments, setDepartments] = useState([]); // API'den doldurulacak
  const [activeReminders, setActiveReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Departmanları getir
        const d = await getDepartments();
        if (!mounted) return;
        setDepartments(d?.departments || []);

        // Gönderilmiş (aktif) mesajlarımı getir
        const s = await listSentReminders(false);
        if (!mounted) return;
        setActiveReminders(s?.items || []);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // ESC ile kapat
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onEsc);
    return () => {
      mounted = false;
      window.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  const handleSendReminder = async () => {
    if (!message.trim()) {
      window.alert("Please enter a reminder message.");
      return;
    }
    try {
      setSending(true);
      await createReminder({
        content: message.trim(),
        type: "info",
        targetDepartment: selectedDepartment, // "all" veya tek departman
        duration, // "temporary" | "permanent"
      });

      setMessage("");
      // listeyi tazele
      const s = await listSentReminders(false);
      setActiveReminders(s?.items || []);

      const target =
        selectedDepartment === "all"
          ? "all departments"
          : `${selectedDepartment} department`;
      window.alert(`Reminder sent to ${target}.`);
    } catch (e) {
      window.alert(e?.message || "Failed to send reminder.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteReminder = async (id) => {
    try {
      await deleteReminder(id);
      setActiveReminders((prev) => prev.filter((r) => (r.id || r._id) !== id));
      window.alert("Reminder deleted successfully.");
    } catch (e) {
      window.alert(e?.message || "Failed to delete reminder.");
    }
  };

  return (
    <div className="crm-overlay">
      <div className="crm-card" role="dialog" aria-modal="true">
        <div className="crm-header">
          <div className="crm-title">
            <span className="crm-title-icon">🏢</span>
            <span>Company Reminder Manager</span>
          </div>
          <button
            className="crm-btn crm-btn-ghost"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="crm-content">
          {/* Send New Reminder */}
          <div className="crm-section">
            <h3 className="crm-h3">Send Company-Wide Reminder</h3>

            <div className="crm-field">
              <label className="crm-label" htmlFor="crm-target">
                Target
              </label>
              <select
                id="crm-target"
                className="crm-select"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="crm-field">
              <label className="crm-label" htmlFor="crm-duration">
                Duration
              </label>
              <select
                id="crm-duration"
                className="crm-select"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="temporary">Temporary (24 hours)</option>
                <option value="permanent">Permanent (until deleted)</option>
              </select>
            </div>

            <div className="crm-field">
              <label className="crm-label" htmlFor="crm-message">
                Message
              </label>
              <textarea
                id="crm-message"
                className="crm-textarea"
                rows={3}
                placeholder="Enter your company-wide reminder message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <button
              className="crm-btn crm-btn-primary crm-btn-block"
              onClick={handleSendReminder}
              disabled={sending}
            >
              {sending ? "Sending…" : "➤ Send Reminder"}
            </button>
          </div>

          {/* Active Reminders */}
          <div className="crm-section">
            <h3 className="crm-h3">Active Company Reminders</h3>

            {loading ? (
              <p className="crm-empty">Loading…</p>
            ) : activeReminders.length === 0 ? (
              <p className="crm-empty">No active reminders</p>
            ) : (
              <div className="crm-reminder-list">
                {activeReminders.map((rem) => {
                  const id = rem.id || rem._id;
                  const dept = rem.targetDepartment || rem.department; // her iki alan adına da tolerans
                  const dur = rem.duration || "temporary";
                  return (
                    <div className="crm-reminder" key={id}>
                      <div className="crm-reminder-top">
                        <div className="crm-badges">
                          <span
                            className={
                              "crm-badge " +
                              (dept === "all"
                                ? "crm-badge-solid"
                                : "crm-badge-outline")
                            }
                          >
                            {dept === "all"
                              ? "🏢 All Departments"
                              : `👥 ${dept}`}
                          </span>
                          <span
                            className={
                              "crm-badge " +
                              (dur === "temporary"
                                ? "crm-badge-soft"
                                : "crm-badge-solid")
                            }
                          >
                            ⏱ {dur}
                          </span>
                        </div>
                        <button
                          className="crm-btn crm-btn-ghost"
                          onClick={() => handleDeleteReminder(id)}
                          aria-label="Delete reminder"
                          title="Delete"
                        >
                          🗑
                        </button>
                      </div>

                      <p className="crm-reminder-text">
                        {rem.content || rem.message}
                      </p>

                      <p className="crm-meta">
                        Created:{" "}
                        {new Date(rem.createdAt).toLocaleString()}
                        {rem.expiresAt && (
                          <span className="crm-meta-sep">
                            Expires:{" "}
                            {new Date(rem.expiresAt).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
