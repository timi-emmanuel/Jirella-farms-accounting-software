
import { UserGrid } from "@/features/admin/components/UserGrid";
import { Users } from "lucide-react";

export default function UsersPage() {
 return (
  <div className="h-full flex flex-col space-y-4">
   <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
    <p className="text-sm text-gray-400">
     <Users className="w-4 h-4 mr-1 inline" />
     Create, manage, and assign roles to system users
    </p>
   </div>
   <div className="flex-1 overflow-hidden">
    <UserGrid />
   </div>
  </div>
 );
}
