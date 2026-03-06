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
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish Hatchery <span className="text-emerald-600">Fry Transfers</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Transfer fry to Fingerlings and assign transfer value.</p>
      </div>
      <CatfishFryTransferGrid />
    </div>
  );
}
