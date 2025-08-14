import { createContext, useContext, useEffect, useState } from "react";
import { apiAuth } from "../utils/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  async function fetchMe() {
    try {
      const data = await apiAuth.me();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => { fetchMe(); }, []);

  async function login(email, password) {
    const { token } = await apiAuth.login({ email, password });
    localStorage.setItem("token", token);
    await fetchMe();
  }

  async function register(payload) {
    const { token } = await apiAuth.register(payload);
    localStorage.setItem("token", token);
    await fetchMe();
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
