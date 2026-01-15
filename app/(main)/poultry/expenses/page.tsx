import { PoultryExpenseGrid } from "@/features/poultry/components/PoultryExpenseGrid";

export default function PoultryExpensesPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Poultry Expenses</h1>
        <p className="text-slate-500 text-sm font-medium">
          Record overhead costs for poultry operations.
        </p>
      </div>
      <PoultryExpenseGrid />
    </div>
  );
}
