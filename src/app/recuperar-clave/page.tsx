import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default function Recover() { return <AuthForm mode="recover" configured={Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)} />; }
