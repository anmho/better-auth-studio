import { useEffect, useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import DatabaseSchemaNodeDemo from "./components/DatabaseSchemaNodeDemo";
import Layout from "./components/Layout";
import { CountsProvider } from "./contexts/CountsContext";
import { DashboardWidgetsProvider } from "./contexts/DashboardWidgetsContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { fetchStudioAuthJson } from "./utils/studio-auth";
import AccessDenied from "./pages/AccessDenied";
import Dashboard from "./pages/Dashboard";
import DatabaseVisualizer from "./pages/DatabaseVisualizer";
import EmailEditor from "./pages/EmailEditor";
import Events from "./pages/Events";
import Login from "./pages/Login";
import OrganizationDetails from "./pages/OrganizationDetails";
import Organizations from "./pages/Organizations";
import Sessions from "./pages/Sessions";
import ServiceCredentials from "./pages/ServiceCredentials";
import Settings from "./pages/Settings";
import TeamDetails from "./pages/TeamDetails";
import Teams from "./pages/Teams";
import UnavailableFeature from "./pages/UnavailableFeature";
import Tools from "./pages/Tools";
import UserDetails from "./pages/UserDetails";
import Users from "./pages/Users";
import { isStudioFeatureEnabled, type StudioFeatureKey } from "./utils/features";

const config = (window as any).__STUDIO_CONFIG__;
const basePath = config?.basePath !== undefined ? config.basePath : "";
const isSelfHosted = !!basePath;
const usesStudioAuth = config?.authMode !== "access";

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  user: any;
}

function featureElement(feature: StudioFeatureKey, name: string, element: React.ReactNode) {
  return isStudioFeatureEnabled(feature) ? element : <UnavailableFeature name={name} />;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ loading: true, authenticated: false, user: null });
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await fetchStudioAuthJson("/session");
        setAuth({ loading: false, authenticated: data.authenticated, user: data.user });
      } catch {
        setAuth({ loading: false, authenticated: false, user: null });
      }
    };
    checkAuth();
  }, [location.pathname]);

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border border-dashed border-white/30 animate-spin" />
      </div>
    );
  }

  if (!auth.authenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}

function MainRoutes() {
  return (
    <CountsProvider>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              isStudioFeatureEnabled("dashboard") ? (
                <DashboardWidgetsProvider>
                  <Dashboard />
                </DashboardWidgetsProvider>
              ) : (
                <Navigate to="/service-credentials" replace />
              )
            }
          />
          <Route path="/users" element={featureElement("users", "Users", <Users />)} />
          <Route path="/users/:userId" element={featureElement("users", "Users", <UserDetails />)} />
          <Route
            path="/organizations"
            element={featureElement("organizations", "Organizations", <Organizations />)}
          />
          <Route
            path="/organizations/:orgId"
            element={featureElement("organizations", "Organizations", <OrganizationDetails />)}
          />
          <Route path="/teams" element={featureElement("teams", "Teams", <Teams />)} />
          <Route path="/teams/:teamId" element={featureElement("teams", "Teams", <TeamDetails />)} />
          <Route path="/organizations/:orgId/teams/:teamId" element={<TeamDetails />} />
          <Route path="/sessions" element={featureElement("sessions", "Sessions", <Sessions />)} />
          <Route path="/events" element={featureElement("events", "Events", <Events />)} />
          <Route
            path="/database"
            element={featureElement("database", "Database", <DatabaseVisualizer />)}
          />
          <Route
            path="/database/demo"
            element={featureElement("database", "Database", <DatabaseSchemaNodeDemo />)}
          />
          <Route path="/emails" element={featureElement("emails", "Emails", <EmailEditor />)} />
          <Route path="/tools" element={featureElement("tools", "Tools", <Tools />)} />
          <Route
            path="/service-credentials"
            element={featureElement("serviceCredentials", "Service Credentials", <ServiceCredentials />)}
          />
          <Route path="/settings" element={featureElement("settings", "Settings", <Settings />)} />
        </Routes>
      </Layout>
    </CountsProvider>
  );
}

function AppShell() {
  const { theme } = useTheme();

  useEffect(() => {
    const title = config?.metadata?.title;
    if (title) {
      document.title = title;
    }
  }, []);

  return (
    <Router basename={basePath}>
      {isSelfHosted && usesStudioAuth ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <MainRoutes />
              </AuthGuard>
            }
          />
        </Routes>
      ) : (
        <Routes>
          <Route path="/*" element={<MainRoutes />} />
        </Routes>
      )}
      <Toaster
        className="rounded-none border-dashed border-white/20"
        theme={theme}
        position="top-right"
        richColors
        toastOptions={{
          style: {
            border: theme === "light" ? "dashed 1px #00000020" : "dashed 1px #ffffff20",
            borderRadius: "0",
            background: theme === "light" ? "#ffffff" : "#000000",
            color: theme === "light" ? "#000000" : "#ffffff",
          },
          className: "font-mono uppercase",
        }}
        closeButton
      />
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

export default App;
