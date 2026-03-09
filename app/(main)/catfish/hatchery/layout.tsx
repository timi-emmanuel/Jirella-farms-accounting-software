 "use client";

export default function CatfishHatcheryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col overflow-y-auto modal-scrollbar">
      {children}
    </div>
  );
}
