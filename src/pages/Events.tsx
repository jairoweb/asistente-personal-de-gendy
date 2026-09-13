import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Loader2, Trash2, Mail, MailCheck, CalendarPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const EVENT_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  presupuesto: { label: "Cita presupuesto", emoji: "📋", color: "bg-blue-100 text-blue-800" },
  inicio_obra: { label: "Inicio de obra", emoji: "🔨", color: "bg-orange-100 text-orange-800" },
  fin_obra: { label: "Fin de obra", emoji: "✅", color: "bg-green-100 text-green-800" },
  cobro: { label: "Cobro pendiente", emoji: "💶", color: "bg-red-100 text-red-800" },
  otros: { label: "Otros", emoji: "📝", color: "bg-gray-100 text-gray-800" },
};

const emptyForm = {
  client_id: "", type: "presupuesto", event_date: "", event_time: "", description: "",
};

const safeFormat = (value: string, pattern: string) => {
  try {
    const d = parseISO(value);
    if (isNaN(d.getTime())) return value;
    return format(d, pattern, { locale: es });
  } catch {
    return value;
  }
};


export default function Events() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (!user) return;
    setUserEmail(user.email || "");
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [eventsRes, clientsRes] = await Promise.all([
        supabase.from("events").select("*, clients(name, job_address)").eq("user_id", user!.id).order("event_date", { ascending: true }),
        supabase.from("clients").select("id, name").eq("user_id", user!.id).order("name"),
      ]);
      if (eventsRes.error) throw eventsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      setEvents(eventsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (err) {
      console.error("Error cargando eventos:", err);
      toast({ title: "No se pudieron cargar los eventos", description: "Comprueba tu conexión e inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveEvent = async () => {
    if (!form.event_date) return toast({ title: "La fecha es obligatoria", variant: "destructive" });
    setSaving(true);

    try {
      const payload = {
        ...form,
        client_id: form.client_id || null,
        event_time: form.event_time || null,
        user_id: user!.id,
      };

      const { data: newEvent, error } = await supabase.from("events").insert(payload).select("*, clients(name, job_address)").single();
      if (error) throw error;

      toast({ title: "Evento creado ✓" });
      setDialogOpen(false);
      setForm(emptyForm);
      await loadAll();

      if (newEvent) {
        // Estas acciones no deben romper la pantalla si fallan
        sendEventEmail(newEvent).catch(err => console.error("Email:", err));
        syncToGoogleCalendar(newEvent).catch(err => console.error("Calendar:", err));
      }
    } catch (err) {
      console.error("Error guardando evento:", err);
      toast({ title: "Error al guardar", description: "No se pudo guardar el evento. Inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  const sendEventEmail = async (event: any) => {
    setSending(event.id);
    try {
      const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.otros;
      const dateStr = safeFormat(event.event_date, "EEEE d 'de' MMMM 'de' yyyy");
      const timeStr = event.event_time ? ` a las ${event.event_time.slice(0, 5)}h` : "";
      const clientName = event.clients?.name || "Sin cliente";
      const address = event.clients?.job_address || "Sin dirección";

      const res = await supabase.functions.invoke("send-event-email", {
        body: {
          to: userEmail,
          eventType: cfg.label,
          emoji: cfg.emoji,
          clientName,
          address,
          dateStr: `${dateStr}${timeStr}`,
          description: event.description || "",
        },
      });

      if (res.error) throw res.error;

      // Marcar como enviado
      await supabase.from("events").update({ email_sent: true }).eq("id", event.id);
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, email_sent: true } : e));
      toast({ title: "📧 Email enviado a tu correo" });
    } catch (err: any) {
      toast({ title: "No se pudo enviar el email", description: "Hubo un problema. Inténtalo de nuevo.", variant: "destructive" });
    }
    setSending(null);
  };

  const syncToGoogleCalendar = async (event: any) => {
    try {
      const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.otros;
      const clientName = event.clients?.name || "Sin cliente";
      const address = event.clients?.job_address || "";

      const res = await supabase.functions.invoke("sync-google-calendar", {
        body: {
          summary: `${cfg.emoji} ${cfg.label} — ${clientName}`,
          description: event.description || "",
          location: address,
          startDate: event.event_date,
          startTime: event.event_time?.slice(0, 5) || null,
        },
      });

      if (res.error) {
        console.error("Google Calendar sync error:", res.error);
        return;
      }

      const data = res.data;
      if (data?.needsGoogleAuth) {
        toast({ title: "📅 Inicia sesión con Google para sincronizar el calendario", description: "Ve a la pantalla de login y usa 'Continuar con Google'." });
        return;
      }

      if (data?.success) {
        toast({ title: "📅 Evento añadido a Google Calendar" });
      }
    } catch (err) {
      console.error("Error syncing to Google Calendar:", err);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      setEvents(prev => prev.filter(e => e.id !== id));
      toast({ title: "Evento eliminado" });
    } catch (err) {
      console.error("Error eliminando evento:", err);
      toast({ title: "No se pudo eliminar", description: "Inténtalo de nuevo.", variant: "destructive" });
    }
  };


  const downloadICS = (event: any) => {
    const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.otros;
    const clientName = event.clients?.name || "Sin cliente";
    const address = event.clients?.job_address || "";
    const dateRaw = event.event_date.replace(/-/g, "");
    
    let dtStart: string;
    let dtEnd: string;
    
    if (event.event_time) {
      const timeRaw = event.event_time.replace(/:/g, "").slice(0, 4) + "00";
      dtStart = `${dateRaw}T${timeRaw}`;
      // 1 hour duration
      const h = parseInt(event.event_time.slice(0, 2)) + 1;
      const endTime = `${String(h).padStart(2, "0")}${event.event_time.slice(3, 5)}00`;
      dtEnd = `${dateRaw}T${endTime}`;
    } else {
      dtStart = dateRaw;
      dtEnd = dateRaw;
    }

    const summary = `${cfg.emoji} ${cfg.label} — ${clientName}`;
    const desc = event.description || "";

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Asistente de Gendy//ES",
      "BEGIN:VEVENT",
      event.event_time ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
      event.event_time ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${address}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evento-${event.event_date}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "📅 Archivo de calendario descargado" });
  };

  // Agrupar por fecha
  const grouped: Record<string, any[]> = {};
  events.forEach(ev => {
    const key = ev.event_date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Eventos y Calendario</h1>
          <p className="text-muted-foreground text-sm">{events.length} eventos programados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nuevo evento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo evento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Tipo de evento</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cliente (opcional)</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fecha *</Label>
                  <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora</Label>
                  <Input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descripción / Notas</Label>
                <Textarea placeholder="Detalles del evento..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Se enviará un email automáticamente a <strong>{userEmail}</strong>
              </p>
              <Button className="w-full" onClick={saveEvent} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear evento y enviar email"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay eventos</p>
          <p className="text-sm mt-1">Crea tu primer evento para empezar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dayEvents]) => {
              const isToday = date === today;
              const isPast = date < today;
              return (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`text-sm font-semibold px-3 py-1 rounded-full ${isToday ? "bg-primary text-primary-foreground" : isPast ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground"}`}>
                      {isToday ? "Hoy" : safeFormat(date, "EEEE, d 'de' MMMM")}
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-2">
                    {dayEvents.map(event => {
                      const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.otros;
                      return (
                        <Card key={event.id} className={`shadow-card border-0 ${isPast ? "opacity-70" : ""}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{cfg.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="secondary" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                                  {event.event_time && (
                                    <span className="text-xs text-muted-foreground">{event.event_time.slice(0, 5)}h</span>
                                  )}
                                  {event.email_sent && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <MailCheck className="w-3 h-3" /> Email enviado
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-foreground mt-0.5">
                                  {event.clients?.name || "Sin cliente"}
                                  {event.clients?.job_address && <span className="text-muted-foreground font-normal"> — {event.clients.job_address}</span>}
                                </p>
                                {event.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={() => downloadICS(event)}
                                  title="Añadir al calendario"
                                >
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                </Button>
                                {!event.email_sent && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => sendEventEmail(event)}
                                    disabled={sending === event.id}
                                    title="Enviar email"
                                  >
                                    {sending === event.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteEvent(event.id)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
