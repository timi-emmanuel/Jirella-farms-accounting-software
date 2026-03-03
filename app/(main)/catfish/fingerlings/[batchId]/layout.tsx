import { CatfishBatchTabs } from "@/features/catfish/components/CatfishBatchTabs";

export default async function CatfishFingerlingsBatchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;

  return (
    <div className="h-full flex flex-col space-y-4 overflow-y-auto modal-scrollbar pr-2">
      <CatfishBatchTabs batchId={batchId} />
      {children}
    </div>
  );
}
