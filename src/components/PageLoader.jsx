export default function PageLoader({ label = 'Memuat…' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 px-6">
      <div className="w-9 h-9 rounded-full border-2 border-slate-200 border-t-navy-950 animate-spin" />
      <p className="text-[12px] font-semibold text-slate-500">{label}</p>
    </div>
  );
}
