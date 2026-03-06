import { CatfishHatcheryFinancials } from "@/features/catfish/components/CatfishHatcheryFinancials";
import { getAuthContext } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export default async function CatfishHatcheryFinancialsPage() {
  const auth = await getAuthContext();
  if (auth?.role === "CATFISH_STAFF") {
    redirect("/catfish/hatchery/broodstock");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish Hatchery <span className="text-emerald-600">Financials</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Summary of hatchery production costs and transfer valuation.</p>
      </div>
      <CatfishHatcheryFinancials />
    </div>
  );
}
