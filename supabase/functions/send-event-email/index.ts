import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple HTML entity escaping to prevent injection in email templates
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

    const { to, eventType, emoji, clientName, address, dateStr, description } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY no configurado");
      return new Response(
        JSON.stringify({ error: "Error de configuración del servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize all user-provided values before inserting into HTML
    const safeEmoji = escapeHtml(emoji || "");
    const safeEventType = escapeHtml(eventType || "");
    const safeClientName = escapeHtml(clientName || "");
    const safeAddress = escapeHtml(address || "");
    const safeDateStr = escapeHtml(dateStr || "");
    const safeDescription = escapeHtml(description || "");

    const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f5f7fa; }
    .container { max-width: 560px; margin: 32px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e3a5f, #152b47); padding: 32px 28px; }
    .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: #93c5fd; margin: 4px 0 0; font-size: 13px; }
    .badge { display: inline-block; background: #ea6c22; color: white; border-radius: 20px; padding: 6px 16px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
    .body { padding: 28px; }
    .field { margin-bottom: 16px; }
    .field-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .field-value { font-size: 15px; color: #1f2937; font-weight: 500; }
    .footer { background: #f9fafb; padding: 16px 28px; text-align: center; }
    .footer p { margin: 0; color: #9ca3af; font-size: 12px; }
    hr { border: none; border-top: 1px solid #f0f0f0; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎨 PintorPro</h1>
      <p>Tu asistente personal de trabajo</p>
    </div>
    <div class="body">
      <div class="badge">${safeEmoji} ${safeEventType}</div>
      <div class="field">
        <div class="field-label">Cliente</div>
        <div class="field-value">${safeClientName}</div>
      </div>
      ${safeAddress !== "Sin dirección" ? `
      <div class="field">
        <div class="field-label">📍 Dirección de la obra</div>
        <div class="field-value">${safeAddress}</div>
      </div>` : ""}
      <div class="field">
        <div class="field-label">📅 Fecha y hora</div>
        <div class="field-value">${safeDateStr}</div>
      </div>
      ${safeDescription ? `
      <hr>
      <div class="field">
        <div class="field-label">📝 Notas</div>
        <div class="field-value">${safeDescription}</div>
      </div>` : ""}
    </div>
    <div class="footer">
      <p>Enviado desde PintorPro — Tu asistente personal</p>
    </div>
  </div>
</body>
</html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PintorPro <onboarding@resend.dev>",
        to: [to],
        subject: `${safeEmoji} ${safeEventType} — ${safeClientName} | ${safeDateStr}`,
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", res.status, JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Error al enviar el email. Inténtalo de nuevo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error sending email:", err);
    return new Response(JSON.stringify({ error: "Error al enviar el email. Inténtalo de nuevo." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
