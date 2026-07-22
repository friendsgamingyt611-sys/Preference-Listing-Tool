import React from "react";

interface HeaderProps {
  totalCount: number;
  onDownloadCSV: () => void;
  onCopyCSV: () => void;
  onClearAll: () => void;
  onOpenOCT?: () => void;
}

export default function Header({ totalCount, onDownloadCSV, onCopyCSV, onClearAll, onOpenOCT }: HeaderProps) {
  return (
    <header className="w-full flex flex-col" id="portal-header">
      {/* Under-header state & actions bar */}
      <div className="bg-[#dee2e6] px-4 py-1.5 border-b border-gray-300 flex flex-wrap gap-2 justify-between items-center">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 font-sans uppercase">Total Preferences Filled:</span>
            <span id="totalCount" className="bg-[#002d5a] text-white px-2 py-0.5 rounded-sm text-xs font-bold font-mono">
              {totalCount}
            </span>
          </div>
          <div className="text-[10px] text-blue-800 font-semibold bg-blue-50 px-2 py-0.5 border border-blue-200 uppercase tracking-tight font-sans">
            Status: Draft Autosaved
          </div>
        </div>

        {/* Dense Action Row */}
        <div className="flex items-center gap-2">
          <button
            id="btn-copy-csv"
            onClick={onCopyCSV}
            disabled={totalCount === 0}
            className="bg-[#17a2b8] text-white px-4 py-1 text-[11px] font-bold border-b-2 border-[#117a8b] active:border-b-0 hover:bg-[#138496] disabled:bg-slate-400 disabled:border-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wide font-sans transition-all"
          >
            Copy CSV
          </button>
          <button
            id="btn-download-csv"
            onClick={onDownloadCSV}
            disabled={totalCount === 0}
            className="bg-[#007bff] text-white px-4 py-1 text-[11px] font-bold border-b-2 border-[#0062cc] active:border-b-0 hover:bg-[#0069d9] disabled:bg-slate-400 disabled:border-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wide font-sans transition-all"
          >
            Download CSV
          </button>
          <button
            id="btn-clear-all"
            onClick={onClearAll}
            disabled={totalCount === 0}
            className="bg-[#dc3545] text-white px-4 py-1 text-[11px] font-bold border-b-2 border-[#bd2130] active:border-b-0 hover:bg-[#c82333] disabled:bg-slate-400 disabled:border-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wide font-sans transition-all"
          >
            Clear All
          </button>
        </div>
      </div>
    </header>
  );
}
