import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
 try {
  const { event, userId, email } = await request.json();

  // Validate required fields
  if (!event || !userId) {
   return NextResponse.json(
    { error: 'Missing required fields' },
    { status: 400 }
   );
  }

  // Create Supabase client with service role for logging
  const supabase = createClient(
   process.env.NEXT_PUBLIC_SUPABASE_URL!,
   process.env.SUPABASE_SERVICE_ROLE_KEY!,
   {
    auth: {
     autoRefreshToken: false,
     persistSession: false
    }
   }
  );

  // Get user role from public.users table
  const { data: userProfile } = await supabase
   .from('users')
   .select('role')
   .eq('id', userId)
   .single();

  const userRole = userProfile?.role || null;

  // Determine description based on event
  let description = '';
  if (event === 'SIGNED_IN') {
   description = `User signed in`;
  } else if (event === 'SIGNED_OUT') {
   description = `User signed out`;
  }

  if (event === 'SIGNED_IN') {
   const { data: lastLogin } = await supabase
    .from('ActivityLog')
    .select('timestamp')
    .eq('action', 'AUTH_LOGIN')
    .eq('userId', userId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

   if (lastLogin?.timestamp) {
    const lastTime = new Date(lastLogin.timestamp).getTime();
    const nowTime = Date.now();
    const withinWindow = nowTime - lastTime < 30 * 60 * 1000;
    if (withinWindow) {
     return NextResponse.json({ success: true, skipped: true });
    }
   }
  }

  // Insert activity log
  const { error: logError } = await supabase
   .from('ActivityLog')
   .insert({
    action: event === 'SIGNED_IN' ? 'AUTH_LOGIN' : 'AUTH_LOGOUT',
    entityType: 'Auth',
    entityId: userId,
    description,
    metadata: { email },
    userId,
    userRole,
    timestamp: new Date().toISOString()
   });

  if (logError) {
   console.error('Error logging auth activity:', logError);
   return NextResponse.json(
    { error: 'Failed to log activity' },
    { status: 500 }
   );
  }

  return NextResponse.json({ success: true });
 } catch (error) {
  console.error('Auth logging error:', error);
  return NextResponse.json(
   { error: 'Internal server error' },
   { status: 500 }
  );
 }
}
