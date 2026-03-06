import { CatfishBatchTabs } from "@/features/catfish/components/CatfishBatchTabs";
import { getAuthContext } from "@/lib/server/auth";

const growoutTabs = [
  { label: "Overview", suffix: "" },
  { label: "Logs", suffix: "/logs" },
  { label: "Finance", suffix: "/finance" },
  { label: "Sales", suffix: "/sales" },
];

export default async function CatfishGrowoutBatchLayout({
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
      <CatfishBatchTabs
        batchId={batchId}
        basePath="/catfish/growout"
        tabs={growoutTabs}
        hideFinanceTab={hideRestrictedTabs}
        hideSalesTab={hideRestrictedTabs}
      />
      {children}
    </div>
  );
}
