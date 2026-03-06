import { CatfishBatchFinance } from "@/features/catfish/components/CatfishBatchFinance";
import { getAuthContext } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export default async function CatfishFingerlingsBatchFinancePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const auth = await getAuthContext();
  if (auth?.role === "CATFISH_STAFF") {
    redirect(`/catfish/fingerlings/${batchId}`);
  }
  return <CatfishBatchFinance stage="fingerlings" stageLabel="Fingerlings" />;
}
