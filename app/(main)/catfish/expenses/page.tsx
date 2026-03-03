import { CatfishExpenseGrid } from "@/features/catfish/components/CatfishExpenseGrid";

export default function CatfishExpensesPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Catfish External Expenses</h1>
        <p className="text-slate-500 text-sm font-medium">
          Record external costs to improve catfish P&L accuracy.
        </p>
      </div>
      <CatfishExpenseGrid />
    </div>
  );
}
