import { CatfishBatchFinance } from "@/features/catfish/components/CatfishBatchFinance";
import { getAuthContext } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export default async function CatfishJuvenileBatchFinancePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const auth = await getAuthContext();
  if (auth?.role === "CATFISH_STAFF") {
    redirect(`/catfish/juvenile/${batchId}`);
  }
  return <CatfishBatchFinance stage="juvenile" stageLabel="Juvenile" />;
}
