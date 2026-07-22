import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import PreferenceForm from "./components/PreferenceForm";
import PreferenceTable from "./components/PreferenceTable";
import { PreferenceItem } from "./types";

const LOCAL_STORAGE_KEY = "preference_list_data";
const LOCAL_STORAGE_TIME_KEY = "preference_list_saved_time";

export default function App() {
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [showOCTModal, setShowOCTModal] = useState<boolean>(false);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse saved preferences from localStorage", err);
      }
    }
    const savedTime = localStorage.getItem(LOCAL_STORAGE_TIME_KEY);
    if (savedTime) {
      setLastSavedTime(savedTime);
    } else {
      const now = new Date();
      const formattedDate = now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).toUpperCase();
      const formattedTime = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
      setLastSavedTime(`${formattedDate} - ${formattedTime}`);
    }
  }, []);

  // Save to local storage whenever list changes
  const savePreferences = (updatedList: PreferenceItem[]) => {
    setPreferences(updatedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    const now = new Date();
    const formattedDate = now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).toUpperCase();
    const formattedTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
    const nowStr = `${formattedDate} - ${formattedTime}`;
    setLastSavedTime(nowStr);
    localStorage.setItem(LOCAL_STORAGE_TIME_KEY, nowStr);
  };

  // Add a new preference pair with duplicate check
  const handleAddPreference = (
    institution: string,
    branch: string
  ): { success: boolean; duplicateIndex?: number } => {
    const trimmedInst = institution.trim();
    const trimmedBr = branch.trim();

    // Case-insensitive exact match check to prevent duplicates
    const duplicateIndex = preferences.findIndex(
      (item) =>
        item.institution.toLowerCase() === trimmedInst.toLowerCase() &&
        item.branch.toLowerCase() === trimmedBr.toLowerCase()
    );

    if (duplicateIndex !== -1) {
      return { success: false, duplicateIndex };
    }

    const newItem: PreferenceItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      institution: trimmedInst,
      branch: trimmedBr,
      originalOrder: preferences.length + 1,
    };

    savePreferences([...preferences, newItem]);
    return { success: true };
  };

  // Parse uploaded CSV content
  const handleUploadCSV = (fileContent: string) => {
    const lines = fileContent.split(/\r?\n/);
    const parsedItems: { institution: string; branch: string; originalOrder?: number }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Robust CSV line parser that correctly handles quoted strings and comma inside fields
      const fields: string[] = [];
      let currentField = "";
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          if (insideQuotes && line[j + 1] === '"') {
            currentField += '"';
            j++; // skip next double quote
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          fields.push(currentField);
          currentField = "";
        } else {
          currentField += char;
        }
      }
      fields.push(currentField);

      if (fields.length >= 3) {
        const origNumStr = fields[0].trim();
        const origNum = parseInt(origNumStr, 10);
        const inst = fields[1].trim();
        const br = fields[2].trim();
        if (inst && br) {
          parsedItems.push({
            institution: inst,
            branch: br,
            originalOrder: isNaN(origNum) ? undefined : origNum
          });
        }
      }
    }

    if (parsedItems.length === 0) {
      alert("Invalid file format. Please upload a valid CSV list previously downloaded from this application.");
      return;
    }

    const newList: PreferenceItem[] = parsedItems.map((item, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      institution: item.institution,
      branch: item.branch,
      originalOrder: item.originalOrder !== undefined ? item.originalOrder : (idx + 1),
    }));

    savePreferences(newList);
  };

  // Move up action
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...preferences];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    savePreferences(updated);
  };

  // Move down action
  const handleMoveDown = (index: number) => {
    if (index === preferences.length - 1) return;
    const updated = [...preferences];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    savePreferences(updated);
  };

  // Move to a specific index position (e.g. choice 5 jumping to choice 2)
  const handleMoveToPosition = (index: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= preferences.length || index === targetIndex) return;
    const updated = [...preferences];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);
    savePreferences(updated);
  };

  // Delete/remove preference
  const handleDelete = (index: number) => {
    const updated = [...preferences];
    updated.splice(index, 1);
    savePreferences(updated);
  };

  // Reset original order numbers of all preferences to current sequential order
  const handleResetOriginalOrder = () => {
    const updated = preferences.map((item, idx) => ({
      ...item,
      originalOrder: idx + 1,
    }));
    savePreferences(updated);
  };

  // State to handle safe sandbox-compatible clear-all confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Clear all preferences
  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    savePreferences([]);
    setShowClearConfirm(false);
  };

  // Edit/update an existing preference
  const handleEditPreference = (
    index: number,
    updatedInstitution: string,
    updatedBranch: string
  ): { success: boolean; duplicateIndex?: number } => {
    const trimmedInst = updatedInstitution.trim();
    const trimmedBr = updatedBranch.trim();

    if (!trimmedInst || !trimmedBr) {
      return { success: false };
    }

    // Case-insensitive exact match check to prevent duplicates (excluding the current item itself)
    const duplicateIndex = preferences.findIndex(
      (item, idx) =>
        idx !== index &&
        item.institution.toLowerCase() === trimmedInst.toLowerCase() &&
        item.branch.toLowerCase() === trimmedBr.toLowerCase()
    );

    if (duplicateIndex !== -1) {
      return { success: false, duplicateIndex };
    }

    const updated = [...preferences];
    updated[index] = {
      ...updated[index],
      institution: trimmedInst,
      branch: trimmedBr,
    };
    savePreferences(updated);
    return { success: true };
  };

  // Download choice filling data as a clean CSV
  const handleDownloadCSV = () => {
    if (preferences.length === 0) return;

    const headers = ["Preference No.", "Institution", "Branch"];
    const rows = preferences.map((pref, index) => {
      const prefNo = index + 1;
      // Escape double quotes by doubling them, and wrap fields with double quotes
      const escapedInst = pref.institution.replace(/"/g, '""');
      const escapedBranch = pref.branch.replace(/"/g, '""');
      return `${prefNo},"${escapedInst}","${escapedBranch}"`;
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // Dynamic clean filename
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "preference-list.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy choice filling data as clean CSV to clipboard
  const handleCopyCSV = () => {
    if (preferences.length === 0) return;

    const headers = ["Preference No.", "Institution", "Branch"];
    const rows = preferences.map((pref, index) => {
      const prefNo = index + 1;
      const escapedInst = pref.institution.replace(/"/g, '""');
      const escapedBranch = pref.branch.replace(/"/g, '""');
      return `${prefNo},"${escapedInst}","${escapedBranch}"`;
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    navigator.clipboard.writeText(csvContent)
      .then(() => {
        alert("CSV content copied to clipboard successfully!");
      })
      .catch((err) => {
        console.error("Failed to copy CSV: ", err);
        alert("Failed to copy CSV content to clipboard.");
      });
  };

  return (
    <div className="min-h-screen bg-[#f4f4f4] flex flex-col font-sans selection:bg-blue-100 text-gray-900" id="main-app-container">
      {/* Portal Header */}
      <Header
        totalCount={preferences.length}
        onDownloadCSV={handleDownloadCSV}
        onCopyCSV={handleCopyCSV}
        onClearAll={handleClearAll}
        onOpenOCT={() => setShowOCTModal(true)}
      />

      {/* Main Choice filling Area */}
      <main className="flex-1 flex flex-col">
        {/* Sticky Form */}
        <PreferenceForm
          onAddPreference={handleAddPreference}
          existingPreferences={preferences}
        />

        {/* Dense Table */}
        <PreferenceTable
          preferences={preferences}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onDelete={handleDelete}
          onMoveToPosition={handleMoveToPosition}
          onUploadCSV={handleUploadCSV}
          onEdit={handleEditPreference}
          onResetOriginalOrder={handleResetOriginalOrder}
          showOCTModal={showOCTModal}
          setShowOCTModal={setShowOCTModal}
        />
      </main>

      {/* Custom Confirmation Modal for Clear All */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" id="clear-confirm-modal">
          <div className="bg-white border-2 border-red-600 max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-red-600 text-white px-4 py-2.5 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
              ⚠️ Warning: Permanent Deletion
            </div>
            <div className="p-5">
              <p className="text-xs text-gray-800 font-sans leading-relaxed">
                This action will permanently delete <strong className="font-bold">ALL {preferences.length}</strong> of your filled choices. This action cannot be undone.
              </p>
              <p className="text-xs text-red-600 font-bold mt-2 uppercase font-sans">
                Are you absolutely sure you want to proceed?
              </p>
            </div>
            <div className="bg-gray-100 px-4 py-3 flex justify-end gap-2 border-t border-gray-300">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="bg-gray-200 hover:bg-gray-300 border border-gray-400 text-gray-800 px-4 py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer font-sans transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearAll}
                className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider border border-red-700 cursor-pointer font-sans transition-all"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Legal / Portal disclaimer bar */}
      <footer className="bg-gray-800 text-white px-4 py-3 text-center text-[10px] uppercase tracking-wider font-mono border-t border-gray-900" id="portal-footer">
        <span>DRAFT STATE LAST AUTOSAVED & UPDATED: {lastSavedTime ? lastSavedTime : "N/A"}</span>
      </footer>
    </div>
  );
}
