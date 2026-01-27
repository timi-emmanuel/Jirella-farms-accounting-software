// app/(main)/layout.tsx
import { Sidebar } from "@/components/Sidebar"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
         
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // auth guard
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <main className="flex-1 overflow-hidden px-8 pt-8 pb-4 min-h-0">
          {children}
        </main>
      </div>
    </div>
  )
}
