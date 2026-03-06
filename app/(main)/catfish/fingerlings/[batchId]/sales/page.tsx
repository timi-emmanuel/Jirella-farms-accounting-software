import { CatfishSalesGrid } from "@/features/catfish/components/CatfishSalesGrid";
import { getAuthContext } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export default async function CatfishFingerlingsBatchSalesPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const auth = await getAuthContext();
  if (auth?.role === "CATFISH_STAFF") {
    redirect(`/catfish/fingerlings/${batchId}`);
  }
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Fingerlings <span className="text-emerald-600">Batch Sales</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">External offloads for this batch.</p>
      </div>
      <CatfishSalesGrid batchId={batchId} hideBatchColumn={true} />
    </div>
  );
}
