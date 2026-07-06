import { ArrowLeft, Play, Headphones, Paintbrush } from 'lucide-react';

export default function ActivityDetail({ activity, onBack, onStartBreathing, onStartASMR, onStartColoring }) {
  return (
    <div className="animate-fade-in-up" data-testid={`activity-detail-${activity.id}`}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors" data-testid="back-to-activities">
        <ArrowLeft className="w-4 h-4" /> Back to activities
      </button>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{activity.category}</span>
          <span className="text-xs text-slate-300">&middot;</span>
          <span className="text-xs text-slate-400">{activity.duration}</span>
        </div>
        <h2 className="font-['Outfit'] text-2xl font-bold text-slate-900 mb-3">{activity.title}</h2>
        <p className="text-slate-600 mb-6">{activity.description}</p>

        <div className="bg-[#FFF9F5] rounded-2xl p-5 mb-6">
          <h4 className="font-['Outfit'] font-semibold text-slate-900 mb-4">How to do it:</h4>
          <ol className="space-y-3">
            {activity.steps.map((step, i) => (
              <li key={`step-${i}`} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#FF715B]/10 text-[#FF715B] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-700">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
          <span className="font-medium text-slate-600 shrink-0">Best for:</span>
          <span>{activity.when}</span>
        </div>

        {activity.guided && (
          <button
            onClick={onStartBreathing}
            className="mt-6 w-full py-3 bg-[#4E9FE5] text-white rounded-2xl font-medium hover:bg-[#3B8DD4] transition-colors flex items-center justify-center gap-2"
            data-testid="start-guided-btn"
          >
            <Play className="w-4 h-4" /> Start Guided Exercise
          </button>
        )}

        {activity.id === 'asmr_moment' && (
          <button
            onClick={onStartASMR}
            className="mt-6 w-full py-3 bg-[#FFB627] text-white rounded-2xl font-medium hover:bg-[#E5A220] transition-colors flex items-center justify-center gap-2"
            data-testid="start-asmr-btn"
          >
            <Headphones className="w-4 h-4" /> Open Sound Player
          </button>
        )}

        {activity.id === 'mini_coloring' && (
          <button
            onClick={onStartColoring}
            className="mt-6 w-full py-3 bg-[#8B5CF6] text-white rounded-2xl font-medium hover:bg-[#7C3AED] transition-colors flex items-center justify-center gap-2"
            data-testid="start-coloring-btn"
          >
            <Paintbrush className="w-4 h-4" /> Start Coloring
          </button>
        )}
      </div>
    </div>
  );
}
