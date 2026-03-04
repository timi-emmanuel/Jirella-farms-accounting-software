import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CatfishPricingSettings } from "@/features/catfish/components/CatfishPricingSettings";

export default async function CatfishPricingSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-800">Permission Denied</h1>
          <p className="text-gray-500">Catfish pricing settings are restricted to Administrators only.</p>
          <a href="/catfish/dashboard" className="text-blue-600 hover:underline block mt-4">
            Back to Catfish Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto modal-scrollbar">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish <span className="text-emerald-600">Pricing Settings</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Configure active size ranges and seed price per piece.
        </p>
        <p className="text-emerald-700 text-xs font-semibold mt-2">
          <Info className="inline mr-1" size={12} />
          Price changes affect future batch setup only. Existing batches keep their original values.
        </p>
      </div>
      <CatfishPricingSettings />
    </div>
  );
}

