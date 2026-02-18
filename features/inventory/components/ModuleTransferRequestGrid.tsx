"use client"

import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
 ColDef,
 CellStyleModule,
 ModuleRegistry,
 ClientSideRowModelModule,
 ValidationModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule,
 themeQuartz
} from 'ag-grid-community';
import { ClipboardList, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
 Dialog,
 DialogContent,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ModuleKey = 'FEED_MILL' | 'POULTRY' | 'BSF';

type TransferLine = {
 itemId?: string;
 item?: { name?: string; unit?: string };
 quantityRequested: number;
 quantityTransferred?: number | null;
};

type RequestedByProfile = {
 email: string | null;
 role: string | null;
};

type TransferRequestRow = {
 id: string;
 status: string;
 createdAt: string;
 requestDate?: string | null;
 notes?: string | null;
 requestedBy?: string | null;
 requestedByProfile?: RequestedByProfile | null;
 lines?: TransferLine[];
 to?: { code?: string };
};

type EditForm = {
 quantity: string;
 requestDate: string;
 notes: string;
};

const formatDateDMY = (date: Date) => {
 const day = String(date.getDate()).padStart(2, '0');
 const month = String(date.getMonth() + 1).padStart(2, '0');
 const year = date.getFullYear();
 return `${day}-${month}-${year}`;
};

const isoToDmy = (value?: string | null) => {
 if (!value) return formatDateDMY(new Date());
 const datePart = value.includes('T') ? value.split('T')[0] : value;
 const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
 if (!match) return formatDateDMY(new Date(value));
 return `${match[3]}-${match[2]}-${match[1]}`;
};

const dmyToIso = (value: string) => {
 const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec((value || '').trim());
 if (!match) return null;
 const [, dd, mm, yyyy] = match;
 const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
 if (Number.isNaN(date.getTime())) return null;
 return `${yyyy}-${mm}-${dd}`;
};

// Register modules
ModuleRegistry.registerModules([
 CellStyleModule,
 ClientSideRowModelModule,
 ValidationModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule
]);

export function ModuleTransferRequestGrid({ moduleKey }: { moduleKey: ModuleKey }) {
 const [rowData, setRowData] = useState<TransferRequestRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [deleting, setDeleting] = useState(false);
 const [editOpen, setEditOpen] = useState(false);
 const [deleteOpen, setDeleteOpen] = useState(false);
 const [selectedRow, setSelectedRow] = useState<TransferRequestRow | null>(null);
 const [editForm, setEditForm] = useState<EditForm>({
  quantity: '',
  requestDate: formatDateDMY(new Date()),
  notes: ''
 });

 const filteredData = useMemo(() => (
  rowData.filter(request => request.to?.code === moduleKey)
 ), [rowData, moduleKey]);

 const loadRequests = async () => {
  setLoading(true);
  const response = await fetch('/api/transfers');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
   console.error('Error loading transfer requests:', payload.error || response.statusText);
  } else {
   setRowData(payload.requests || []);
  }
  setLoading(false);
 };

 useEffect(() => {
  loadRequests();
 }, []);

 const openEditDialog = (row: TransferRequestRow) => {
  const qty = row.lines?.[0]?.quantityRequested ?? 0;
  setSelectedRow(row);
  setEditForm({
   quantity: String(qty || ''),
   requestDate: isoToDmy(row.requestDate || row.createdAt),
   notes: row.notes || ''
  });
  setEditOpen(true);
 };

 const handleSaveEdit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedRow) return;
  const quantityNum = Number(editForm.quantity);
  if (quantityNum <= 0) {
   toast({ title: 'Error', description: 'Quantity must be greater than zero.', variant: 'destructive' });
   return;
  }
  const requestDateIso = dmyToIso(editForm.requestDate);
  if (!requestDateIso) {
   toast({ title: 'Error', description: 'Date requested must be in DD-MM-YYYY format.', variant: 'destructive' });
   return;
  }

  setSaving(true);
  const response = await fetch(`/api/transfers/${selectedRow.id}`, {
   method: 'PATCH',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    quantity: quantityNum,
    requestDate: requestDateIso,
    notes: editForm.notes
   })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
   toast({ title: 'Error', description: payload.error || 'Failed to update request.', variant: 'destructive' });
  } else {
   toast({ title: 'Success', description: 'Request updated successfully.', variant: 'success' });
   setEditOpen(false);
   setSelectedRow(null);
   await loadRequests();
  }
  setSaving(false);
 };

 const handleDelete = async () => {
  if (!selectedRow) return;
  setDeleting(true);
  const response = await fetch(`/api/transfers/${selectedRow.id}`, {
   method: 'DELETE'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
   toast({ title: 'Error', description: payload.error || 'Failed to delete request.', variant: 'destructive' });
  } else {
   toast({ title: 'Success', description: 'Request deleted.', variant: 'success' });
   setDeleteOpen(false);
   setSelectedRow(null);
   await loadRequests();
  }
  setDeleting(false);
 };

 const colDefs = useMemo<ColDef<TransferRequestRow>[]>(() => [
  {
   headerName: "Item",
   flex: 1.5,
   minWidth: 180,
   filter: true,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.name || 'Unknown'
  },
  {
   headerName: "Qty",
   width: 110,
   type: 'numericColumn',
   valueGetter: (p: any) => p.data.lines?.[0]?.quantityRequested ?? 0
  },
  {
   headerName: "Unit",
   width: 90,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.unit || ''
  },
  {
   field: "requestDate",
   headerName: "Date Requested",
   width: 140,
   valueGetter: (p: any) => p.data.requestDate || p.data.createdAt,
   valueFormatter: (p: any) => isoToDmy(p.value)
  },
  {
   field: "status",
   headerName: "Status",
   width: 120,
   cellRenderer: (params: any) => {
    const status = params.value;
    let colorClass = 'bg-slate-100 text-slate-600';
    if (status === 'PENDING') colorClass = 'bg-amber-100 text-amber-700';
    if (status === 'APPROVED') colorClass = 'bg-emerald-100 text-emerald-700';
    if (status === 'REJECTED') colorClass = 'bg-rose-100 text-rose-700';
    if (status === 'COMPLETED') colorClass = 'bg-blue-100 text-blue-700';

    return (
     <span className={`px-2 py-1 rounded-full text-xs font-bold ${colorClass}`}>
      {status}
     </span>
    );
   }
  },
  {
   headerName: "Requested By",
   flex: 1.2,
   minWidth: 180,
   valueGetter: (p: any) => {
    const profile = p.data.requestedByProfile;
    if (profile?.role) return profile.role;
    if (profile?.email) return profile.email;
    if (p.data.requestedBy) return `${p.data.requestedBy.slice(0, 8)}...`;
    return '';
   }
  },
  {
   field: "createdAt",
   headerName: "Created At",
   flex: 1,
   minWidth: 160,
   valueFormatter: (p: any) => {
    const parsed = new Date(p.value);
    const datePart = parsed.toLocaleDateString('en-GB').replace(/\//g, '-');
    return `${datePart} ${parsed.toLocaleTimeString()}`;
   }
  },
  {
   field: "notes",
   headerName: "Notes",
   flex: 1.5,
   minWidth: 200
  },
  {
   headerName: "Actions",
   width: 110,
   sortable: false,
   filter: false,
   cellRenderer: (params: any) => {
    const row = params.data as TransferRequestRow;
    const canEdit = row.status === 'PENDING';
    return (
     <div className="flex items-center justify-center h-full gap-2">
      <button
       disabled={!canEdit}
       onClick={() => openEditDialog(row)}
       className="text-slate-500 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed"
       title={canEdit ? "Edit request" : "Only pending requests can be edited"}
      >
       <Pencil className="w-4 h-4" />
      </button>
      <button
       disabled={!canEdit}
       onClick={() => {
        setSelectedRow(row);
        setDeleteOpen(true);
       }}
       className="text-slate-500 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed"
       title={canEdit ? "Delete request" : "Only pending requests can be deleted"}
      >
       <Trash2 className="w-4 h-4" />
      </button>
     </div>
    );
   }
  }
 ], []);

 if (loading) return (
  <div className="flex items-center justify-center h-full">
   <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
  </div>
 );

 return (
  <div className="flex flex-col h-full space-y-4">
   <div className="flex-1 bg-white border rounded-lg overflow-hidden shadow-sm ag-theme-quartz">
    {filteredData.length === 0 ? (
     <div className="flex flex-col items-center justify-center h-full text-slate-400">
      <ClipboardList className="w-12 h-12 mb-2 opacity-20" />
      <p>No requests found</p>
     </div>
    ) : (
     <AgGridReact
      rowData={filteredData}
      columnDefs={colDefs}
      defaultColDef={{
       sortable: true,
       resizable: true,
      }}
      pagination={true}
      paginationPageSize={20}
      theme={themeQuartz}
     />
    )}
   </div>

   <Dialog open={editOpen} onOpenChange={setEditOpen}>
    <DialogContent>
     <DialogHeader>
      <DialogTitle>Edit Request</DialogTitle>
     </DialogHeader>
     <form onSubmit={handleSaveEdit} className="space-y-4">
      <div className="space-y-2">
       <Label htmlFor="editQty">Quantity</Label>
       <Input
        id="editQty"
        type="number"
        step="0.01"
        value={editForm.quantity}
        onChange={(e) => setEditForm(prev => ({ ...prev, quantity: e.target.value }))}
        required
       />
      </div>
      <div className="space-y-2">
       <Label htmlFor="editDate">Date Requested</Label>
       <Input
        id="editDate"
        type="text"
        placeholder="DD-MM-YYYY"
        value={editForm.requestDate}
        onChange={(e) => setEditForm(prev => ({ ...prev, requestDate: e.target.value }))}
        required
       />
      </div>
      <div className="space-y-2">
       <Label htmlFor="editNotes">Notes</Label>
       <Textarea
        id="editNotes"
        value={editForm.notes}
        onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
       />
      </div>
      <DialogFooter>
       <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Save Changes
       </Button>
      </DialogFooter>
     </form>
    </DialogContent>
   </Dialog>

   <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
    <AlertDialogContent>
     <AlertDialogHeader>
      <AlertDialogTitle>Delete Request?</AlertDialogTitle>
      <AlertDialogDescription>
       This will permanently remove the selected pending request.
      </AlertDialogDescription>
     </AlertDialogHeader>
     <AlertDialogFooter>
      <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
      <AlertDialogAction
       disabled={deleting}
       onClick={(e) => {
        e.preventDefault();
        handleDelete();
       }}
       className="bg-rose-600 hover:bg-rose-700 text-white"
      >
       {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
       Delete
      </AlertDialogAction>
     </AlertDialogFooter>
    </AlertDialogContent>
   </AlertDialog>
  </div>
 );
}
