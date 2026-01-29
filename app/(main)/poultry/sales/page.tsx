"use client";

import { SalesGrid } from "@/features/sales/components/SalesGrid";
import { PoultryBirdSaleCard } from "@/features/poultry/components/PoultryBirdSaleCard";
import { useState } from "react";

export default function PoultrySalesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Poultry <span className="text-emerald-600">Sales</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Track poultry sales within the unified sales system.
        </p>
      </div>  
      <div className="flex-1 overflow-hidden">
        <SalesGrid
          key={refreshKey}
          initialModule="POULTRY"
          showModuleFilter={false}
          showStockColumn={false}
          productFilter={(product) => product.name !== 'Live Birds'}
          hideCogsColumn={true}
          hideGrossProfitColumn={true}
          headerActionsRight={(
            <PoultryBirdSaleCard
              onSaleSaved={() => setRefreshKey((prev) => prev + 1)}
              buttonClassName="bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6 mr-2"
            />
          )}
        />
      </div>
    </div>
  );
}
