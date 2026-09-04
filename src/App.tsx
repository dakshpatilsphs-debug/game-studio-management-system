import { useState, useEffect } from "react";
import { Gamepad2 } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/auth";
import { DataProvider, useData } from "./lib/store";
import { ToastProvider } from "./components/Toaster";
import { Layout, type PageId } from "./components/Layout";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./pages/Dashboard";
import Rentals from "./pages/Rentals";
import Customers from "./pages/Customers";
import Expenses from "./pages/Expenses";
import Bills from "./pages/Bills";
import Reports from "./pages/Reports";
import AI from "./pages/AI";
import Prebooks from "./pages/Prebooks";
import PublicPrebook from "./pages/PublicPrebook";
import Clients from "./pages/Clients";

function Pages() {
  const [page, setPage] = useState<PageId>("dashboard");
  return (
    <Layout page={page} setPage={setPage}>
      {page === "dashboard" && <Dashboard setPage={setPage} />}
      {page === "rentals" && <Rentals />}
      {page === "customers" && <Customers />}
      {page === "expenses" && <Expenses />}
      {page === "bills" && <Bills />}
      {page === "reports" && <Reports />}
      {page === "prebooks" && <Prebooks />}
      {page === "clients" && <Clients />}
      {page === "ai" && <AI />}
    </Layout>
  );
}

function Shell() {
  const { user, guest, loading } = useAuth();
  const { ready } = useData();

  if (loading) return <FullScreenSpinner label="Connecting to your lounge…" />;
  if (!user && !guest) return <AuthScreen />;
  if (!ready) return <FullScreenSpinner label="Loading your lounge…" />;
  return <Pages />;
}

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas text-ink">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-free/30" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-free/15 ring-1 ring-free/40">
          <Gamepad2 className="h-8 w-8 text-free" />
        </div>
      </div>
      <h1 className="font-display text-lg font-semibold">{label}</h1>
      <p className="mt-1 text-sm text-muted">Please wait a moment</p>
    </div>
  );
}

function PrebookGate() {
  const [isPrebook, setIsPrebook] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.has("prebook") || hash.includes("prebook")) setIsPrebook(true);
  }, []);
  if (isPrebook) return <PublicPrebook />;
  return (
    <AuthProvider>
      <DataProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default function App() {
  return <PrebookGate />;
}
