import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import logo from "../../assets/prLogo2_rb.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const isFormComplete = email.trim() !== "" && password.trim() !== "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // const res = await fetch('http://localhost:5000/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password })
      // })

      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const role = data.user?.role;
      if (role === "admin") navigate("/admin", { replace: true });
      else if (role === "superadmin")
        navigate("/superadmin", { replace: true });
      else navigate("/employee", { replace: true });
    } catch (err) {
      console.error("LOGIN ERR:", err);
      alert(err?.message || "Network error");
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
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="auth-input"
              />
            </div>
            <div className="forgot-password">
              <a href="#">Forgot your password?</a>
            </div>
            <div className="submit-button-container">
              <button
                type="submit"
                className={`triangle-button ${
                  isFormComplete ? "active" : "inactive"
                }`}
                disabled={!isFormComplete}
              >
                <div className="triangle" />
              </button>
            </div>
          </form>
        </div>
      </div>

      <img src={logo} alt="App Logo" className="app-logo" />
    </div>
  );
}
