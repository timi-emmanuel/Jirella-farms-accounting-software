"use client"

import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
 ColDef,
 ModuleRegistry,
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
import { Loader2, Plus, UserPlus } from 'lucide-react';
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
import { ROLES } from '@/config/roles';

// Register modules
ModuleRegistry.registerModules([
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
   filter: true
  },
  {
   field: "role",
   headerName: "Role",
   flex: 1,
   filter: true,
   cellRenderer: (params: any) => (
    <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700">
     {params.value}
    </span>
   )
  },
  {
   field: "createdAt",
   headerName: "Created At",
   flex: 1,
   valueFormatter: (p: any) => new Date(p.value).toLocaleDateString() + ' ' + new Date(p.value).toLocaleTimeString(),
   sort: 'desc'
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

   alert("User created successfully!");
   setShowNewUser(false);
   setNewUser({ email: '', password: '', name: '', role: '' });
   loadData();
  } catch (error: any) {
   alert(error.message);
  } finally {
   setSubmitting(false);
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
      <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all hover:scale-105 active:scale-95">
       <UserPlus className="w-4 h-4 mr-2" />
       Create New User
      </Button>
     </DialogTrigger>
     <DialogContent className="sm:max-w-[425px]">
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
        <Button type="submit" disabled={submitting} className="bg-emerald-600 w-full">
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
  </div>
 );
}
