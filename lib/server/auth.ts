import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export type AuthContext = {
 userId: string;
 email: string | null;
 role: string | null;
};

export async function getAuthContext(): Promise<AuthContext | null> {
 const supabase = await createServerClient();
 const { data: { user } } = await supabase.auth.getUser();

 if (!user) return null;

 const admin = createAdminClient();
 const { data: profile } = await admin
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single();

 return {
  userId: user.id,
  email: user.email ?? null,
  role: profile?.role ?? null
 };
}

export function isRoleAllowed(role: string | null, allowed: string[]) {
 if (!role) return false;
 return allowed.includes(role);
}
