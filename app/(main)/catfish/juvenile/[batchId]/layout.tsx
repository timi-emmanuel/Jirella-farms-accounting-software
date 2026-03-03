import { CatfishBatchTabs } from "@/features/catfish/components/CatfishBatchTabs";

const juvenileTabs = [
  { label: "Overview", suffix: "" },
  { label: "Logs", suffix: "/logs" },
  { label: "Finance", suffix: "/finance" },
  { label: "Sales", suffix: "/sales" },
];

export default async function CatfishJuvenileBatchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;

  return (
    <div className="h-full flex flex-col space-y-4 overflow-y-auto modal-scrollbar pr-2">
      <CatfishBatchTabs batchId={batchId} basePath="/catfish/juvenile" tabs={juvenileTabs} />
      {children}
    </div>
  );
}
