
import { ActivityLogGrid } from "@/features/activity/components/ActivityLogGrid";
import { Activity } from "lucide-react";

export default function ActivityLogsPage() {
 return (
  <div className="h-full flex flex-col space-y-4">
   <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold tracking-tight">System Activity Logs</h1>
    <p className="text-sm text-gray-400">
     <Activity className="w-4 h-4 mr-1 inline" />
     Monitor all system actions and events
    </p>
   </div>
   <div className="flex-1 overflow-hidden">
    <ActivityLogGrid />
   </div>
  </div>
 );
}
