"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function LoginForm() {
 const router = useRouter()
 const [loading, setLoading] = useState(false)
 const [error, setError] = useState("")

 async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setLoading(true)
  setError("")

  const formData = new FormData(event.currentTarget)
  const email = formData.get("username") as string
  const password = formData.get("password") as string

  try {
   const result = await signIn("credentials", {
    email,
    password,
    redirect: false,
   })

   if (result?.error) {
    setError("Invalid email or password")
    setLoading(false)
   } else {
    router.push("/dashboard")
    router.refresh()
   }
  } catch (err) {
   setError("Something went wrong")
   setLoading(false)
  }
 }

 return (
  <div className="grid gap-6 w-full max-w-sm">
   <form onSubmit={handleSubmit}>
    <div className="grid gap-4">
     <div className="grid gap-2">
      <label
       className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
       htmlFor="username"
      >
       Username
      </label>
      <input
       className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
       id="username"
       placeholder="john.doe"
       type="username"
       autoCapitalize="none"
       autoComplete="username"
       autoCorrect="off"
       name="username"
       disabled={loading}
       required
      />
     </div>
     <div className="grid gap-2">
      <label
       className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
      <div className="text-sm text-red-500 font-medium">
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
