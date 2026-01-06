import { Sidebar } from "@/components/Sidebar"

export default function DashboardLayout({
 children,
}: {
 children: React.ReactNode
}) {
 return (
  <div className="flex h-screen bg-gray-600 overflow-hidden">
   <Sidebar />
   <div className="flex-1 flex flex-col overflow-hidden">
    <main className="flex-1 overflow-auto p-8">
     {children}
    </main>
   </div>
  </div>
 )
}
