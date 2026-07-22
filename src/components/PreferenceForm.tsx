import React, { useState, useRef, useEffect } from "react";
import { PreferenceItem } from "../types";

interface PreferenceFormProps {
  onAddPreference: (institution: string, branch: string) => { success: boolean; duplicateIndex?: number };
  existingPreferences: PreferenceItem[];
}

export default function PreferenceForm({ onAddPreference, existingPreferences }: PreferenceFormProps) {
  const [institution, setInstitution] = useState("");
  const [branch, setBranch] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const institutionInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the institution input on initial render
  useEffect(() => {
    if (institutionInputRef.current) {
      institutionInputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedInstitution = institution.trim();
    const trimmedBranch = branch.trim();

    if (!trimmedInstitution || !trimmedBranch) {
      setErrorMsg("Error: Both 'Institution' and 'Branch' fields are mandatory.");
      return;
    }

    // Submit the pair
    const result = onAddPreference(trimmedInstitution, trimmedBranch);

    if (result.success) {
      // Clear values but do NOT lock form
      setInstitution("");
      setBranch("");
      setErrorMsg(null);
      
      // Fast refocussing back to Institution for successive inputs
      if (institutionInputRef.current) {
        institutionInputRef.current.focus();
      }
    } else if (result.duplicateIndex !== undefined) {
      setErrorMsg(`Already added: This choice is already present at Preference No. ${result.duplicateIndex + 1}.`);
      // Refocus institution input so user can modify it or search again
      if (institutionInputRef.current) {
        institutionInputRef.current.focus();
      }
    }
  };

  return (
    <div className="bg-white p-4 border-b border-gray-300 sticky top-0 z-40" id="form-container">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col gap-3" id="preference-entry-form">
        <div className="flex flex-col md:flex-row items-stretch gap-4">
          
          {/* Institution Input */}
          <div className="flex-1 flex flex-col">
            <label htmlFor="institution-input" className="block text-[10px] font-bold text-gray-700 mb-1 uppercase tracking-tight">
              Institution Name <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              id="institution-input"
              ref={institutionInputRef}
              type="text"
              value={institution}
              onChange={(e) => {
                setInstitution(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Type Institution Name (e.g. IIT Bombay)"
              className="w-full border border-gray-500 p-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans text-gray-900"
              autoComplete="off"
            />
          </div>

          {/* Branch Input */}
          <div className="flex-1 flex flex-col">
            <label htmlFor="branch-input" className="block text-[10px] font-bold text-gray-700 mb-1 uppercase tracking-tight">
              Academic Program / Branch <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              id="branch-input"
              type="text"
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Type Program Name (e.g. Computer Science)"
              className="w-full border border-gray-500 p-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans text-gray-900"
              autoComplete="off"
            />
          </div>

          {/* Action Button */}
          <div className="flex items-end mt-2 md:mt-0">
            <button
              type="submit"
              className="w-full md:w-auto bg-[#28a745] text-white px-6 py-[7px] text-xs font-bold border-b-2 border-[#1e7e34] active:border-b-0 active:translate-y-[1px] hover:bg-[#218838] uppercase cursor-pointer tracking-wider"
              id="btn-add-choice"
            >
              Add Choice
            </button>
          </div>
        </div>

        {/* Inline Feedback Banner */}
        {errorMsg && (
          <div 
            className={`px-3 py-1.5 text-xs font-mono font-medium border flex items-center gap-2 ${
              errorMsg.startsWith("Already added") 
                ? "bg-amber-50 text-amber-800 border-amber-300"
                : "bg-rose-50 text-rose-800 border-rose-300"
            }`}
            id="inline-error-banner"
          >
            <span className="font-bold">{errorMsg.startsWith("Already added") ? "⚠️" : "❌"}</span>
            <span>{errorMsg}</span>
          </div>
        )}
      </form>
    </div>
  );
}
