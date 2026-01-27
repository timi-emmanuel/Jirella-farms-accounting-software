"use client";

import { SalesGrid } from "@/features/sales/components/SalesGrid";

export function SalesGridFeedMill() {
  return (
    <SalesGrid initialModule="FEED_MILL" showModuleFilter={false} showStockColumn={false} />
  );
}

export { SalesGridFeedMill as SalesGrid };
