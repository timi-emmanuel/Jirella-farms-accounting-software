import { LoginForm } from "@/features/auth/LoginForm"

export default function LoginPage() {
 return (
  <div className="relative min-h-screen flex items-center justify-center p-4 bg-linear-to-br from-green-900 via-green-800 to-emerald-900 overflow-hidden">
   {/* Decorative background elements */}
   <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
    <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-700/20 rounded-full blur-3xl animate-pulse" />
    <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-green-700/20 rounded-full blur-3xl animate-pulse delay-700" />
   </div>

   <div className="relative z-10 w-full max-w-[400px]">
    <div className="flex flex-col items-center mb-8">
     <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
      Jirella <span className="text-emerald-400">Farms</span>
     </h1>
     <p className="text-emerald-100/60 text-sm mt-2 font-medium tracking-wide border-t border-emerald-500/20 pt-2 uppercase">
      Management System
     </p>
    </div>

    <LoginForm />

    <p className="text-center mt-8 text-emerald-100/40 text-xs">
     &copy; {new Date().getFullYear()} Jirella Farms. All rights reserved.
    </p>
   </div>
  </div>
 )
}
