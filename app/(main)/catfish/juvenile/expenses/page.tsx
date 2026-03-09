import { CatfishStageExpenseGrid } from "@/features/catfish/components/CatfishStageExpenseGrid";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CatfishJuvenileExpensesPage() {
  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto modal-scrollbar">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Catfish <span className="text-emerald-600">Juvenile External Expenses</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Record and track external costs for juvenile production.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/catfish/juvenile/dashboard">
            <Button variant="outline" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
      <CatfishStageExpenseGrid stage="juvenile" />
    </div>
  );
}
