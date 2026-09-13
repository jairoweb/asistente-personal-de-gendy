import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Euro, Clock, Plus, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const EVENT_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  presupuesto: { label: "Cita presupuesto", color: "bg-blue-100 text-blue-800", emoji: "📋" },
  inicio_obra: { label: "Inicio de obra", color: "bg-orange-100 text-orange-800", emoji: "🔨" },
  fin_obra: { label: "Fin de obra", color: "bg-green-100 text-green-800", emoji: "✅" },
  cobro: { label: "Cobro pendiente", color: "bg-red-100 text-red-800", emoji: "💶" },
  otros: { label: "Otros", color: "bg-gray-100 text-gray-800", emoji: "📝" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ clients: 0, activeJobs: 0, pendingPayments: 0 });
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const [clientsRes, eventsRes, pendingRes] = await Promise.all([
        supabase.from("clients").select("id, payment_status").eq("user_id", user!.id),
        supabase
          .from("events")
          .select("*, clients(name, job_address)")
          .eq("user_id", user!.id)
          .gte("event_date", today)
          .order("event_date", { ascending: true })
          .limit(5),
        supabase.from("clients").select("id").eq("user_id", user!.id).eq("payment_status", "pendiente"),
      ]);

      const clients = clientsRes.data || [];
      const pending = pendingRes.data || [];

      setStats({
        clients: clients.length,
        activeJobs: clients.filter(c => c.payment_status !== "cobrado").length,
        pendingPayments: pending.length,
      });
      setUpcomingEvents(eventsRes.data || []);
    } catch (err) {
      console.error("Error cargando el panel:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      if (isToday(d)) return "Hoy";
      if (isTomorrow(d)) return "Mañana";
      return format(d, "dd MMM", { locale: es });
    } catch {
      return dateStr;
    }
  };


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">¡Buenos días! 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Aquí tienes el resumen de tu trabajo</p>
        </div>
        <div className="flex gap-2">
          <Link to="/clientes">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo cliente
            </Button>
          </Link>
          <Link to="/eventos">
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo evento
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-card border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Clientes totales</p>
                <p className="text-3xl font-bold text-foreground mt-1">{loading ? "—" : stats.clients}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Trabajos en curso</p>
                <p className="text-3xl font-bold text-foreground mt-1">{loading ? "—" : stats.activeJobs}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10">
                <Clock className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Cobros pendientes</p>
                <p className="text-3xl font-bold text-foreground mt-1">{loading ? "—" : stats.pendingPayments}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-destructive/10">
                <Euro className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próximos eventos */}
      <Card className="shadow-card border-0">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Próximos eventos
          </CardTitle>
          <Link to="/eventos">
            <Button variant="ghost" size="sm" className="gap-1 text-primary">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay eventos próximos</p>
              <Link to="/eventos">
                <Button size="sm" className="mt-3 gap-1">
                  <Plus className="w-4 h-4" /> Crear evento
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map(event => {
                const meta = EVENT_LABELS[event.type] || EVENT_LABELS.otros;
                return (
                  <div key={event.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="text-center min-w-[48px]">
                      <div className="text-lg font-bold text-primary leading-none">{getDateLabel(event.event_date)}</div>
                      {event.event_time && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {event.event_time.slice(0, 5)}h
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.emoji}</span>
                        <span className="font-medium text-sm text-foreground truncate">
                          {event.clients?.name || "Sin cliente"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {event.clients?.job_address || event.description || meta.label}
                      </p>
                    </div>
                    <Badge variant="secondary" className={`text-xs shrink-0 ${meta.color}`}>
                      {meta.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
