import { BsfLarvariumBatchDetail } from "@/features/bsf/components/BsfLarvariumBatchDetail";

export default function BsfLarvariumBatchDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-full flex flex-col space-y-6">
      <BsfLarvariumBatchDetail batchId={params.id} />
    </div>
  );
}