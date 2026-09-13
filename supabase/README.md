# Base de datos Supabase

La migración `20260913000000_initial_schema.sql` crea la estructura mínima que utiliza la aplicación:

- `clients`: clientes, presupuestos y estado de cobro.
- `events`: citas, obras, cobros y recordatorios.
- `photos`: fotografías asociadas a un cliente.
- `ai_conversations` y `ai_messages`: memoria temporal del asistente con expiración de 24 horas.
- Bucket privado `work-photos` para las imágenes.
- Índices, timestamps automáticos y políticas RLS por usuario autenticado.

Para aplicar la migración en un proyecto Supabase:

```bash
supabase link --project-ref kybplkklwroptgfppgsv
supabase db push
```

La aplicación debe seguir usando las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el entorno del frontend. Las claves de Edge Functions se configuran en Supabase Secrets, nunca en el repositorio.
