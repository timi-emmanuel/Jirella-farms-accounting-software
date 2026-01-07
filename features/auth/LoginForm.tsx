"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

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
  <Card className="w-full border-none shadow-2xl bg-white/95 backdrop-blur-sm">
   <CardHeader className="space-y-1">
    <CardTitle className="text-2xl font-bold tracking-tight text-center">Sign In</CardTitle>
    <CardDescription className="text-center">
     Enter your credentials to access the system
    </CardDescription>
   </CardHeader>
   <form onSubmit={handleSubmit}>
    <CardContent className="grid gap-4">
     <div className="grid gap-2">
      <Label htmlFor="email">Email</Label>
      <Input
       id="email"
       name="email"
       type="email"
       placeholder="name@example.com"
       autoCapitalize="none"
       autoComplete="email"
       autoCorrect="off"
       disabled={loading}
       required
      />
     </div>
     <div className="grid gap-2">
      <Label htmlFor="password">Password</Label>
      <Input
       id="password"
       name="password"
       type="password"
       placeholder="••••••••"
       autoComplete="current-password"
       disabled={loading}
       required
      />
     </div>
     {error && (
      <div className="text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1">
       {error}
      </div>
     )}
    </CardContent>
    <CardFooter>
     <Button
      className="w-full bg-green-700 hover:bg-green-800 transition-all mt-3"
      disabled={loading}
     >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Sign In
     </Button>
    </CardFooter>
   </form>
  </Card>
 )
}
