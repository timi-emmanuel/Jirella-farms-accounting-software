'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function AuthLogger() {
 useEffect(() => {
  const supabase = createClient();

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
   // Only log explicit sign-ins, not INITIAL_SESSION (page reload)
   if (event === 'SIGNED_IN' && session?.user) {
    // Fire and forget - don't await to avoid blocking
    fetch('/api/auth/log', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
      event: 'SIGNED_IN',
      userId: session.user.id,
      email: session.user.email
     })
    }).catch(err => console.error('Failed to log auth event:', err));
   }
   // Note: SIGNED_OUT logging is skipped as session is null and we can't identify the user
  });

  return () => {
   subscription.unsubscribe();
  };
 }, []);

 return null;
}
