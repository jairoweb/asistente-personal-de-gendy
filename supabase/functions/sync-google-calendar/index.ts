import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user session to access provider_token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Sesión no encontrada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerToken = session.provider_token;
    if (!providerToken) {
      return new Response(
        JSON.stringify({ 
          error: "No hay token de Google. Inicia sesión con Google para sincronizar el calendario.",
          needsGoogleAuth: true 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { summary, description, location, startDate, startTime, endTime } = await req.json();

    // Build Google Calendar event
    let start: any;
    let end: any;

    if (startTime) {
      start = { dateTime: `${startDate}T${startTime}:00`, timeZone: "Europe/Madrid" };
      const endT = endTime || (() => {
        const h = parseInt(startTime.slice(0, 2)) + 1;
        return `${String(h).padStart(2, "0")}:${startTime.slice(3, 5)}`;
      })();
      end = { dateTime: `${startDate}T${endT}:00`, timeZone: "Europe/Madrid" };
    } else {
      start = { date: startDate };
      // For all-day events, end date is the next day
      const d = new Date(startDate);
      d.setDate(d.getDate() + 1);
      end = { date: d.toISOString().split("T")[0] };
    }

    const calendarEvent = {
      summary,
      description: description || "",
      location: location || "",
      start,
      end,
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 1440 }, // 1 day before
        ],
      },
    };

    // Create event in Google Calendar
    const gcalRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarEvent),
      }
    );

    if (!gcalRes.ok) {
      const errBody = await gcalRes.text();
      console.error("Google Calendar API error:", gcalRes.status, errBody);
      
      if (gcalRes.status === 401 || gcalRes.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: "Token de Google expirado. Vuelve a iniciar sesión con Google.",
            needsGoogleAuth: true 
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Google Calendar API error [${gcalRes.status}]: ${errBody}`);
    }

    const gcalData = await gcalRes.json();

    return new Response(
      JSON.stringify({ success: true, eventId: gcalData.id, htmlLink: gcalData.htmlLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error syncing to Google Calendar:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
