"use client"

import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
 ColDef,
 ModuleRegistry,  
 CellStyleModule, 
 ClientSideRowModelModule,
 ValidationModule,
 RowSelectionModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule,
 themeQuartz
} from 'ag-grid-community';
import { Loader2, Plus, UserPlus, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserProfile, UserRole } from '@/types';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
 DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select"
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ROLES } from '@/config/roles';
import { logActivity } from '@/lib/logger';
import { toast } from "@/lib/toast";

// Register modules
ModuleRegistry.registerModules([
 CellStyleModule,
 ClientSideRowModelModule,
 ValidationModule,
 RowSelectionModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule
]);

export function UserGrid() {
 const [rowData, setRowData] = useState<UserProfile[]>([]);
 const [loading, setLoading] = useState(true);
 const [showNewUser, setShowNewUser] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
 const [isDeleting, setIsDeleting] = useState(false);

 // New User State
 const [newUser, setNewUser] = useState({
  email: '',
  password: '',
  name: '',
  role: '' as UserRole | ''
 });

 const colDefs = useMemo<ColDef<UserProfile>[]>(() => [
  {
   field: "email",
   headerName: "Email",
   flex: 1.5,
   minWidth: 200,
   filter: false,
  },
  {
   field: "role",
   headerName: "Role",
   flex: 1,
   filter: false,
   cellRenderer: (params: any) => (
    <span className="px-2 py-1 bg-slate-200 rounded-full text-xs font-bold text-slate-700">
     {params.value}
    </span>
   )
  },
  {
   field: "createdAt",
   headerName: "Created At",
   flex: 1,
   valueFormatter: (p: any) => {
    const parsed = new Date(p.value);
    const datePart = parsed.toLocaleDateString('en-GB').replace(/\//g, '-');
    return `${datePart} ${parsed.toLocaleTimeString()}`;
   },
   sort: 'desc'
  },
  {
   headerName: "Actions",
   width: 100,
   cellRenderer: (params: any) => (
    <div className="flex justify-center h-full items-center">
     <button
      onClick={() => {
       setUserToDelete(params.data);
       setDeleteDialogOpen(true);
      }}
      className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
      title="Delete User"
     >
      <Trash2 className="w-4 h-4" />
     </button>
    </div>
   )
  }
 ], []);

 const loadData = async () => {
  setLoading(true);
  try {
   const res = await fetch('/api/admin/users');
   if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Failed to fetch users: ${res.status}`);
   }
   const data = await res.json();
   setRowData(data);
  } catch (error) {
   console.error(error);
  } finally {
   setLoading(false);
  }
 };

 const handleCreateUser = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true);

  try {
   const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newUser)
   });

   const data = await res.json();

   if (!res.ok) {
    throw new Error(data.error || 'Failed to create user');
   }

   toast({ title: "Success", description: "User created successfully!", variant: "success" });
   await logActivity('USER_CREATED', 'User', data.id || 'NEW', `Admin created user: ${newUser.email}`, { email: newUser.email, role: newUser.role });
   setShowNewUser(false);
   setNewUser({ email: '', password: '', name: '', role: '' });
   loadData();
  } catch (error: any) {
   toast({ title: "Error", description: error.message, variant: "destructive" });
  } finally {
   setSubmitting(false);
  }
 };

 const handleDeleteUser = async () => {
  if (!userToDelete) return;
  setIsDeleting(true);

  try {
   const res = await fetch(`/api/admin/users?userId=${userToDelete.id}`, {
    method: 'DELETE',
   });

   const data = await res.json();

   if (!res.ok) {
    throw new Error(data.error || 'Failed to delete user');
   }

   toast({ title: "Success", description: "User deleted successfully", variant: "success" });
   await logActivity('USER_DELETED', 'User', userToDelete.id, `Admin deleted user: ${userToDelete.email}`, { email: userToDelete.email, role: userToDelete.role });
   setDeleteDialogOpen(false);
   setUserToDelete(null);
   loadData();
  } catch (error: any) {
   toast({ title: "Error", description: error.message, variant: "destructive" });
  } finally {
   setIsDeleting(false);
  }
 };

 useEffect(() => {
  loadData();
 }, []);

 if (loading && rowData.length === 0) return (
  <div className="flex items-center justify-center h-full">
   <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
  </div>
 );

 return (
  <div className="flex flex-col h-full space-y-4">
   <div className="flex justify-end">
    <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
     <DialogTrigger asChild>
      <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-sm transition-all hover:scale-105 active:scale-95">
       <UserPlus className="w-4 h-4 mr-2" />
       Create New User
      </Button>
     </DialogTrigger>
     <DialogContent className="sm:max-w-106.25">
      <DialogHeader>
       <DialogTitle>Create New User</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleCreateUser} className="space-y-4 py-4">
       <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
         id="email"
         type="email"
         placeholder="user@example.com"
         value={newUser.email}
         onChange={e => setNewUser({ ...newUser, email: e.target.value })}
         required
        />
       </div>
       <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
         id="password"
         type="password"
         placeholder="********"
         value={newUser.password}
         onChange={e => setNewUser({ ...newUser, password: e.target.value })}
         required
         minLength={6}
        />
       </div>
       <div className="space-y-2">
        <Label htmlFor="name">Full Name (Optional)</Label>
        <Input
         id="name"
         placeholder="John Doe"
         value={newUser.name}
         onChange={e => setNewUser({ ...newUser, name: e.target.value })}
        />
       </div>
       <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select
         value={newUser.role}
         onValueChange={(val) => setNewUser({ ...newUser, role: val as UserRole })}
         required
        >
         <SelectTrigger>
          <SelectValue placeholder="Select a role" />
         </SelectTrigger>
         <SelectContent>
          {Object.values(ROLES).map((role) => (
           <SelectItem key={role} value={role}>
            {role.replace(/_/g, ' ')}
           </SelectItem>
          ))}
         </SelectContent>
        </Select>
       </div>
       <DialogFooter>
        <Button type="submit" disabled={submitting} className="bg-emerald-700 w-full">
         {submitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
         Create User
        </Button>
       </DialogFooter>
      </form>
     </DialogContent>
    </Dialog>
   </div>

   <div className="flex-1 bg-white border rounded-lg overflow-hidden shadow-sm ag-theme-quartz">
    <AgGridReact
     rowData={rowData}
     columnDefs={colDefs}
     defaultColDef={{
      sortable: true,
      resizable: true,
     }}
     pagination={true}
     paginationPageSize={20}
     theme={themeQuartz}
    />
   </div>

   <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
    <AlertDialogContent>
     <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center text-red-600">
       <AlertTriangle className="w-5 h-5 mr-2" />
       Delete User?
      </AlertDialogTitle>
      <AlertDialogDescription>
       Are you sure you want to delete <span className="font-bold text-slate-900">{userToDelete?.email}</span>?
       This action cannot be undone.
      </AlertDialogDescription>
     </AlertDialogHeader>
     <AlertDialogFooter>
      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
      <AlertDialogAction
       onClick={(e) => {
        e.preventDefault();
        handleDeleteUser();
       }}
       disabled={isDeleting}
       className="bg-red-600 hover:bg-red-700 text-white"
      >
       {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Delete User"}
      </AlertDialogAction>
     </AlertDialogFooter>
    </AlertDialogContent>
   </AlertDialog>
  </div>
 );
}


