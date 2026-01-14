
import { createClient } from '@/lib/supabase/client';

export type ActivityAction =
 | 'RECIPE_CREATED'
 | 'RECIPE_UPDATED'
 | 'RECIPE_DELETED'
 | 'PRODUCTION_LOGGED'
 | 'STORE_REQUEST_CREATED'
 | 'STORE_REQUEST_APPROVED'
 | 'STORE_REQUEST_REJECTED'
 | 'STORE_RECEIPT'
 | 'SALE_LOGGED'
 | 'SALE_UPDATED'
 | 'USER_CREATED'
 | 'USER_DELETED'
 | 'AUTH_LOGIN'
 | 'AUTH_LOGOUT';

export async function logActivity(
 action: ActivityAction,
 entityType: string,
 entityId: string | undefined,
 description: string,
 metadata: any = {},
 userId?: string
) {
 try {
  const supabase = createClient();
  let uid = userId;
  let role = null;

  if (!uid) {
   const { data: { user } } = await supabase.auth.getUser();
   uid = user?.id;
   role = user?.user_metadata?.role || null;
  }

  if (!uid) return;

  // Attempt to get role if not found in metadata (fallback)
  if (!role) {
   // fetching from public.users if needed, or rely on client passing it?
   // simple fetch
   const { data: userProfile } = await supabase.from('users').select('role').eq('id', uid).single();
   role = userProfile?.role;
  }

  await supabase.from('ActivityLog').insert({
   action,
   entityType,
   entityId,
   description,
   metadata,
   userId: uid,
   userRole: role,
   // ipAddress is hard to get reliably client-side without a backend function, omitting for now or could use a 3rd party if critical
  });
 } catch (error) {
  console.error("Failed to log activity:", error);
 }
}
