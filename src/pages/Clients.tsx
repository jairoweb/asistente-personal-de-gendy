import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Phone, MapPin, Euro, ChevronRight, Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const PAYMENT_BADGE: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-red-100 text-red-800" },
  parcial: { label: "Cobrado parcial", className: "bg-yellow-100 text-yellow-800" },
  cobrado: { label: "Cobrado ✓", className: "bg-green-100 text-green-800" },
};

const emptyForm = {
  name: "", phone: "", email: "", job_address: "",
  quote: "", agreed_price: "", payment_status: "pendiente", notes: "",
};

export default function Clients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { loadClients(); }, [user]);

  const loadClients = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error("Error cargando clientes:", err);
      toast({ title: "No se pudieron cargar los clientes", description: "Comprueba tu conexión e inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveClient = async () => {
    if (!form.name.trim()) return toast({ title: "El nombre es obligatorio", variant: "destructive" });
    if (!user) return toast({ title: "Sesión no disponible", variant: "destructive" });
    setSaving(true);

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        quote: form.quote ? parseFloat(form.quote) : null,
        agreed_price: form.agreed_price ? parseFloat(form.agreed_price) : null,
        user_id: user.id,
      };

      const { error } = editId
        ? await supabase.from("clients").update(payload).eq("id", editId).eq("user_id", user.id)
        : await supabase.from("clients").insert(payload);

      if (error) throw error;

      toast({ title: editId ? "Cliente actualizado ✓" : "Cliente añadido ✓" });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
      await loadClients();
    } catch (err) {
      console.error("Error guardando cliente:", err);
      toast({ title: "Error al guardar", description: "No se pudo guardar el cliente. Inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  const openEdit = (client: any) => {
    setForm({
      name: client.name || "",
      phone: client.phone || "",
      email: client.email || "",
      job_address: client.job_address || "",
      quote: client.quote?.toString() || "",
      agreed_price: client.agreed_price?.toString() || "",
      payment_status: client.payment_status || "pendiente",
      notes: client.notes || "",
    });
    setEditId(client.id);
    setDialogOpen(true);
  };

  const filtered = clients.filter(c => {
    const matchSearch = (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search) ||
      (c.job_address || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "todos" || c.payment_status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">{clients.length} clientes en total</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Nuevo cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input placeholder="Nombre del cliente" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input placeholder="6XX XXX XXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" placeholder="correo@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Dirección de la obra</Label>
                  <Input placeholder="Calle, número, ciudad" value={form.job_address} onChange={e => setForm(f => ({ ...f, job_address: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Presupuesto (€)</Label>
                  <Input type="number" placeholder="0.00" value={form.quote} onChange={e => setForm(f => ({ ...f, quote: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Precio pactado (€)</Label>
                  <Input type="number" placeholder="0.00" value={form.agreed_price} onChange={e => setForm(f => ({ ...f, agreed_price: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Estado del pago</Label>
                  <Select value={form.payment_status} onValueChange={v => setForm(f => ({ ...f, payment_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente de cobro</SelectItem>
                      <SelectItem value="parcial">Cobrado parcialmente</SelectItem>
                      <SelectItem value="cobrado">Cobrado completo ✓</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Notas</Label>
                  <Textarea placeholder="Notas adicionales del trabajo..." rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" onClick={saveClient} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? "Guardar cambios" : "Añadir cliente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre, teléfono o dirección..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente de cobro</SelectItem>
            <SelectItem value="parcial">Cobrado parcialmente</SelectItem>
            <SelectItem value="cobrado">Cobrado completo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay clientes</p>
          <p className="text-sm mt-1">Añade tu primer cliente para empezar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(client => {
            const badge = PAYMENT_BADGE[client.payment_status] || PAYMENT_BADGE.pendiente;
            return (
              <Card key={client.id} className="shadow-card border-0 hover:shadow-elevated transition-shadow cursor-pointer group">
                <CardContent className="p-4" onClick={() => openEdit(client)}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">{(client.name || "?").charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{client.name}</h3>
                        <Badge variant="secondary" className={`text-xs ${badge.className}`}>{badge.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {client.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {client.phone}
                          </span>
                        )}
                        {client.job_address && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-xs">
                            <MapPin className="w-3 h-3 flex-shrink-0" /> {client.job_address}
                          </span>
                        )}
                        {client.agreed_price && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Euro className="w-3 h-3" /> {client.agreed_price}€ pactado
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
