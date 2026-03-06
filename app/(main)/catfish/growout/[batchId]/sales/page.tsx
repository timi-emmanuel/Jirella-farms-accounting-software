import { CatfishSalesGrid } from "@/features/catfish/components/CatfishSalesGrid";
import { getAuthContext } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export default async function CatfishGrowoutBatchSalesPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const auth = await getAuthContext();
  if (auth?.role === "CATFISH_STAFF") {
    redirect(`/catfish/growout/${batchId}`);
  }
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Grow-out (Adult) <span className="text-emerald-600">Batch Sales</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">External sales for this grow-out batch.</p>
      </div>
      <CatfishSalesGrid batchId={batchId} hideBatchColumn={true} productionType="Grow-out (Adult)" stageLabel="Grow-out (Adult)" />
    </div>
  );
}
