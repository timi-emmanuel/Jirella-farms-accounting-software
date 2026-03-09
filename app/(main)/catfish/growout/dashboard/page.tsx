import { CatfishStageDashboard } from "@/features/catfish/components/CatfishStageDashboard";
import { Package2, Receipt, Package } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CatfishGrowoutDashboardPage() {
  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto modal-scrollbar">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish <span className="text-emerald-600">Grow-out Management</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Batch performance, survival rates, and sales overview.
        </p>
      </div>

      {/* Quick Access Buttons */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/catfish/growout/inventory">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Package2 className="w-4 h-4 mr-2" />
            Feed Inventory
          </Button>
        </Link>
        <Link href="/catfish/growout/expenses">
          <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Receipt className="w-4 h-4 mr-2" />
            External Expenses
          </Button>
        </Link>
        <Link href="/catfish/growout">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Package className="w-4 h-4 mr-2" />
            Batch Operations
          </Button>
        </Link>
      </div>

      {/* Dashboard Metrics */}
      <div className="flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Performance Metrics</h2>
          <p className="text-sm text-slate-500">Last 30 days overview</p>
        </div>
        <CatfishStageDashboard stage="growout" />
      </div>
    </div>
  );
}
