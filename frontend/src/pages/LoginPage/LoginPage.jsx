// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import "./LoginPage.css";
// import logo from "../../assets/prLogo2_rb.png";

// export default function LoginPage() {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const navigate = useNavigate();
//   const isFormComplete = email.trim() !== "" && password.trim() !== "";

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       // const res = await fetch('http://localhost:5000/api/auth/login', {
//       //   method: 'POST',
//       //   headers: { 'Content-Type': 'application/json' },
//       //   body: JSON.stringify({ email, password })
//       // })

//       const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email, password }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data?.error || "Login failed");
//         return;
//       }

//       localStorage.setItem("token", data.token);
//       localStorage.setItem("user", JSON.stringify(data.user));

//       const role = data.user?.role;
//       if (role === "admin") navigate("/admin", { replace: true });
//       else if (role === "superadmin")
//         navigate("/superadmin", { replace: true });
//       else navigate("/employee", { replace: true });
//     } catch (err) {
//       console.error("LOGIN ERR:", err);
//       alert(err?.message || "Network error");
//     }
//   };

//   return (
//     <div className="app-container">
//       <div className="auth-container">
//         <div className="auth-card">
//           <h1 className="auth-title">SIGN IN</h1>
//           <form onSubmit={handleSubmit} className="auth-form">
//             <div className="form-group">
//               <input
//                 type="email"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 placeholder="E-Mail"
//                 className="auth-input"
//               />
//             </div>
//             <div className="form-group">
//               <input
//                 type="password"
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//                 placeholder="Password"
//                 className="auth-input"
//               />
//             </div>
//             <div className="forgot-password">
//               <a href="#">Forgot your password?</a>
//             </div>
//             <div className="submit-button-container">
//               <button
//                 type="submit"
//                 className={`triangle-button ${
//                   isFormComplete ? "active" : "inactive"
//                 }`}
//                 disabled={!isFormComplete}
//               >
//                 <div className="triangle" />
//               </button>
//             </div>
//           </form>
//         </div>
//       </div>

//       <img src={logo} alt="App Logo" className="app-logo" />
//     </div>
//   );
// }

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import logo from "../../assets/prLogo2_rb.png";
import { useToast } from "../../components/Toast/ToastProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast(); // toast.info / toast.success / toast.error
  const warmupTimerRef = useRef(null);

  const isFormComplete = email.trim() !== "" && password.trim() !== "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);

      // 0.8sn'den uzun sürerse "waking up" tostu göster
      warmupTimerRef.current = setTimeout(() => {
        toast.info("Warming up the server… (first request may take a bit)");
      }, 800);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // JSON olmayan hata sayfalarını da tolere et
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text || "{}");
      } catch {
        /* ignore */
      }

      if (!res.ok) {
        toast.error(data?.error || `Login failed (${res.status})`);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success("Signed in");

      const role = data.user?.role;
      if (role === "admin") navigate("/admin", { replace: true });
      else if (role === "superadmin")
        navigate("/superadmin", { replace: true });
      else navigate("/employee", { replace: true });
    } catch (err) {
      // Render cold start / ağ hatası
      const msg = err?.message?.includes("Failed to fetch")
        ? "Network error. Backend may be waking up — try again in a moment."
        : err?.message || "Network error";
      toast.error(msg);
      console.error("LOGIN ERR:", err);
    } finally {
      setLoading(false);
      if (warmupTimerRef.current) {
        clearTimeout(warmupTimerRef.current);
        warmupTimerRef.current = null;
      }
    }
  };

  return (
    <div className="app-container">
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">SIGN IN</h1>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail"
                className="auth-input"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="auth-input"
                disabled={loading}
              />
            </div>
            <div className="forgot-password">
              <a href="#" onClick={(e) => e.preventDefault()}>
                Forgot your password?
              </a>
            </div>
            <div className="submit-button-container">
              <button
                type="submit"
                className={`triangle-button ${
                  isFormComplete ? "active" : "inactive"
                } ${loading ? "loading" : ""}`}
                disabled={!isFormComplete || loading}
                aria-busy={loading}
              >
                {loading ? (
                  <div className="spin" aria-hidden />
                ) : (
                  <div className="triangle" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <img src={logo} alt="App Logo" className="app-logo" />
    </div>
  );
}
