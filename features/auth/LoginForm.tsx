"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export function LoginForm() {
 const router = useRouter()
 const [loading, setLoading] = useState(false)
 const [error, setError] = useState("")

 async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setLoading(true)
  setError("")

  const formData = new FormData(event.currentTarget)
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const supabase = createClient()

  const { error: authError } = await supabase.auth.signInWithPassword({
   email,
   password,
  })

  if (authError) {
   setError(authError.message)
   setLoading(false)
  } else {
   router.push("/dashboard")
   router.refresh()
  }
 }

 return (
  <div className="grid gap-6 w-full max-w-sm">
   <form onSubmit={handleSubmit}>
    <div className="grid gap-4">
     <div className="grid gap-2">
      <label
       className="text-sm font-medium leading-none"
       htmlFor="email"
      >
       Email
      </label>
      <input
       className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
       id="email"
       placeholder="name@example.com"
       type="email"
       autoCapitalize="none"
       autoComplete="email"
       autoCorrect="off"
       name="email"
       disabled={loading}
       required
      />
     </div>
     <div className="grid gap-2">
      <label
       className="text-sm font-medium leading-none"
       htmlFor="password"
      >
       Password
      </label>
      <input
       className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
       id="password"
       placeholder="password"
       type="password"
       autoCapitalize="none"
       autoComplete="current-password"
       name="password"
       disabled={loading}
       required
      />
     </div>
     {error && (
      <div className="text-sm font-medium text-red-500">
       {error}
      </div>
     )}
     <button
      className={cn(
       "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
       "bg-slate-900 text-white shadow hover:bg-slate-900/90 h-9 px-4 py-2"
      )}
      disabled={loading}
     >
      {loading && (
       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      )}
      Sign In
     </button>
    </div>
   </form>
  </div>
 )
}
