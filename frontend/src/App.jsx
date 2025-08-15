import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { useEffect, useState } from "react";

import LoginPage from "./pages/LoginPage/LoginPage";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import SuperadminDashboard from "./pages/Superadmin/SuperadminDashboard";
import EmployeeDashboard from "./pages/Employee/EmployeeDashboard";

import ReportEditor from "./components/ReportEditor/ReportEditor";
import ReportsViewer from "./components/ReportsViewer/ReportsViewer";
import EmployeeAnalytics from "./components/Analytics/EmployeeAnalytics";
import DepartmentEmployees from "./components/DepartmentEmployees/DepartmentEmployees";

import {
  RequireRole,
  RedirectIfAuth,
} from "./components/RouteGuard/RouteGuards";
import { apiAuth, getDepartments } from "./utils/api";
import { ToastProvider } from "./components/Toast/ToastProvider";
import GeneralAnalytics from "./components/AnalyticsGeneral/GeneralAnalytics";

/* ----- Employee alt rotaları ----- */
function EmpEditorRoute() {
  const navigate = useNavigate();
  return <ReportEditor onBack={() => navigate("/employee")} />;
}
function EmpReportsRoute() {
  const navigate = useNavigate();
  return <ReportsViewer onBack={() => navigate("/employee")} />;
}
function EmpAnalysisRoute() {
  const navigate = useNavigate();
  return <EmployeeAnalytics onBack={() => navigate("/employee")} />;
}
function EmployeeLayout() {
  return (
    <RequireRole roles={["employee"]}>
      <Outlet />
    </RequireRole>
  );
}

/* ----- Admin alt rotaları ----- */
function AdminEditorRoute() {
  const navigate = useNavigate();
  return <ReportEditor onBack={() => navigate("/admin")} />;
}
function AdminReportsRoute() {
  const navigate = useNavigate();
  return <ReportsViewer onBack={() => navigate("/admin")} />;
}
function AdminAnalysisRoute() {
  const navigate = useNavigate();
  return (
    <EmployeeAnalytics userType="admin" onBack={() => navigate("/admin")} />
  );
}
function AdminEmployeesRoute() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);

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

  if (!me) return null;

  return (
    <DepartmentEmployees
      onBack={() => navigate("/admin")}
      adminDepartment={me?.department}
      myUserId={me?._id || me?.id}
    />
  );
}
function AdminLayout() {
  return (
    <RequireRole roles={["admin", "superadmin"]}>
      <Outlet />
    </RequireRole>
  );
}

/* ----- Superadmin alt rotaları ----- */
function SuperEmployeesRoute() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [deps, setDeps] = useState([]);
  const [dep, setDep] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const userRes = await apiAuth.me();
        const depsRes = await getDepartments();
        if (!mounted) return;
        setMe(userRes?.user ?? userRes ?? null);
        const list = depsRes?.departments || [];
        setDeps(list);
        setDep(list[0] || "");
      } catch {
        navigate("/login");
      }
    })();
    return () => (mounted = false);
  }, [navigate]);

  if (!me) return null;

  return (
    <DepartmentEmployees
      onBack={() => navigate("/superadmin")}
      adminDepartment={dep}
      myUserId={me?._id || me?.id}
      /*  başlığın sağına dep. seçimi */
      headerRight={
        <>
          <label className="em-label">Department</label>
          <select
            className="em-select"
            value={dep}
            onChange={(e) => setDep(e.target.value)}
          >
            {deps.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </>
      }
    />
  );
}

function SuperAnalysisRoute() {
  const navigate = useNavigate();
  return (
    <EmployeeAnalytics
      userType="superadmin"
      onBack={() => navigate("/superadmin")}
    />
  );
}

function SuperOverviewRoute() {
  const navigate = useNavigate();
  return <GeneralAnalytics onBack={() => navigate("/superadmin")} />;
}

function SuperadminLayout() {
  return (
    <RequireRole roles={["superadmin"]}>
      <Outlet />
    </RequireRole>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Login */}
          <Route
            path="/"
            element={
              <RedirectIfAuth>
                <LoginPage />
              </RedirectIfAuth>
            }
          />

          {/* Admin ve alt sayfaları */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="editor" element={<AdminEditorRoute />} />
            <Route path="reports" element={<AdminReportsRoute />} />
            <Route path="analysis" element={<AdminAnalysisRoute />} />
            <Route path="employees" element={<AdminEmployeesRoute />} />
          </Route>

          {/* Superadmin ve alt sayfaları */}
          <Route path="/superadmin" element={<SuperadminLayout />}>
            <Route index element={<SuperadminDashboard />} />
            <Route path="employees" element={<SuperEmployeesRoute />} />
            <Route path="analysis" element={<SuperAnalysisRoute />} />
            <Route path="overview" element={<SuperOverviewRoute />} />
          </Route>

          {/* Employee ve alt sayfaları */}
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route index element={<EmployeeDashboard />} />
            <Route path="editor" element={<EmpEditorRoute />} />
            <Route path="reports" element={<EmpReportsRoute />} />
            <Route path="analysis" element={<EmpAnalysisRoute />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
