// import { useMemo, useState } from "react";
// import { apiAuth } from "../../utils/api";
// import "./DepartmentEmployeeAdder.css";

// export default function DepartmentEmployeeAdder({ userRole = "admin", department, onClose, notify }) {
//   const isSuper = userRole === "superadmin";

//   // Tekil ekleme
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [role, setRole] = useState(isSuper ? "employee" : "employee"); // admin bu modaldan admin oluşturmasın
//   const [entryDate, setEntryDate] = useState("");

//   // CSV import
//   const [csvText, setCsvText] = useState("");
//   const [importing, setImporting] = useState(false);

//   const canPickRole = isSuper; // ileride superadmin için aç
//   const canPickDepartment = isSuper; // şimdilik admin sabit departman

//   const doNotify = (msg, type = "success") => {
//     if (typeof window !== "undefined" && window.toast && window.toast[type]) {
//       window.toast[type](msg);
//     } else if (notify) {
//       notify(msg, type);
//     } else {
//       alert(msg);
//     }
//   };

//   const genPassword = () => {
//     const p = Math.random().toString(36).slice(-10);
//     setPassword(p);
//   };

//   const onSubmitSingle = async () => {
//     if (!name.trim() || !email.trim()) {
//       doNotify("Name and email are required.", "error");
//       return;
//     }
//     const payload = {
//       name: name.trim(),
//       email: email.trim(),
//       password: password.trim() || Math.random().toString(36).slice(-10),
//       role: role || "employee",
//       department: department, // admin için sabit
//       entryDate: entryDate || undefined,
//     };
//     try {
//       await apiAuth.register(payload);
//       doNotify(`User created: ${payload.name}`);
//       // formu temizle
//       setName(""); setEmail(""); setPassword(""); setEntryDate("");
//     } catch (e) {
//       doNotify(e?.message || "Failed to create user", "error");
//     }
//   };

//   // Basit CSV parsürü (virgül içermez varsayalım):
//   // headers: name,email,password,role,entryDate,department (department opsiyonel; admin iken yoksayılır)
//   const parseCsv = (text) => {
//     const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
//     if (!lines.length) return [];
//     const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
//     const rows = [];
//     for (let i = 1; i < lines.length; i++) {
//       const cols = lines[i].split(","); // basit ayrım
//       const row = {};
//       headers.forEach((h, idx) => (row[h] = (cols[idx] || "").trim()));
//       rows.push(row);
//     }
//     return rows;
//   };

//   const onImportCsv = async () => {
//     const rows = parseCsv(csvText);
//     if (!rows.length) {
//       doNotify("CSV is empty or invalid.", "error");
//       return;
//     }
//     setImporting(true);
//     let added = 0, skippedWrongDept = 0, failed = 0;

//     for (const r of rows) {
//       const depFromCsv = (r.department || "").trim();
//       // admin: CSV'deki departman mevcutsa ve farklıysa skip
//       if (!isSuper && depFromCsv && depFromCsv !== department) {
//         skippedWrongDept++;
//         continue;
//       }
//       const payload = {
//         name: (r.name || "").trim(),
//         email: (r.email || "").trim(),
//         password: (r.password || Math.random().toString(36).slice(-10)).trim(),
//         role: isSuper ? (r.role || "employee") : "employee",
//         department: isSuper ? (depFromCsv || department) : department,
//         entryDate: r.entrydate || undefined,
//       };
//       if (!payload.name || !payload.email) {
//         failed++; // zorunlular boşsa
//         continue;
//       }
//       try {
//         await apiAuth.register(payload);
//         added++;
//       } catch {
//         failed++;
//       }
//     }
//     setImporting(false);
//     doNotify(`Import done. Added: ${added}, Skipped(wrong dept): ${skippedWrongDept}, Failed: ${failed}`);
//   };

//   const sampleCsv = useMemo(
//     () =>
// `name,email,password,role,entryDate,department
// Jane Doe,jane@example.com,Temp123!,employee,2025-08-13,${department}
// John Smith,john@example.com,,employee,2025-08-13,${department}`,
//     [department]
//   );

//   const downloadSample = () => {
//     const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = "employees_template.csv";
//     a.click();
//     URL.revokeObjectURL(url);
//   };

//   return (
//     <div className="dea-overlay">
//       <div className="dea-card" role="dialog" aria-modal="true">
//         <div className="dea-header">
//           <h2>Add Employees</h2>
//           <button className="dea-close" onClick={onClose} aria-label="Close">✕</button>
//         </div>

//         <div className="dea-grid">
//           {/* Sol: Tekil ekleme */}
//           <div className="dea-col">
//             <h3>Single Employee</h3>

//             <label className="dea-label">Department</label>
//             <input className="dea-input" value={department} disabled={!canPickDepartment} readOnly={!canPickDepartment} />

//             <label className="dea-label">Full Name</label>
//             <input className="dea-input" value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Ayşe Yılmaz" />

//             <label className="dea-label">Email</label>
//             <input className="dea-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="name@company.com" />

//             <label className="dea-label">Password</label>
//             <div className="dea-row">
//               <input className="dea-input" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="(auto if empty)" />
//               <button className="dea-btn dea-btn-ghost" onClick={genPassword}>Generate</button>
//             </div>

//             <label className="dea-label">Role</label>
//             <select className="dea-input" value={role} onChange={(e)=>setRole(e.target.value)} disabled={!canPickRole}>
//               <option value="employee">employee</option>
//               {isSuper && <option value="admin">admin</option>}
//             </select>

//             <label className="dea-label">Entry Date</label>
//             <input className="dea-input" type="date" value={entryDate} onChange={(e)=>setEntryDate(e.target.value)} />

//             <button className="dea-btn dea-btn-primary" onClick={onSubmitSingle}>Add Employee</button>
//           </div>

//           {/* Sağ: CSV import */}
//           <div className="dea-col">
//             <h3>Bulk Import (CSV)</h3>
//             <p className="dea-help">
//               Columns: <code>name,email,password,role,entryDate,department</code><br />
//               Admins: only current department is allowed; different departments are skipped.
//             </p>

//             <div className="dea-row">
//               <button className="dea-btn dea-btn-ghost" onClick={downloadSample}>Download Template</button>
//             </div>

//             <label className="dea-label">Paste CSV</label>
//             <textarea
//               className="dea-textarea"
//               rows={10}
//               placeholder={sampleCsv}
//               value={csvText}
//               onChange={(e)=>setCsvText(e.target.value)}
//             />

//             <button className="dea-btn dea-btn-primary" onClick={onImportCsv} disabled={importing}>
//               {importing ? "Importing…" : "Import CSV"}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

import { useEffect, useMemo, useState } from "react";
import { apiAuth, getDepartments } from "../../utils/api";
import "./DepartmentEmployeeAdder.css";

export default function DepartmentEmployeeAdder({
  userRole = "admin",
  department,
  onClose,
  notify,
}) {
  const isSuper = userRole === "superadmin";

  // ---- Single add form ----
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(isSuper ? "employee" : "employee");
  const [entryDate, setEntryDate] = useState("");

  // ---- Department (superadmin can pick) ----
  const [dept, setDept] = useState(department || "");
  const [deps, setDeps] = useState([]);

  // ---- CSV import ----
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  const canPickRole = isSuper;
  const canPickDepartment = isSuper;

  const doNotify = (msg, type = "success") => {
    if (typeof window !== "undefined" && window.toast && window.toast[type]) {
      window.toast[type](msg);
    } else if (notify) {
      notify(msg, type);
    } else {
      alert(msg);
    }
  };

  useEffect(() => {
    if (!isSuper) return;
    let alive = true;
    (async () => {
      try {
        const res = await getDepartments();
        const list = res?.departments || [];
        if (!alive) return;
        setDeps(list);
        if (!dept && list.length) setDept(list[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [isSuper]); // eslint-disable-line react-hooks/exhaustive-deps

  const genPassword = () => {
    const p = Math.random().toString(36).slice(-10);
    setPassword(p);
  };

  const onSubmitSingle = async () => {
    if (!name.trim() || !email.trim()) {
      doNotify("Name and email are required.", "error");
      return;
    }
    const finalDept = isSuper ? dept || department || "" : department;

    const payload = {
      name: name.trim(),
      email: email.trim(),
      password: password.trim() || Math.random().toString(36).slice(-10),
      role: canPickRole ? role : "employee",
      department: finalDept,
      entryDate: entryDate || undefined,
    };

    try {
      await apiAuth.register(payload);
      doNotify(`User created: ${payload.name}`);
      setName("");
      setEmail("");
      setPassword("");
      setEntryDate("");
    } catch (e) {
      doNotify(e?.message || "Failed to create user", "error");
    }
  };

  // very simple CSV parser
  const parseCsv = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const row = {};
      headers.forEach((h, idx) => (row[h] = (cols[idx] || "").trim()));
      rows.push(row);
    }
    return rows;
  };

  const onImportCsv = async () => {
    const rows = parseCsv(csvText);
    if (!rows.length) {
      doNotify("CSV is empty or invalid.", "error");
      return;
    }
    setImporting(true);
    let added = 0,
      skippedWrongDept = 0,
      failed = 0;

    for (const r of rows) {
      const depFromCsv = (r.department || "").trim();

      // admin: skip if CSV department is different
      if (!isSuper && depFromCsv && depFromCsv !== department) {
        skippedWrongDept++;
        continue;
      }

      const finalDept = isSuper
        ? depFromCsv || dept || department || ""
        : department;

      const payload = {
        name: (r.name || "").trim(),
        email: (r.email || "").trim(),
        password: (r.password || Math.random().toString(36).slice(-10)).trim(),
        role: isSuper ? r.role || "employee" : "employee",
        department: finalDept,
        entryDate: r.entrydate || undefined,
      };

      if (!payload.name || !payload.email) {
        failed++;
        continue;
      }
      try {
        await apiAuth.register(payload);
        added++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    doNotify(
      `Import done. Added: ${added}, Skipped(wrong dept): ${skippedWrongDept}, Failed: ${failed}`
    );
  };

  const sampleCsv = useMemo(
    () =>
      `name,email,password,role,entryDate,department
Jane Doe,jane@example.com,Temp123!,employee,2025-08-13,${
        isSuper ? dept || "Engineering" : department
      }
John Smith,john@example.com,,employee,2025-08-13,${
        isSuper ? dept || "Engineering" : department
      }`,
    [department, dept, isSuper]
  );

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dea-overlay">
      <div className="dea-card" role="dialog" aria-modal="true">
        <div className="dea-header">
          <h2>Add Employees</h2>
          <button className="dea-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="dea-grid">
          {/* Left: single employee */}
          <div className="dea-col">
            <h3>Single Employee</h3>

            <label className="dea-label">Department</label>
            {canPickDepartment ? (
              <select
                className="dea-input"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              >
                {deps.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                {!deps.length && (
                  <option value="">(no departments found)</option>
                )}
              </select>
            ) : (
              <input className="dea-input" value={department} readOnly />
            )}

            <label className="dea-label">Full Name</label>
            <input
              className="dea-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ayşe Yılmaz"
            />

            <label className="dea-label">Email</label>
            <input
              className="dea-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />

            <label className="dea-label">Password</label>
            <div className="dea-row">
              <input
                className="dea-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="(auto if empty)"
              />
              <button className="dea-btn dea-btn-ghost" onClick={genPassword}>
                Generate
              </button>
            </div>

            <label className="dea-label">Role</label>
            <select
              className="dea-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={!canPickRole}
            >
              <option value="employee">employee</option>
              {isSuper && <option value="admin">admin</option>}
            </select>

            <label className="dea-label">Entry Date</label>
            <input
              className="dea-input"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />

            <button
              className="dea-btn dea-btn-primary"
              onClick={onSubmitSingle}
            >
              Add Employee
            </button>
          </div>

          {/* Right: CSV import */}
          <div className="dea-col">
            <h3>Bulk Import (CSV)</h3>
            <p className="dea-help">
              Columns:{" "}
              <code>name,email,password,role,entryDate,department</code>
              <br />
              Admins: only current department is allowed; different departments
              are skipped.
            </p>

            <div className="dea-row">
              <button
                className="dea-btn dea-btn-ghost"
                onClick={downloadSample}
              >
                Download Template
              </button>
            </div>

            <label className="dea-label">Paste CSV</label>
            <textarea
              className="dea-textarea"
              rows={10}
              placeholder={sampleCsv}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />

            <button
              className="dea-btn dea-btn-primary"
              onClick={onImportCsv}
              disabled={importing}
            >
              {importing ? "Importing…" : "Import CSV"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
