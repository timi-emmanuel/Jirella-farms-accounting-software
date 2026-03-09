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
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Hatchery Financials</h2>
        <p className="text-slate-500 text-sm">Production costs, transfer valuations, and profitability analysis.</p>
      </div>
      <CatfishHatcheryFinancials />
    </div>
  );
}
