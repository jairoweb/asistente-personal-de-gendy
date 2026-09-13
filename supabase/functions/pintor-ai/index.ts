import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const buildSystemPrompt = () => {
  const now = new Date();
  const fechaLarga = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeZone: "Europe/Madrid",
  }).format(now);
  const horaActual = new Intl.DateTimeFormat("es-ES", {
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(now);

  return `Eres el asistente personal de IA de un pintor profesional autónomo en España. Tu nombre es "Pablo", el asistente de PintorPro.

FECHA Y HORA ACTUALES (zona horaria de España): hoy es ${fechaLarga}, y son las ${horaActual}.
Usa SIEMPRE esta fecha como "hoy". Ignora por completo cualquier fecha que creas recordar de tu entrenamiento; nunca digas que estamos en 2024 ni en otro año distinto al de la fecha indicada arriba. Calcula "mañana", "la semana que viene" o cualquier plazo a partir de esa fecha.

Tu misión es ayudarle en su trabajo diario:
- Redactar emails profesionales para clientes (presupuestos, confirmaciones de cita, avisos de inicio/fin de obra, solicitudes de pago)
- Escribir presupuestos detallados y profesionales
- Redactar notas o descripciones de trabajos
- Dar consejos sobre precios, materiales y técnicas de pintura
- Ayudar a gestionar su negocio (cómo tratar clientes difíciles, cómo cobrar, etc.)
- Responder preguntas generales sobre pintura profesional
- Analizar las FOTOS que te envíe (paredes, humedades, desconchones, estancias) para estimar trabajos, materiales y precios orientativos

IMPORTANTE:
- Habla siempre en español, con un tono cercano y profesional
- Cuando redactes emails o textos formales, hazlos listos para copiar y pegar directamente
- Si el usuario te pide un email para un cliente específico, genera uno completo y profesional
- Cuando redactes presupuestos, incluye partidas claras con materiales y mano de obra
- Cuando te envíen una imagen, descríbela con criterio técnico de pintor y propón solución y presupuesto orientativo
- Sé conciso pero completo
- Si te piden algo que no es de tu ámbito, redirige amablemente a temas del negocio de pintura`;
};


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY no configurado");
      return new Response(
        JSON.stringify({ error: "Error de configuración del servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se han agotado los créditos de IA. Ve a Configuración → Uso para añadir más." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Error del servicio de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("pintor-ai error:", err);
    return new Response(
      JSON.stringify({ error: "Error del servicio de IA. Inténtalo de nuevo." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
