import { ModuleTransferRequestGrid } from "@/features/inventory/components/ModuleTransferRequestGrid";

export default function PoultryRequestsPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Poultry Requests</h1>
        <p className="text-slate-500 text-sm font-medium">
          Review stock requests submitted to the store.
        </p>
      </div>
      <ModuleTransferRequestGrid moduleKey="POULTRY" />
    </div>
  );
}
