import { createAdminClient } from '@/lib/supabase/admin';

type ActivityPayload = {
 action: string;
 entityType: string;
 entityId?: string;
 description?: string;
 metadata?: any;
 userId: string;
 userRole?: string | null;
 ipAddress?: string | null;
};

export async function logActivityServer(payload: ActivityPayload) {
 try {
  const admin = createAdminClient();
  await admin.from('ActivityLog').insert({
   action: payload.action,
   entityType: payload.entityType,
   entityId: payload.entityId,
   description: payload.description ?? null,
   metadata: payload.metadata ?? null,
   userId: payload.userId,
   userRole: payload.userRole ?? null,
   ipAddress: payload.ipAddress ?? null
  });
 } catch (error) {
  console.error('Activity log insert failed:', error);
 }
}
