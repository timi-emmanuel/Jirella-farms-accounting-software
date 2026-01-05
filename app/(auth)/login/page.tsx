import { LoginForm } from "@/features/auth/LoginForm"

export default function LoginPage() {
 return (
  <div className="container h-screen flex flex-col items-center justify-center bg-green-900">
   <div className="lg:p-8">
    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
     <div className="flex flex-col space-y-2 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
       Sign In
      </h1>
      <p className="text-sm text-muted-foreground">
       Enter your credentials to access the system
      </p>
     </div>
     <LoginForm />
    </div>
   </div> 
  </div>
 )
}
