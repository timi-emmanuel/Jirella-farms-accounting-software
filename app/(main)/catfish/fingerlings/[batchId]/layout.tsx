import { CatfishBatchTabs } from "@/features/catfish/components/CatfishBatchTabs";
import { getAuthContext } from "@/lib/server/auth";

export default async function CatfishFingerlingsBatchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const auth = await getAuthContext();
  const hideRestrictedTabs = auth?.role === "CATFISH_STAFF";

  return (
    <div className="h-full flex flex-col space-y-4 overflow-y-auto modal-scrollbar pr-2">
      <CatfishBatchTabs batchId={batchId} hideFinanceTab={hideRestrictedTabs} hideSalesTab={hideRestrictedTabs} />
      {children}
    </div>
  );
}
