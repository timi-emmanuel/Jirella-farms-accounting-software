import { CatfishBatchFinance } from "@/features/catfish/components/CatfishBatchFinance";
import { getAuthContext } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export default async function CatfishGrowoutBatchFinancePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const auth = await getAuthContext();
  if (auth?.role === "CATFISH_STAFF") {
    redirect(`/catfish/growout/${batchId}`);
  }
  return <CatfishBatchFinance stage="growout" stageLabel="Grow-out (Adult)" />;
}
