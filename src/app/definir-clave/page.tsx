import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default function Password() { return <AuthForm mode="password" configured={Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)} />; }
