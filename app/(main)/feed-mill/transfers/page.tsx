import { FinishedFeedTransferGrid } from "@/features/feed-mill/components/FinishedFeedTransferGrid";

export default function FeedMillTransfersPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Feed Mill <span className="text-emerald-600">Transfers</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Approve and complete feed transfers to poultry.
        </p>
      </div>
      <FinishedFeedTransferGrid />
    </div>
  );
}
