import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return <AuthShell><AuthForm mode="login" configured={Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)} invalidLink={query.error === "invalid_link"} sessionExpired={query.error === "session_expired"} /></AuthShell>;
}
