import { z } from "zod";

const Env = z.object({
  GMGN_API_KEY: z.string().min(10),
  BITQUERY_TOKEN: z.string().min(10),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  // Optional. If absent, Helius lookups return null and funding source
  // scoring falls back to the v1 heuristic.
  HELIUS_API_KEY: z.string().optional(),
  // Optional. Not URL-validated because Vercel sometimes injects bare hostnames.
  // Currently unused at runtime; share links read window.location.href.
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
});

let _env: z.infer<typeof Env> | null = null;

export function env() {
  if (_env) return _env;
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  _env = parsed.data;
  return _env;
}
