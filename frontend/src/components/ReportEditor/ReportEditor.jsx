import { useEffect, useState } from "react";
import { apiReports } from "../../utils/api";
import { useToast } from "../Toast/ToastProvider";

import "./ReportEditor.css";

export default function ReportEditor({ onBack, onSaved }) {
  const [content, setContent] = useState("");
  const [hours, setHours] = useState(8);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);

  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiReports.myToday(); // {report: {...}} | {report:null}
        const rep = res?.report || null;
        if (!mounted) return;

        if (rep) {
          setIsEdit(true);
          setContent(rep.content || "");
          setHours(typeof rep.hours === "number" ? rep.hours : 8);
        } else {
          setIsEdit(false);
          setContent("");
          setHours(8);
        }
        setErr("");
      } catch (e) {
        setErr(e?.message || "Failed to load today's report.");
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const trySave = async () => {
    setErr("");
    if (!content.trim()) {
      setErr("content required");
      return;
    }
    if (hours <= 0 || hours > 24) {
      setErr("hours must be between 1 and 24");
      return;
    }
    try {
      setSaving(true);
      await apiReports.upsertMyReport({
        content: content.trim(),
        hours: Number(hours),
      });
      onSaved?.(); // dashboard'a "bugün rapor var" bilgisini gönder
      setIsEdit(true); // ilk kayıttan sonra edit moduna geç
      toast.success(isEdit ? "Report updated" : "Report saved");
    } catch (e) {
      setErr(e.message || "failed");
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="re-container">
      <div className="re-header">
        <button className="btn-ghost re-back" onClick={onBack}>← Back to Dashboard</button>
        <h1 className="re-title">{isEdit ? "Edit Today’s Report" : "Daily Report Editor"}</h1>
        <p className="re-subtitle">
          {isEdit ? "You can update your report until the end of the day."
                  : `Write your daily work report for ${new Date().toLocaleDateString()}`}
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🕒 {isEdit ? "Today’s Report" : "Today’s Work Report"}</h2>
        </div>

        <div className="card-content">
          {loading ? (
            <div className="empty">Loading...</div>
          ) : (
            <>
              {err && <div className="alert">{err}</div>}

              <div className="field">
                <label className="label" htmlFor="hours">Working Hours</label>
                <input
                  id="hours" type="number" min="1" max="24"
                  value={hours} onChange={(e) => setHours(Number(e.target.value))}
                  className="input input-hours" placeholder="8"
                />
                <p className="help">Enter hours worked today (1-24)</p>
              </div>

              <div className="field">
                <label className="label" htmlFor="content">Report Content</label>
                <textarea
                  id="content" rows={12} maxLength={1000}
                  value={content} onChange={(e) => setContent(e.target.value)}
                  className="textarea"
                  placeholder="Describe your work activities, accomplishments, challenges..."
                />
                <p className="help">{content.length}/1000 characters</p>
              </div>

              <div className="actions">
                <button className="btn-outline" onClick={onBack} disabled={saving}>Cancel</button>
                <button className="btn-primary" onClick={trySave} disabled={saving}>
                  {saving ? "Saving..." : isEdit ? "Update Report" : "Save Report"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

