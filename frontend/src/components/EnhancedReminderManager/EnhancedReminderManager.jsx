import { useEffect, useState } from "react";
import {
  createReminder,
  deleteReminder,
  getDepartments,
  listSentReminders,
} from "../../utils/api";
import { emit } from "../../utils/bus";

import "./EnhancedReminderManager.css";

export default function EnhancedReminderManager({
  userRole,
  userName,
  userDepartment,
  onClose,
  notify, // (global toast)
}) {
  const [content, setContent] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState(
    userRole === "superadmin" ? "all" : (userDepartment || "")
  );
  const [messageType, setMessageType] = useState("info");
  const [duration, setDuration] = useState("temporary");
  const [departments, setDepartments] = useState([]);
  const [myMessages, setMyMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const say = (msg, type = "success") =>
    notify ? notify(msg, type) : console.log(type.toUpperCase(), msg);

  useEffect(() => {
    (async () => {
      try {
        if (userRole === "superadmin") {
          const d = await getDepartments();
          const opts = ["all", ...(d?.departments || [])];
          setDepartments(opts);
          setSelectedDepartment("all");
        } else {
          const onlyMine = [userDepartment].filter(Boolean);
          setDepartments(onlyMine);
          setSelectedDepartment(userDepartment || "");
        }
        const s = await listSentReminders(false);
        setMyMessages(s?.items || []);
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, [userRole, userDepartment]);

  const send = async () => {
    if (!content.trim()) {
      say("Please enter a message.", "error");
      return;
    }
    try {
      await createReminder({
        content: content.trim(),
        type: messageType,
        targetDepartment: selectedDepartment,
        duration,
      });

      emit("reminders:changed");
      setContent("");
      const s = await listSentReminders(false);
      setMyMessages(s?.items || []);
      say("Message sent.");
    } catch (e) {
      say(e?.message || "Failed to send message.", "error");
    }
  };

  const removeMsg = async (id) => {
    try {
      await deleteReminder(id);
      emit("reminders:changed");
      setMyMessages((prev) => prev.filter((m) => (m.id || m._id) !== id));
      say("Message deleted.");
    } catch (e) {
      say(e?.message || "Failed to delete message.", "error");
    }
  };

  return (
    <div className="erm-overlay erm-overlay-light">{/* beyaz overlay */}
      <div className="erm-card" role="dialog" aria-modal="true">
        <div className="erm-header">
          <h2>{userRole === "superadmin" ? "Company Message Center" : "Department Message Center"}</h2>
          <button className="erm-close" onClick={onClose} aria-label="Close">✖</button>
        </div>

        <div className="erm-content">
          {/* SOL: Gönderim */}
          <div className="erm-column">
            <h3>Send New Message</h3>

            <label>Target Department</label>
            {userRole === "superadmin" ? (
              <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}>
                {departments.map((d) => (
                  <option key={d} value={d}>{d || "-"}</option>
                ))}
              </select>
            ) : (
              <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}>
                {departments.map((d) => (
                  <option key={d} value={d}>{d || "-"}</option>
                ))}
              </select>
            )}

            <label>Message Type</label>
            <select value={messageType} onChange={(e) => setMessageType(e.target.value)}>
              <option value="info">Information</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>

            <label>Duration</label>
            <select value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="temporary">Temporary (24h)</option>
              <option value="permanent">Permanent</option>
            </select>

            <label>Message</label>
            <textarea
              rows="4"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your message..."
            />

            <button className="erm-send" onClick={send}>Send Message</button>
          </div>

          {/* SAĞ: Aktif Mesajlar */}
          <div className="erm-column">
            <h3>Your Active Messages</h3>
            <div className="erm-message-list">
              {loading ? (
                <p className="erm-empty">Loading…</p>
              ) : myMessages.length === 0 ? (
                <p className="erm-empty">No active messages</p>
              ) : (
                myMessages.map((m) => {
                  const key = m.id || m._id;
                  return (
                    <div key={key} className="erm-message">
                      <div className="erm-message-header">
                        <div className="erm-badges">
                          <span className="erm-badge">
                            {m.targetDepartment === "all" ? "All Departments" : m.targetDepartment}
                          </span>
                          <span className={`erm-badge erm-${m.type}`}>{m.type}</span>
                          <span className="erm-badge">{m.duration}</span>
                        </div>
                        <button className="erm-delete" onClick={() => removeMsg(key)} title="Delete">🗑</button>
                      </div>
                      <p>{m.content}</p>
                      <small>
                        Created: {m.createdAt ? new Date(m.createdAt).toLocaleString() : "-"}
                        {m.expiresAt && <> | Expires: {new Date(m.expiresAt).toLocaleString()}</>}
                      </small>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
