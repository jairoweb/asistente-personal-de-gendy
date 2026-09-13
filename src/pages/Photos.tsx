import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Image as ImageIcon, Trash2, Loader2, ZoomIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TYPE_LABELS: Record<string, string> = {
  antes: "Antes 📷",
  despues: "Después ✨",
};

export default function Photos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedClient, setSelectedClient] = useState("todos");
  const [selectedType, setSelectedType] = useState("todos");
  const [uploadForm, setUploadForm] = useState({ client_id: "", photo_type: "antes", description: "" });
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadAll = async () => {
    setLoading(true);
    const [photosRes, clientsRes] = await Promise.all([
      supabase.from("photos").select("*, clients(name)").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").eq("user_id", user!.id).order("name"),
    ]);
    setPhotos(photosRes.data || []);
    setClients(clientsRes.data || []);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadForm.client_id) {
      if (!uploadForm.client_id) toast({ title: "Selecciona un cliente primero", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${uploadForm.client_id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("work-photos").upload(path, file);
    if (uploadError) {
      toast({ title: "Error al subir foto", description: "No se pudo subir la foto. Inténtalo de nuevo.", variant: "destructive" });
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("photos").insert({
      user_id: user!.id,
      client_id: uploadForm.client_id,
      url: path,
      photo_type: uploadForm.photo_type,
      description: uploadForm.description,
    });

    if (dbError) {
      toast({ title: "Error al guardar foto", description: "No se pudo guardar la foto. Inténtalo de nuevo.", variant: "destructive" });
    } else {
      toast({ title: "Foto subida ✓" });
      loadAll();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const getPhotoUrl = async (url: string) => {
    if (url.startsWith("http")) return url;
    const { data } = await supabase.storage.from("work-photos").createSignedUrl(url, 3600);
    return data?.signedUrl || "";
  };

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from("work-photos").createSignedUrl(path, 3600);
    return data?.signedUrl || "";
  };

  const openPhoto = async (photo: any) => {
    const url = await getSignedUrl(photo.url);
    setPreview(url);
  };

  const deletePhoto = async (photo: any) => {
    await supabase.storage.from("work-photos").remove([photo.url]);
    await supabase.from("photos").delete().eq("id", photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    toast({ title: "Foto eliminada" });
  };

  const filtered = photos.filter(p => {
    const matchClient = selectedClient === "todos" || p.client_id === selectedClient;
    const matchType = selectedType === "todos" || p.photo_type === selectedType;
    return matchClient && matchType;
  });

  // Group by client
  const groupedByClient: Record<string, any[]> = {};
  filtered.forEach(p => {
    const key = p.clients?.name || "Sin cliente";
    if (!groupedByClient[key]) groupedByClient[key] = [];
    groupedByClient[key].push(p);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fotos de Trabajos</h1>
        <p className="text-muted-foreground text-sm">{photos.length} fotos en total</p>
      </div>

      {/* Upload Panel */}
      <Card className="shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Subir foto nueva
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={uploadForm.client_id} onValueChange={v => setUploadForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={uploadForm.photo_type} onValueChange={v => setUploadForm(f => ({ ...f, photo_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="antes">📷 Antes</SelectItem>
                  <SelectItem value="despues">✨ Después</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input placeholder="Opcional..." value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <Button className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploading || !uploadForm.client_id}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Subiendo..." : "Elegir foto"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="antes">📷 Antes</SelectItem>
            <SelectItem value="despues">✨ Después</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Gallery */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay fotos</p>
          <p className="text-sm mt-1">Sube fotos del antes y después de tus trabajos</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByClient).map(([clientName, clientPhotos]) => (
            <div key={clientName}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{clientName}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {clientPhotos.map(photo => (
                  <PhotoCard key={photo.id} photo={photo} onOpen={() => openPhoto(photo)} onDelete={() => deletePhoto(photo)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          {preview && <img src={preview} alt="Foto trabajo" className="w-full rounded-lg max-h-[80vh] object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhotoCard({ photo, onOpen, onDelete }: { photo: any; onOpen: () => void; onDelete: () => void }) {
  const [src, setSrc] = useState<string>("");
  const { user } = useAuth();

  useEffect(() => {
    supabase.storage.from("work-photos").createSignedUrl(photo.url, 3600).then(({ data }) => {
      if (data?.signedUrl) setSrc(data.signedUrl);
    });
  }, [photo.url]);

  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-muted shadow-card">
      {src ? (
        <img src={src} alt={photo.description || ""} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        <button onClick={onOpen} className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-foreground hover:bg-white">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="w-8 h-8 rounded-full bg-destructive/90 flex items-center justify-center text-white hover:bg-destructive">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {/* Badge tipo */}
      <div className="absolute top-2 left-2">
        <Badge variant="secondary" className={`text-xs ${photo.photo_type === "antes" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
          {photo.photo_type === "antes" ? "📷 Antes" : "✨ Después"}
        </Badge>
      </div>
      {photo.description && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-xs truncate">{photo.description}</p>
        </div>
      )}
    </div>
  );
}
