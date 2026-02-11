import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
 try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
   console.error("Missing Env Vars:", { supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey });
   return NextResponse.json({ error: 'Server Configuration Error: Missing Supabase Env Vars' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
   auth: {
    autoRefreshToken: false,
    persistSession: false
   }
  });

  // 1. Verify the requester is an ADMIN
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check role in public.users
  const { data: requesterProfile } = await supabaseAdmin
   .from('users')
   .select('role')
   .eq('id', user.id)
   .single();

  if (requesterProfile?.role !== 'ADMIN') {
   return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
  }

  // 2. Parse body
  const { email, password, role, name } = await req.json();

  if (!email || !password || !role) {
   return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // 3. Create user in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
   email,
   password,
   email_confirm: true,
   user_metadata: { name }
  });

  if (authError) {
   return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  if (!authData.user) {
   return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }

  // 4. Create/Update profile in public.users
  let { error: profileError } = await supabaseAdmin
   .from('users')
   .upsert({
    id: authData.user.id,
    email: email,
    role: role,
    isActive: true
    // Removed updatedAt as it doesn't exist in the current schema
   });

  // Backward compatibility for DBs that have not yet added users.isActive
  if (profileError && profileError.message?.toLowerCase().includes('isactive')) {
   const fallback = await supabaseAdmin
    .from('users')
    .upsert({
     id: authData.user.id,
     email: email,
     role: role
    });
   profileError = fallback.error;
  }

  if (profileError) {
   return NextResponse.json({ error: 'User created in Auth but failed to set Profile: ' + profileError.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'User created successfully', user: authData.user });

 } catch (error: any) {
  console.error("API Error:", error);
  return NextResponse.json({ error: error.message }, { status: 500 });
 }
}

export async function GET(req: NextRequest) {
 try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
   console.error("Missing Env Vars:", { supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey });
   return NextResponse.json({ error: 'Server Configuration Error: Missing Supabase Env Vars' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
   auth: {
    autoRefreshToken: false,
    persistSession: false
   }
  });

  // 1. Verify the requester is an ADMIN
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
   console.error("Auth Error:", authError);
   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: requesterProfile, error: profileError } = await supabaseAdmin
   .from('users')
   .select('role')
   .eq('id', user.id)
   .single();

  if (profileError) {
   console.error("Profile Fetch Error:", profileError);
   return NextResponse.json({ error: 'Failed to verify admin status' }, { status: 500 });
  }

  if (requesterProfile?.role !== 'ADMIN') {
   console.error("Role Check Failed. Role:", requesterProfile?.role);
   return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
  }

  // 2. Fetch users
  // We fetch from Auth API to get the authoritative list including created_at
  const { data: { users: authUsers }, error: authListError } = await supabaseAdmin.auth.admin.listUsers();

  if (authListError) {
   console.error("Fetch Auth Users Error:", authListError);
   throw authListError;
  }

  // Fetch roles from public.users
  let { data: publicProfiles, error: publicError } = await supabaseAdmin
   .from('users')
   .select('id, role, isActive');

  // Backward compatibility for DBs that have not yet added users.isActive
  if (publicError && publicError.message?.toLowerCase().includes('isactive')) {
   const fallback = await supabaseAdmin
    .from('users')
    .select('id, role');
   publicProfiles = (fallback.data || []).map((p: any) => ({ ...p, isActive: true }));
   publicError = fallback.error;
  }

  if (publicError) {
   console.error("Fetch Public Profiles Error:", publicError);
   throw publicError;
  }

  // Merge Data
  const combinedUsers = authUsers.map(user => {
   const profile = publicProfiles?.find(p => p.id === user.id);
   const isAuthBanned = Boolean((user as any).banned_until);
   return {
    id: user.id,
    email: user.email,
    role: profile?.role || 'STAFF', // Default if missing
    // Prefer profile flag; fall back to auth ban status for backward compatibility.
    isActive: profile?.isActive ?? !isAuthBanned,
    createdAt: user.created_at, // This comes from Auth and is always present
    lastSignIn: user.last_sign_in_at
   };
  });

  // Sort by created at desc
  combinedUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(combinedUsers);

 } catch (error: any) {
  console.error("API Error:", error);
  return NextResponse.json({ error: error.message }, { status: 500 });
 }
}

export async function DELETE(req: NextRequest) {
 try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
   return NextResponse.json({ error: 'Server Configuration Error: Missing Supabase Env Vars' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
   auth: {
    autoRefreshToken: false,
    persistSession: false
   }
  });

  // 1. Verify the requester is an ADMIN
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: requesterProfile } = await supabaseAdmin
   .from('users')
   .select('role')
   .eq('id', user.id)
   .single();

  if (requesterProfile?.role !== 'ADMIN') {
   return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
  }

  // 2. Parse query params for user ID to delete
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
   return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  // Prevent self-deletion
  if (userId === user.id) {
   return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 });
  }

  // 3. Soft delete: deactivate profile instead of hard-deleting auth user
  let { error: profileDeactivateError } = await supabaseAdmin
   .from('users')
   .update({ isActive: false })
   .eq('id', userId);

  // Backward compatibility for DBs that have not yet added users.isActive
  if (profileDeactivateError && profileDeactivateError.message?.toLowerCase().includes('isactive')) {
   profileDeactivateError = null;
  }

  if (profileDeactivateError) {
   return NextResponse.json({ error: profileDeactivateError.message }, { status: 400 });
  }

  // 4. Ban account for a long period so user cannot sign in.
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
   ban_duration: '876000h'
  });

  if (banError) {
   return NextResponse.json({ error: banError.message }, { status: 400 });
  }

  return NextResponse.json({ message: 'User deactivated successfully' });

 } catch (error: any) {
  console.error("API Error:", error);
  return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
