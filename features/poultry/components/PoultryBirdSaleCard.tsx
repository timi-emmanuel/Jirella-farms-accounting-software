"use client";

import { useEffect, useMemo, useState } from 'react';
import { Bird, Loader2 } from 'lucide-react';
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FlockRow = {
  id: string;
  name: string;
  currentCount: number;
  status?: string;
};

type Props = {
  onSaleSaved?: () => void;
  buttonClassName?: string;
};

export function PoultryBirdSaleCard({ onSaleSaved, buttonClassName }: Props) {
  const [flocks, setFlocks] = useState<FlockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    flockId: '',
    quantitySold: '',
    unitSellingPrice: '',
    soldAt: new Date().toISOString().split('T')[0],
    notes: '',
    customerName: '',
    customerContact: '',
    customerAddress: ''
  });

  const loadFlocks = async () => {
    const response = await fetch('/api/poultry/flocks');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Flocks load error:', payload.error || response.statusText);
    } else {
      setFlocks(payload.flocks || []);
    }
  };

  useEffect(() => {
    loadFlocks();
  }, []);

  const selectedFlock = useMemo(
    () => flocks.find((flock) => flock.id === form.flockId),
    [flocks, form.flockId]
  );

  const remainingAfterSale = selectedFlock
    ? Number(selectedFlock.currentCount || 0) - Number(form.quantitySold || 0)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.flockId) {
      toast({ title: "Missing flock", description: "Select a flock to sell birds from.", variant: "destructive" });
      return;
    }
    const qty = Number(form.quantitySold || 0);
    if (qty <= 0) {
      toast({ title: "Invalid quantity", description: "Quantity must be greater than zero.", variant: "destructive" });
      return;
    }
    if (selectedFlock && qty > Number(selectedFlock.currentCount || 0)) {
      toast({ title: "Insufficient birds", description: "Sale exceeds flock current count.", variant: "destructive" });
      return;
    }
    if (!form.customerName.trim()) {
      toast({ title: "Missing customer", description: "Customer name is required for external sales.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const response = await fetch('/api/poultry/bird-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flockId: form.flockId,
        quantitySold: qty,
        unitSellingPrice: Number(form.unitSellingPrice || 0),
        soldAt: form.soldAt,
        notes: form.notes,
        customerName: form.customerName,
        customerContact: form.customerContact || null,
        customerAddress: form.customerAddress || null
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to log bird sale.',
        variant: "destructive"
      });
    } else {
      toast({ title: "Success", description: "Bird sale recorded.", variant: "success" });
      setDialogOpen(false);
      setForm({
        flockId: '',
        quantitySold: '',
        unitSellingPrice: '',
        soldAt: new Date().toISOString().split('T')[0],
        notes: '',
        customerName: '',
        customerContact: '',
        customerAddress: ''
      });
      await loadFlocks();
      if (onSaleSaved) onSaleSaved();
    }
    setLoading(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className={buttonClassName ?? "bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6"}>
          <Bird className="w-4 h-4" />
          Sell Birds
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto modal-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Bird className="w-5 h-5 text-emerald-600" />
            Record Bird Sale
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Flock</Label>
              <Select value={form.flockId} onValueChange={(value) => setForm({ ...form, flockId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select flock" />
                </SelectTrigger>
                <SelectContent>
                  {flocks.map((flock) => (
                    <SelectItem key={flock.id} value={flock.id}>
                      {flock.name} (Live: {flock.currentCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="soldAt">Sale Date</Label>
              <Input
                id="soldAt"
                type="date"
                value={form.soldAt}
                onChange={(e) => setForm({ ...form, soldAt: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantitySold">Quantity Sold (birds)</Label>
              <Input
                id="quantitySold"
                type="number"
                min="1"
                value={form.quantitySold}
                onChange={(e) => setForm({ ...form, quantitySold: e.target.value })}
                required
              />
              {selectedFlock ? (
                <p className={`text-xs ${remainingAfterSale !== null && remainingAfterSale < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  Available: {Number(selectedFlock.currentCount || 0).toLocaleString()} birds
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit Price (₦)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={form.unitSellingPrice}
                onChange={(e) => setForm({ ...form, unitSellingPrice: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Customer Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerContact">Contact</Label>
                <Input
                  id="customerContact"
                  value={form.customerContact}
                  onChange={(e) => setForm({ ...form, customerContact: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerAddress">Address</Label>
              <Input
                id="customerAddress"
                value={form.customerAddress}
                onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full bg-emerald-700 hover:bg-emerald-800">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Record Bird Sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
