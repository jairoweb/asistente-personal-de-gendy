import { Link, useLocation } from "react-router-dom";
import AIAssistant from "@/components/AIAssistant";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Image,
  Paintbrush,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/eventos", icon: Calendar, label: "Eventos" },
  { to: "/fotos", icon: Image, label: "Fotos" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen gradient-primary">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center gradient-accent">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Gendy</h1>
              <p className="text-blue-300 text-xs mt-0.5">Asistente Personal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                location.pathname === to
                  ? "gradient-accent text-white shadow-md"
                  : "text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-blue-300 mb-2 truncate px-1">{user?.email}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground hover:text-white hover:bg-sidebar-accent gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 border-b border-border bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center gradient-primary">
            <Paintbrush className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground text-base">Asistente de Gendy</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-muted">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-14">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-64 flex flex-col p-4 space-y-1 gradient-primary">
            {navItems.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all",
                  location.pathname === to
                    ? "gradient-accent text-white shadow-md"
                    : "text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
            <div className="!mt-auto pt-4 border-t border-sidebar-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="w-full justify-start text-sidebar-foreground hover:text-white hover:bg-sidebar-accent gap-2"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="md:hidden h-14" />
        {children}
      </main>

      {/* AI Assistant Floating Button */}
      <AIAssistant />
    </div>
  );
}

