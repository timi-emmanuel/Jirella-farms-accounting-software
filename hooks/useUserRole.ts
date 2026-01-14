"use client"

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserProfile, UserRole } from '@/types';

export function useUserRole() {
 const [role, setRole] = useState<UserRole | null>(null);
 const [loading, setLoading] = useState(true);
 const [profile, setProfile] = useState<UserProfile | null>(null);

 useEffect(() => {
  const fetchRole = async () => {
   try {
    const supabase = createClient();

    // 1. Get Auth User
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (user) {
     // 2. Get Profile from public.users
     const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

     if (error && error.code !== 'PGRST116') { // Ignore "Row not found" if that's the case, but unexpected for logged in user
      console.error("Error fetching user profile:", error);
     }

     if (data) {
      setRole(data.role);
      setProfile(data);
     }
    }
   } catch (error) {
    console.error("useUserRole error:", error);
   } finally {
    setLoading(false);
   }
  };

  fetchRole();
 }, []);

 return { role, loading, profile, isAdmin: role === 'ADMIN', isManager: role === 'MANAGER' };
}
