import { CatfishFryTransferGrid } from "@/features/catfish/components/CatfishFryTransferGrid";
import { getAuthContext } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export default async function CatfishHatcheryTransfersPage() {
  const auth = await getAuthContext();
  if (auth?.role === "CATFISH_STAFF") {
    redirect("/catfish/hatchery/spawning");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Fry Transfer Valuation</h2>
        <p className="text-slate-500 text-sm">Transfer fry to Fingerlings batches and assign cost basis.</p>
      </div>
      <CatfishFryTransferGrid />
    </div>
  );
}
