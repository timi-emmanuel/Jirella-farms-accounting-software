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
   const supabase = createClient();

   // 1. Get Auth User
   const { data: { user } } = await supabase.auth.getUser();

   if (user) {
    // 2. Get Profile from public.users
    const { data, error } = await supabase
     .from('users')
     .select('*')
     .eq('id', user.id)
     .single();

    if (data) {
     setRole(data.role);
     setProfile(data);
    }
   }
   setLoading(false);
  };

  fetchRole();
 }, []);

 return { role, loading, profile, isAdmin: role === 'ADMIN', isManager: role === 'MANAGER' };
}
