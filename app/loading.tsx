// Root-level loading UI — shown during server-component page transitions.

export default function Loading() {
  return (
    <div className="min-h-[60vh] bg-[#FBFBFA] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Pulsing logo wordmark — matches the project's editorial aesthetic */}
        <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-[#1A1A1A]/40 animate-pulse select-none">
          Idarah-i Adabiyat-i Dilli
        </p>
        {/* Skeleton bar */}
        <div className="flex gap-1">
          {[0.4, 0.7, 1, 0.7, 0.4].map((opacity, i) => (
            <div
              key={i}
              className="w-1 h-5 bg-[#7D5A34] rounded-sm animate-pulse"
              style={{ opacity, animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
