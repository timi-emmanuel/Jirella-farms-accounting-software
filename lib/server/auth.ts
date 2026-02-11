import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export type AuthContext = {
 userId: string;
 email: string | null;
 role: string | null;
 isActive: boolean;
};

export async function getAuthContext(): Promise<AuthContext | null> {
 const supabase = await createServerClient();
 const { data: { user } } = await supabase.auth.getUser();

 if (!user) return null;

 const admin = createAdminClient();
 const { data: profileWithActive, error: activeError } = await admin
  .from('users')
  .select('role, isActive')
  .eq('id', user.id)
  .single();

 // Backward compatibility: if isActive column is not yet present, fall back to role-only check.
 if (activeError) {
  const { data: legacyProfile } = await admin
   .from('users')
   .select('role')
   .eq('id', user.id)
   .single();

  if (!legacyProfile) return null;

  return {
   userId: user.id,
   email: user.email ?? null,
   role: legacyProfile.role ?? null,
   isActive: true
  };
 }

 if (!profileWithActive || profileWithActive.isActive === false) {
  return null;
 }

 return {
  userId: user.id,
  email: user.email ?? null,
  role: profileWithActive?.role ?? null,
  isActive: profileWithActive?.isActive ?? true
 };
}

export function isRoleAllowed(role: string | null, allowed: string[]) {
 if (!role) return false;
 return allowed.includes(role);
}
