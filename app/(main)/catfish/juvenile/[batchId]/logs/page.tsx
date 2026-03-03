import { CatfishFeedLogGrid } from "@/features/catfish/components/CatfishFeedLogGrid";

export default async function CatfishJuvenileBatchLogsPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Juvenile <span className="text-emerald-600">Batch Logs</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Feed, mortality, ABW and average length for this batch.</p>
      </div>
      <CatfishFeedLogGrid batchId={batchId} hideBatchColumn={true} productionType="Juvenile" stageLabel="Juvenile" />
    </div>
  );
}
