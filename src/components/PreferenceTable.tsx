import React, { useState } from "react";
import { PreferenceItem } from "../types";
import { ArrowUp, ArrowDown, Trash2, Upload } from "lucide-react";

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b4\s*years?\b/g, " ")
    .replace(/\b5\s*years?\b/g, " ")
    .replace(/\bbachelor\s+of\s+technology\b/g, " btech ")
    .replace(/\bb\.?\s*tech\b/g, " btech ")
    .replace(/\bbachelor\s+of\s+architecture\b/g, " barch ")
    .replace(/\bb\.?\s*arch\b/g, " barch ")
    .replace(/\bmaster\s+of\s+technology\b/g, " mtech ")
    .replace(/\bm\.?\s*tech\b/g, " mtech ")
    .replace(/["',.\(\)\-\[\]]/g, " ") // replace punctuation with space
    .replace(/\s+/g, " ")              // replace multiple spaces with single space
    .trim();
}

function stripDegreeTerms(str: string): string {
  return str
    .replace(/\bbtech\b/g, "")
    .replace(/\bbarch\b/g, "")
    .replace(/\bmtech\b/g, "")
    .replace(/\bdual\s+degree\b/g, "")
    .replace(/\bintegrated\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRowItem(line: string): {
  institution: string;
  branch: string;
  primaryKey: string;
  coreKey: string;
  altKey: string;
} {
  const trimmed = line.trim();
  if (!trimmed) return { institution: "", branch: "", primaryKey: "", coreKey: "", altKey: "" };

  let fields: string[] = [];

  if (line.includes("\t")) {
    fields = line.split("\t").map(s => s.trim());
  } else if (line.includes(",")) {
    const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      if (match[0] === "" && match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      const val = (match[1] !== undefined ? match[1] : match[2]) || "";
      fields.push(val.trim());
    }
  } else {
    fields = line.split(/\s{2,}/).map(s => s.trim());
  }

  fields = fields.filter(f => f.length > 0);

  let inst = "";
  let br = "";

  if (fields.length >= 3) {
    if (/^\d+$/.test(fields[0])) {
      inst = fields[1];
      br = fields[2];
    } else {
      inst = fields[0];
      br = fields[1];
    }
  } else if (fields.length === 2) {
    if (/^\d+$/.test(fields[0])) {
      inst = fields[1];
    } else {
      inst = fields[0];
      br = fields[1];
    }
  } else if (fields.length === 1) {
    const raw = fields[0].replace(/^\d+[\.\s\-]+/, "").trim();
    const parenMatch = raw.match(/^([^\(\)]+)\s*\((.+)\)$/);
    if (parenMatch) {
      inst = parenMatch[1].trim();
      br = parenMatch[2].trim();
    } else {
      inst = raw;
    }
  }

  const normInst = normalizeString(inst);
  const normBr = normalizeString(br);
  const coreBr = stripDegreeTerms(normBr);
  const normFull = normalizeString(trimmed.replace(/^\d+[\.\s\-]+/, ""));

  const primaryKey = normBr ? `${normInst}___${normBr}` : normInst;
  const coreKey = coreBr ? `${normInst}___${coreBr}` : normInst;

  return { institution: inst, branch: br, primaryKey, coreKey, altKey: normFull };
}

interface PreferenceTableProps {
  preferences: PreferenceItem[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (index: number) => void;
  onMoveToPosition?: (index: number, targetPos: number) => void;
  onUploadCSV?: (content: string) => void;
  onEdit?: (
    index: number,
    updatedInstitution: string,
    updatedBranch: string
  ) => { success: boolean; duplicateIndex?: number };
  onResetOriginalOrder?: () => void;
  showOCTModal?: boolean;
  setShowOCTModal?: (show: boolean) => void;
}

export default function PreferenceTable({
  preferences,
  onMoveUp,
  onMoveDown,
  onDelete,
  onMoveToPosition,
  onUploadCSV,
  onEdit,
  onResetOriginalOrder,
  showOCTModal,
  setShowOCTModal,
}: PreferenceTableProps) {
  // Store target position inputs for each row
  const [jumpInputs, setJumpInputs] = useState<{ [key: string]: string }>({});
  const [dragActive, setDragActive] = useState(false);
  const [localOCTModal, setLocalOCTModal] = useState(false);

  const isOCTOpen = showOCTModal !== undefined ? showOCTModal : localOCTModal;

  const closeOCTModal = () => {
    setLocalOCTModal(false);
    if (setShowOCTModal) setShowOCTModal(false);
  };

  const openOCTModal = () => {
    setLocalOCTModal(true);
    if (setShowOCTModal) setShowOCTModal(true);
    setUseAppTableForA(true);
  };

  const handleCopyOriginalOrders = () => {
    if (preferences.length === 0) {
      alert("No preferences to copy.");
      return;
    }

    // Map each item with its current visual position (1-indexed) and its originalOrder
    const mappedItems = preferences.map((item, idx) => ({
      originalOrder: item.originalOrder !== undefined ? item.originalOrder : (idx + 1),
      currentPosition: idx + 1,
    }));

    // Sort ascending by the original order (matching the row-sequence of the original spreadsheet)
    mappedItems.sort((a, b) => a.originalOrder - b.originalOrder);

    // Extract the list of current positions that correspond directly to original rows 1..N
    const textToCopy = mappedItems.map(item => item.currentPosition).join("\n");

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        alert("Success! Copied the new positions mapped to your original spreadsheet order.\n\nSteps to reorder:\n1. Paste (Ctrl+V) this column directly next to your original spreadsheet.\n2. Select all data and sort ASCENDING by this new column.\n3. Your spreadsheet is now in the exact priority order you designed!");
      })
      .catch((err) => {
        console.error("Failed to copy original numbers: ", err);
        alert("Failed to copy numbers to clipboard.");
      });
  };

  // Pasting/Import Tab State
  const [importTab, setImportTab] = useState<"file" | "paste" | "matcher">("file");
  const [pastedText, setPastedText] = useState("");
  const [pastedPreview, setPastedPreview] = useState<{ institution: string; branch: string }[]>([]);

  // Order Corrector Tool States
  const [useAppTableForA, setUseAppTableForA] = useState(true);
  const [matcherListB, setMatcherListB] = useState("");
  const [matcherListA, setMatcherListA] = useState("");
  const [matcherOutput, setMatcherOutput] = useState("");
  const [matcherStats, setMatcherStats] = useState<{
    matched: number;
    unmatched: number;
    total: number;
    targetCount: number;
    isIdentical: boolean;
    unmatchedItems: string[];
    targetMissingItems: string[];
  } | null>(null);

  const handleUploadListBFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setMatcherListB(text);
        setMatcherStats(null);
        setMatcherOutput("");
      }
    };
    reader.readAsText(file);
  };

  const handleRunListMatcher = () => {
    if (!matcherListB.trim()) {
      alert("Please upload or paste your master spreadsheet rows (List B).");
      return;
    }

    if (!useAppTableForA && !matcherListA.trim()) {
      alert("Please paste target list text into List A.");
      return;
    }

    interface TargetMeta {
      idx: number;
      normInst: string;
      normBr: string;
      coreBr: string;
      primaryKey: string;
      coreKey: string;
      altKey: string;
      rawText: string;
    }

    const targetItems: TargetMeta[] = [];
    const aIndicesMap: { [key: string]: number[] } = {};

    const addKeyToMap = (key: string, idx: number) => {
      if (!key) return;
      if (!aIndicesMap[key]) aIndicesMap[key] = [];
      if (!aIndicesMap[key].includes(idx)) aIndicesMap[key].push(idx);
    };

    if (useAppTableForA) {
      if (preferences.length === 0) {
        alert("Your active applet preference table is empty. Add items to your table or switch to 'Paste Custom Target List A'.");
        return;
      }
      preferences.forEach((pref, idx) => {
        const normInst = normalizeString(pref.institution);
        const normBr = normalizeString(pref.branch);
        const coreBr = stripDegreeTerms(normBr);
        const primaryKey = normBr ? `${normInst}___${normBr}` : normInst;
        const coreKey = coreBr ? `${normInst}___${coreBr}` : normInst;
        const altKey = normalizeString(`${pref.institution} ${pref.branch}`);
        targetItems.push({
          idx,
          normInst,
          normBr,
          coreBr,
          primaryKey,
          coreKey,
          altKey,
          rawText: `${pref.institution} (${pref.branch})`,
        });
        addKeyToMap(primaryKey, idx);
        addKeyToMap(coreKey, idx);
        addKeyToMap(altKey, idx);
      });
    } else {
      const linesA = matcherListA.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      linesA.forEach((line, idx) => {
        const parsed = parseRowItem(line);
        const normInst = normalizeString(parsed.institution);
        const normBr = normalizeString(parsed.branch);
        const coreBr = stripDegreeTerms(normBr);
        targetItems.push({
          idx,
          normInst,
          normBr,
          coreBr,
          primaryKey: parsed.primaryKey,
          coreKey: parsed.coreKey,
          altKey: parsed.altKey,
          rawText: line,
        });
        addKeyToMap(parsed.primaryKey, idx);
        addKeyToMap(parsed.coreKey, idx);
        addKeyToMap(parsed.altKey, idx);
      });
    }

    // Process List B lines
    const linesB = matcherListB.split(/\r?\n/).filter(l => l.trim().length > 0);

    const reorderPositions: (number | string)[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let unmatchedCounter = 0;
    const targetCount = targetItems.length;
    const unmatchedItems: string[] = [];
    const matchedAIndices = new Set<number>();

    linesB.forEach((bLine) => {
      const parsedB = parseRowItem(bLine);

      // Try exact key matches first
      const candidateKeys = [parsedB.primaryKey, parsedB.coreKey, parsedB.altKey];
      let matchedAIdx = -1;

      for (const key of candidateKeys) {
        if (!key) continue;
        const indices = aIndicesMap[key];
        if (indices && indices.length > 0) {
          // Find first unused target index
          for (const idx of indices) {
            if (!matchedAIndices.has(idx)) {
              matchedAIdx = idx;
              break;
            }
          }
        }
        if (matchedAIdx !== -1) break;
      }

      // Fallback fuzzy match if no key matched yet
      if (matchedAIdx === -1 && parsedB.institution) {
        const normBInst = normalizeString(parsedB.institution);
        const normBBr = normalizeString(parsedB.branch);
        const coreBBr = stripDegreeTerms(normBBr);

        for (const tItem of targetItems) {
          if (matchedAIndices.has(tItem.idx)) continue;

          const instMatches =
            tItem.normInst === normBInst ||
            tItem.normInst.includes(normBInst) ||
            normBInst.includes(tItem.normInst);

          if (instMatches) {
            const brMatches =
              !tItem.coreBr ||
              !coreBBr ||
              tItem.coreBr === coreBBr ||
              tItem.coreBr.includes(coreBBr) ||
              coreBBr.includes(tItem.coreBr);

            if (brMatches) {
              matchedAIdx = tItem.idx;
              break;
            }
          }
        }
      }

      if (matchedAIdx !== -1) {
        reorderPositions.push(matchedAIdx + 1);
        matchedAIndices.add(matchedAIdx);
        matchedCount++;
      } else {
        unmatchedCounter++;
        const assignedSequentialIndex = targetCount + unmatchedCounter;
        reorderPositions.push(assignedSequentialIndex);
        unmatchedCount++;
        unmatchedItems.push(bLine);
      }
    });

    // Find target items that were missing in List B
    const targetMissingItems: string[] = [];
    targetItems.forEach((tItem) => {
      if (!matchedAIndices.has(tItem.idx)) {
        if (useAppTableForA) {
          targetMissingItems.push(`Choice #${tItem.idx + 1}: ${tItem.rawText}`);
        } else {
          targetMissingItems.push(`Line #${tItem.idx + 1}: ${tItem.rawText}`);
        }
      }
    });

    const isIdentical =
      linesB.length > 0 &&
      linesB.length === targetCount &&
      unmatchedCount === 0 &&
      targetMissingItems.length === 0 &&
      reorderPositions.every((pos, idx) => Number(pos) === idx + 1);

    setMatcherOutput(reorderPositions.join("\n"));
    setMatcherStats({
      matched: matchedCount,
      unmatched: unmatchedCount,
      total: linesB.length,
      targetCount,
      isIdentical,
      unmatchedItems,
      targetMissingItems,
    });
  };

  const handleCopyMatcherOutput = () => {
    if (!matcherOutput) return;
    navigator.clipboard.writeText(matcherOutput)
      .then(() => {
        alert("📋 Success! Copied the reorder column.\n\nNow:\n1. Paste this column next to your List B spreadsheet.\n2. Sort ASCENDING by this new column.\n3. Your spreadsheet is now reordered to match List A perfectly!");
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to copy to clipboard.");
      });
  };

  const handlePastedTextChange = (text: string) => {
    setPastedText(text);
    if (!text.trim()) {
      setPastedPreview([]);
      return;
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const result: { institution: string; branch: string }[] = [];

    // 1. Check if it's Tab-Separated Values (TSV from Excel/Sheets or standard tables)
    const hasTabs = lines.some((line) => line.includes("\t"));
    if (hasTabs) {
      for (const line of lines) {
        const parts = line.split("\t").map((p) => p.trim());
        if (parts.length >= 3) {
          const isNum = !isNaN(Number(parts[0]));
          const inst = isNum ? parts[1] : parts[0];
          const branch = isNum ? parts[2] : parts[1];
          if (inst && branch) {
            result.push({ institution: inst, branch });
          }
        } else if (parts.length === 2) {
          if (parts[0] && parts[1]) {
            result.push({ institution: parts[0], branch: parts[1] });
          }
        }
      }
    } else {
      // 2. Check if it's CSV format (at least some lines contain commas, and we check if we can split by comma)
      const commaCount = lines.filter((l) => l.includes(",")).length;
      if (commaCount > lines.length / 2) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Skip header if first line
          if (i === 0 && (line.toLowerCase().includes("pref") || line.toLowerCase().includes("institution"))) {
            continue;
          }

          const fields: string[] = [];
          let currentField = "";
          let insideQuotes = false;

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              if (insideQuotes && line[j + 1] === '"') {
                currentField += '"';
                j++;
              } else {
                insideQuotes = !insideQuotes;
              }
            } else if (char === "," && !insideQuotes) {
              fields.push(currentField);
              currentField = "";
            } else {
              currentField += char;
            }
          }
          fields.push(currentField);

          if (fields.length >= 3) {
            const isNum = !isNaN(Number(fields[0].trim()));
            const inst = isNum ? fields[1].trim() : fields[0].trim();
            const branch = isNum ? fields[2].trim() : fields[1].trim();
            if (inst && branch) {
              result.push({ institution: inst, branch });
            }
          } else if (fields.length === 2) {
            const inst = fields[0].trim();
            const branch = fields[1].trim();
            if (inst && branch) {
              result.push({ institution: inst, branch });
            }
          }
        }
      }
    }

    // 3. If no tabular result was found, assume alternating lines (one text line per field, like portal copies)
    if (result.length === 0) {
      const cleanLines = lines.filter((line) => {
        if (!line) return false;
        // Skip small numbers (standalone serial numbers like 1, 2, 3...)
        if (/^\d+$/.test(line)) {
          const num = parseInt(line, 10);
          if (num < 500) {
            return false;
          }
        }
        // Skip common header strings
        const lower = line.toLowerCase();
        if (
          lower === "pref no." ||
          lower === "institution" ||
          lower === "branch / program" ||
          lower === "change order" ||
          lower === "jump to no." ||
          lower === "actions" ||
          lower === "total choices filled"
        ) {
          return false;
        }
        return true;
      });

      for (let i = 0; i < cleanLines.length; i += 2) {
        if (i + 1 < cleanLines.length) {
          result.push({
            institution: cleanLines[i],
            branch: cleanLines[i + 1],
          });
        }
      }
    }

    setPastedPreview(result);
  };

  const handleImportPasted = () => {
    if (pastedPreview.length === 0) return;
    // Generate CSV string
    const headers = ["Preference No.", "Institution", "Branch"];
    const rows = pastedPreview.map((item, index) => `${index + 1},"${item.institution.replace(/"/g, '""')}","${item.branch.replace(/"/g, '""')}"`);
    const csvContent = [headers.join(","), ...rows].join("\n");
    if (onUploadCSV) {
      onUploadCSV(csvContent);
      setPastedText("");
      setPastedPreview([]);
    }
  };

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInstitution, setEditInstitution] = useState<string>("");
  const [editBranch, setEditBranch] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);

  // Non-blocking delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSaveEdit = (index: number) => {
    if (!editInstitution.trim() || !editBranch.trim()) {
      setEditError("Institution and Branch cannot be empty.");
      return;
    }

    if (onEdit) {
      const res = onEdit(index, editInstitution, editBranch);
      if (res.success) {
        setEditingId(null);
        setEditError(null);
      } else if (res.duplicateIndex !== undefined) {
        setEditError(
          `Duplicate combination! Already present as Choice No. ${res.duplicateIndex + 1}.`
        );
      } else {
        setEditError("Failed to update choice.");
      }
    }
  };

  const handleJumpSubmit = (e: React.FormEvent, index: number, id: string) => {
    e.preventDefault();
    const inputVal = jumpInputs[id];
    if (!inputVal) return;

    const targetPos = parseInt(inputVal, 10);
    if (isNaN(targetPos) || targetPos < 1 || targetPos > preferences.length) {
      alert(`Please enter a valid preference number between 1 and ${preferences.length}`);
      return;
    }

    if (onMoveToPosition) {
      onMoveToPosition(index, targetPos - 1);
    }
    // Clear input
    setJumpInputs((prev) => ({ ...prev, [id]: "" }));
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === "string") {
          if (onUploadCSV) {
            onUploadCSV(event.target.result);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === "string") {
          if (onUploadCSV) {
            onUploadCSV(event.target.result);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4" id="table-section">
      <div className="border border-gray-400 bg-white overflow-hidden flex flex-col shadow-inner">
        
        {/* Table Header Strip */}
        <div className="bg-[#002d5a] text-white px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-400">
          <div className="font-bold text-xs uppercase tracking-wide flex flex-wrap items-center gap-2">
            <span>Choice Filling & Locking Details (Filled Preferences)</span>
            {preferences.length > 0 && onResetOriginalOrder && (
              <button
                type="button"
                onClick={onResetOriginalOrder}
                className="bg-[#ffc107] hover:bg-[#e0a800] active:bg-[#d39e00] text-gray-900 border-b border-amber-600 active:border-b-0 text-[9px] font-bold uppercase px-2 py-0.5 cursor-pointer transition-all ml-1 rounded-sm"
                title="Reset all Original Numbers to match current priorities (1, 2, 3...)"
              >
                🔄 Reset Orig No.
              </button>
            )}
            <button
              type="button"
              onClick={openOCTModal}
              className="bg-[#28a745] hover:bg-[#218838] active:bg-[#1e7e34] text-white border-b border-[#1e7e34] active:border-b-0 text-[9px] font-bold uppercase px-2 py-0.5 cursor-pointer transition-all ml-1 rounded-sm flex items-center gap-1 shadow-sm"
              title="Align your master spreadsheet to match your active preference list order"
            >
              🛠️ Order Corrector Tool
            </button>
          </div>
          <div className="text-xs text-amber-300 mt-1 sm:mt-0 font-mono">
            Total Choices Filled: <strong>{preferences.length}</strong>
          </div>
        </div>

        {preferences.length === 0 ? (
          /* Empty State + Import Choice */
          <div className="p-6 bg-slate-50 text-slate-500 text-sm font-sans" id="empty-state">
            <div className="max-w-3xl mx-auto flex flex-col gap-4">
              <div className="border border-amber-300 bg-amber-50 text-amber-800 p-4 text-left">
                <h3 className="font-bold uppercase text-xs mb-1">⚠️ No Choices Filled Yet</h3>
                <p className="text-xs leading-relaxed font-sans">
                  Your preference list is currently empty. Please use the entry form above to enter your preferred Institution and Branch, then click the <strong className="font-bold">Add Choice</strong> button. Your selections will appear in priority order in the list below.
                </p>
              </div>

              {onUploadCSV && (
                <div className="border border-gray-400 bg-white shadow-sm flex flex-col overflow-hidden">
                  {/* Selector Tabs */}
                  <div className="flex flex-col sm:flex-row border-b border-gray-300 bg-gray-100">
                    <button
                      type="button"
                      onClick={() => setImportTab("file")}
                      className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors border-r border-b sm:border-b-0 border-gray-300 text-center flex items-center justify-center gap-1.5 ${
                        importTab === "file"
                          ? "bg-white text-[#002d5a] border-t-2 border-t-[#002d5a] font-black"
                          : "text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      📁 Method A: Upload CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportTab("paste")}
                      className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors border-r border-b sm:border-b-0 border-gray-300 text-center flex items-center justify-center gap-1.5 ${
                        importTab === "paste"
                          ? "bg-white text-[#002d5a] border-t-2 border-t-[#002d5a] font-black"
                          : "text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      📝 Method B: Paste Rows
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportTab("matcher")}
                      className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors text-center flex items-center justify-center gap-1.5 ${
                        importTab === "matcher"
                          ? "bg-white text-[#002d5a] border-t-2 border-t-[#002d5a] font-black"
                          : "text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      🛠️ Order Corrector Tool
                    </button>
                  </div>

                  <div className="p-5">
                    {/* File Upload Tab */}
                    {importTab === "file" && (
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed p-6 text-center transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer ${
                          dragActive 
                            ? "border-blue-600 bg-blue-50 text-blue-800" 
                            : "border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                        }`}
                        id="csv-dropzone"
                      >
                        <Upload className="w-8 h-8 text-slate-400" />
                        <div className="text-xs font-bold uppercase tracking-tight">
                          Continue your work by importing downloaded list
                        </div>
                        <p className="text-[11px] text-gray-500 max-w-md">
                          Drag and drop your previously downloaded <strong className="font-mono">preference-list.csv</strong> file here, or click to upload from your local device.
                        </p>
                        <label className="mt-2 bg-[#007bff] hover:bg-[#0069d9] active:bg-[#005cbf] text-white px-4 py-1.5 text-xs font-bold uppercase border-b-2 border-[#0062cc] active:border-b-0 cursor-pointer select-none">
                          Select CSV File
                          <input 
                            type="file" 
                            accept=".csv" 
                            onChange={handleFileInputChange} 
                            className="hidden" 
                          />
                        </label>
                      </div>
                    )}

                    {/* Clipboard Paste Tab */}
                    {importTab === "paste" && (
                      <div className="flex flex-col gap-3">
                        <div className="text-left">
                          <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                            Paste text, CSV, or copied portal rows below:
                          </label>
                          <p className="text-[11px] text-gray-500 mb-2">
                            You can copy a table directly from your counseling portal or sheets (even alternating lines of Institution & Branch/Program) and paste it here. We'll automatically match and extract the preferences!
                          </p>
                          <textarea
                            value={pastedText}
                            onChange={(e) => handlePastedTextChange(e.target.value)}
                            placeholder="Example:&#10;Birla Institute of Technology, Mesra, Ranchi&#10;Mechanical Engineering Bachelor of Technology&#10;Birla Institute of Technology, Mesra, Ranchi&#10;Civil Engineering (BTECH)"
                            className="w-full h-32 border border-gray-400 p-2 text-xs font-mono bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                          />
                        </div>

                        {pastedPreview.length > 0 ? (
                          <div className="text-left bg-slate-50 border border-gray-300 p-3">
                            <div className="flex items-center justify-between bg-green-50 border border-green-300 text-green-800 px-3 py-1.5 font-bold text-[11px] uppercase tracking-wide">
                              <span>✔ Detected {pastedPreview.length} preferences ready to import</span>
                              <button
                                type="button"
                                onClick={handleImportPasted}
                                className="bg-[#28a745] hover:bg-[#218838] active:bg-[#1e7e34] text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide border-b border-[#1e7e34] cursor-pointer"
                              >
                                Import Choices Now
                              </button>
                            </div>

                            <div className="mt-2 text-[10px] font-bold uppercase text-gray-500 mb-1 font-sans">
                              Previewing first 3 matched preferences:
                            </div>
                            <div className="overflow-x-auto border border-gray-200 bg-white">
                              <table className="w-full text-left border-collapse font-mono text-[10px]">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-gray-200 font-sans text-gray-600">
                                    <th className="p-1.5 w-12 border-r border-gray-200 text-center">PREF</th>
                                    <th className="p-1.5 border-r border-gray-200">INSTITUTION</th>
                                    <th className="p-1.5">BRANCH / PROGRAM</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pastedPreview.slice(0, 3).map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-150 hover:bg-slate-50">
                                      <td className="p-1.5 text-center font-bold border-r border-gray-200 text-gray-600 bg-gray-50">{idx + 1}</td>
                                      <td className="p-1.5 border-r border-gray-200 truncate max-w-[250px]" title={item.institution}>
                                        {item.institution}
                                      </td>
                                      <td className="p-1.5 truncate max-w-[200px]" title={item.branch}>
                                        {item.branch}
                                      </td>
                                    </tr>
                                  ))}
                                  {pastedPreview.length > 3 && (
                                    <tr className="bg-slate-50">
                                      <td colSpan={3} className="p-1.5 text-center text-[10px] text-gray-500 italic font-sans">
                                        ...and {pastedPreview.length - 3} more preferences will be imported.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : pastedText.trim() ? (
                          <div className="text-left text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 uppercase font-bold tracking-tight">
                            ❌ Could not detect any valid Institution / Branch pairs. Please verify format.
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Order Corrector Tool Tab */}
                    {importTab === "matcher" && (
                      <div className="flex flex-col gap-4 text-left font-sans text-xs">
                        <div className="bg-slate-50 border border-slate-300 p-3 text-slate-700 leading-relaxed rounded-sm">
                          <h4 className="font-bold uppercase text-[11px] text-[#002d5a] mb-1 flex items-center gap-1.5">
                            🛠️ Order Corrector Tool (Spreadsheet Alignment Tool)
                          </h4>
                          <p className="text-[11px]">
                            Reorder your master spreadsheet (with all columns) so that its rows match your target preference list sequence!
                          </p>
                          <p className="text-[11px] mt-1 font-semibold text-amber-800">
                            How it works: Upload/paste your master spreadsheet rows below (supporting SNo, Institution Name, and Branch Name). We generate a calculated reorder column. Paste it next to your master spreadsheet, sort <strong>ASCENDING</strong>, and your entire sheet reorders perfectly!
                          </p>
                        </div>

                        {/* Step 1: Target List A Selection */}
                        <div className="bg-white border border-gray-300 p-3 flex flex-col gap-2">
                          <label className="font-bold text-gray-800 uppercase text-[11px] tracking-tight">
                            1. Select Target List A (Desired Priority Sequence):
                          </label>
                          <div className="flex flex-col sm:flex-row gap-3 text-xs">
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-100">
                              <input
                                type="radio"
                                name="targetSource"
                                checked={useAppTableForA}
                                onChange={() => {
                                  setUseAppTableForA(true);
                                  setMatcherStats(null);
                                  setMatcherOutput("");
                                }}
                                className="accent-[#002d5a]"
                              />
                              <span>🎯 Use Active Preference Table ({preferences.length} items)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-100">
                              <input
                                type="radio"
                                name="targetSource"
                                checked={!useAppTableForA}
                                onChange={() => {
                                  setUseAppTableForA(false);
                                  setMatcherStats(null);
                                  setMatcherOutput("");
                                }}
                                className="accent-[#002d5a]"
                              />
                              <span>📝 Paste Custom Target List A</span>
                            </label>
                          </div>

                          {!useAppTableForA && (
                            <div className="mt-2 flex flex-col gap-1">
                              <p className="text-[10px] text-gray-500 leading-tight">
                                Paste target preference lines (one item per line or CSV rows with College & Branch).
                              </p>
                              <textarea
                                value={matcherListA}
                                onChange={(e) => {
                                  setMatcherListA(e.target.value);
                                  setMatcherStats(null);
                                  setMatcherOutput("");
                                }}
                                placeholder="Example:&#10;1, IIIT Dharwad, Computer Science and Engineering (BTECH)&#10;2, IIIT Pune, Electronics and Communication Engineering&#10;3, Birla Institute of Technology Mesra, Mechanical Engineering"
                                className="w-full h-28 border border-gray-400 p-2 font-mono text-[11px] bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                          )}
                        </div>

                        {/* Step 2: Master Spreadsheet (List B) Input */}
                        <div className="bg-white border border-gray-300 p-3 flex flex-col gap-2">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <label className="font-bold text-gray-800 uppercase text-[11px] tracking-tight">
                              2. Upload or Paste Master Spreadsheet Rows (List B):
                            </label>
                            <div className="flex flex-col items-end">
                              <label className="bg-[#002d5a] hover:bg-slate-800 text-white font-bold text-[10px] uppercase px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1">
                                📁 Upload indexed CSV File
                                <input
                                  type="file"
                                  accept=".csv,.txt"
                                  onChange={handleUploadListBFile}
                                  className="hidden"
                                />
                              </label>
                              <span className="text-[9px] text-gray-500 font-medium italic mt-0.5">having an index column apart from data</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-tight">
                            Supports 3-column rows (SNo, College/Institution, Branch/Program), 2-column rows, or tab-separated spreadsheet lines.
                          </p>
                          <textarea
                            value={matcherListB}
                            onChange={(e) => {
                              setMatcherListB(e.target.value);
                              setMatcherStats(null);
                              setMatcherOutput("");
                            }}
                            placeholder="Example (from spreadsheet / CSV):&#10;1   IIIT Dharwad   Computer Science and Engineering (BTECH)&#10;2   IIIT Pune   Electronics and Communication Engineering&#10;22  Birla Institute of Technology, Mesra, Ranchi   Civil Engineering (BTECH)"
                            className="w-full h-36 border border-gray-400 p-2 font-mono text-[11px] bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>

                        <div className="flex justify-center mt-1">
                          <button
                            type="button"
                            onClick={handleRunListMatcher}
                            className="bg-[#002d5a] hover:bg-slate-800 text-white font-bold uppercase tracking-wider px-6 py-2.5 text-xs border-b-2 border-slate-900 hover:border-b-0 active:translate-y-0.5 cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            ⚡ Calculate Reorder Index Numbers
                          </button>
                        </div>

                        {/* Match Results Output */}
                        {matcherStats && (
                          <div className="border border-gray-300 bg-slate-50 p-3.5 mt-2 flex flex-col gap-3">
                            <h5 className="font-bold uppercase text-[10px] text-gray-700 border-b border-gray-200 pb-1 flex items-center justify-between">
                              <span>📊 Matching Results Stats</span>
                              <span className="font-mono text-xs">
                                Matched: <strong className="text-green-700">{matcherStats.matched}</strong> / {matcherStats.total}
                              </span>
                            </h5>

                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                              {/* Left instructions */}
                              <div className="md:col-span-3 flex flex-col gap-2">
                                <div className="text-[11px] leading-relaxed text-gray-700">
                                  <p className="font-bold text-[#002d5a] mb-1">✅ Alignment Complete!</p>
                                  <p>We calculated the target position rank for each row in your master spreadsheet.</p>
                                  <p className="mt-1">
                                    Click <strong>Copy Reorder Column</strong>, paste it directly next to your master spreadsheet, select all columns, and sort <strong>ASCENDING</strong> by this new column!
                                  </p>
                                </div>

                                {matcherStats.isIdentical && (
                                  <div className="border border-blue-300 bg-blue-50/95 text-blue-950 p-2.5 text-[11px] rounded flex flex-col gap-1.5 shadow-sm">
                                    <div className="font-bold uppercase text-[11px] text-blue-900 flex items-center justify-between border-b border-blue-200 pb-1">
                                      <span>ℹ️ Purely Identical Lists Detected</span>
                                      <span className="text-[10px] bg-blue-200 text-blue-900 font-mono px-1.5 py-0.5 rounded">
                                        Identical (1 to {matcherStats.total})
                                      </span>
                                    </div>
                                    <p className="leading-snug text-[11px] text-blue-950 font-medium">
                                      uh oh , itseems like you are either used wrong list to correct or you might already on the same page on your spreadsheet too ,
                                    </p>
                                    <p className="text-[10.5px] text-blue-800 leading-normal">
                                      Both Target List A and Uploaded CSV List B match row-for-row in the exact same sequence (1 to {matcherStats.total}). The reorder column generated is just 1, 2, 3... in natural order.
                                    </p>
                                  </div>
                                )}

                                {matcherStats.unmatched > 0 && (
                                  <div className="border border-amber-300 bg-amber-50/90 text-amber-950 p-2.5 text-[11px] rounded flex flex-col gap-2">
                                    <div className="font-bold uppercase text-[11px] text-amber-900 flex items-center justify-between border-b border-amber-200 pb-1">
                                      <span>⚠️ Warning: {matcherStats.unmatched} Item{matcherStats.unmatched > 1 ? "s" : ""} Missing from Target</span>
                                      <span className="text-[10px] bg-amber-200 text-amber-900 font-mono px-1.5 py-0.5 rounded">
                                        Appended as #{matcherStats.targetCount + 1}+
                                      </span>
                                    </div>

                                    <p className="leading-snug text-[10.5px] text-amber-900">
                                      The following item{matcherStats.unmatched > 1 ? "s" : ""} in your uploaded indexed CSV were not found in your target preference list (likely deleted from your target). They have been assigned sequential numbers continuing directly after your target list (<strong>#{matcherStats.targetCount + 1}, #{matcherStats.targetCount + 2}, ...</strong>) preserving their original relative order. When sorted <strong>ASCENDING</strong> in your master spreadsheet, all valid target choices (1 to {matcherStats.targetCount}) sort to the top, and deleted/extra choices smoothly append directly below them.
                                    </p>

                                    <div className="max-h-24 overflow-y-auto font-mono text-[10px] bg-white border border-amber-200 p-1 divide-y divide-amber-100 text-slate-800 rounded-sm">
                                      {matcherStats.unmatchedItems.map((item, idx) => (
                                        <div key={idx} className="py-0.5 px-1 truncate">
                                          • {item}
                                        </div>
                                      ))}
                                    </div>

                                    <div className="bg-amber-100/80 border border-amber-300 p-2 rounded text-[10.5px] text-amber-950 flex flex-col gap-1">
                                      <div className="font-bold text-amber-900 uppercase text-[10px] tracking-wide flex items-center gap-1">
                                        💡 Actionable Steps Options:
                                      </div>
                                      <div className="flex flex-col gap-1 pl-1">
                                        <div>
                                          <strong className="text-amber-900">Option 1 (Clean Master CSV):</strong> Delete these {matcherStats.unmatched} row{matcherStats.unmatched > 1 ? "s" : ""} (which will sort to positions #{matcherStats.targetCount + 1}+ at the end) from your master spreadsheet if you no longer need them.
                                        </div>
                                        <div>
                                          <strong className="text-amber-900">Option 2 (Restore to Target):</strong> {useAppTableForA ? (
                                            <>Add these missing choice(s) back into your <strong>Active Preference Table</strong> in the app, then click '⚡ Calculate Reorder Index Numbers' again.</>
                                          ) : (
                                            <>Add these missing choice(s) into your <strong>Custom Target List A</strong>, then click '⚡ Calculate Reorder Index Numbers' again.</>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {matcherStats.targetMissingItems && matcherStats.targetMissingItems.length > 0 && (
                                  <div className="border border-red-300 bg-red-50/90 text-red-950 p-2.5 text-[11px] rounded flex flex-col gap-2">
                                    <div className="font-bold uppercase text-[11px] text-red-900 flex items-center justify-between border-b border-red-200 pb-1">
                                      <span>⚠️ Warning: {matcherStats.targetMissingItems.length} Target Choice{matcherStats.targetMissingItems.length > 1 ? "s" : ""} Missing from Uploaded CSV</span>
                                      <span className="text-[10px] bg-red-200 text-red-900 font-mono px-1.5 py-0.5 rounded">Not Found in CSV</span>
                                    </div>

                                    <p className="leading-snug text-[10.5px] text-red-900">
                                      Your target preference list contains {matcherStats.targetMissingItems.length} choice{matcherStats.targetMissingItems.length > 1 ? "s" : ""} that do not exist in your uploaded indexed CSV.
                                    </p>

                                    <div className="max-h-24 overflow-y-auto font-mono text-[10px] bg-white border border-red-200 p-1 divide-y divide-red-100 text-slate-800 rounded-sm">
                                      {matcherStats.targetMissingItems.map((item, idx) => (
                                        <div key={idx} className="py-0.5 px-1 truncate">
                                          • {item}
                                        </div>
                                      ))}
                                    </div>

                                    <div className="bg-red-100/80 border border-red-300 p-2 rounded text-[10.5px] text-red-950 flex flex-col gap-1">
                                      <div className="font-bold text-red-900 uppercase text-[10px] tracking-wide flex items-center gap-1">
                                        💡 Actionable Steps Options:
                                      </div>
                                      <div className="flex flex-col gap-1 pl-1">
                                        <div>
                                          <strong className="text-red-900">Option 1 (Add Rows to Master CSV):</strong> Manually add these {matcherStats.targetMissingItems.length} missing row{matcherStats.targetMissingItems.length > 1 ? "s" : ""} into your master CSV/spreadsheet so that all choices can be indexed and reordered.
                                        </div>
                                        <div>
                                          <strong className="text-red-900">Option 2 (Remove from Target):</strong> {useAppTableForA ? (
                                            <>Delete or remove these choice(s) from your <strong>Active Preference Table</strong> in the app, then click '⚡ Calculate Reorder Index Numbers' again.</>
                                          ) : (
                                            <>Remove these line(s) from your <strong>Custom Target List A</strong>, then click '⚡ Calculate Reorder Index Numbers' again.</>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right Output Textarea and Copy */}
                              <div className="md:col-span-2 flex flex-col gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleCopyMatcherOutput}
                                  className="w-full bg-[#28a745] hover:bg-[#218838] active:bg-[#1e7e34] text-white py-2 text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer transition-colors"
                                >
                                  📋 Copy Reorder Column
                                </button>
                                <textarea
                                  readOnly
                                  value={matcherOutput}
                                  className="w-full h-32 border border-gray-300 p-2 font-mono text-center text-xs bg-white text-gray-800 select-all focus:outline-none"
                                  title="Click and press Ctrl+A to select all"
                                  placeholder="Generated Column"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Table Layout */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[650px]" id="choice-table">
              <thead>
                <tr className="bg-[#e9ecef] border-b border-gray-400 text-[10px] font-bold text-gray-700 font-sans">
                  <th className="w-12 border-r border-gray-400 py-3 text-center uppercase">Pref No.</th>
                  <th className="border-r border-gray-400 px-3 py-3 text-left uppercase w-[44%]">Institution</th>
                  <th className="border-r border-gray-400 px-3 py-3 text-left uppercase w-[31%]">Branch / Program</th>
                  <th className="w-14 border-r border-gray-400 py-3 text-center uppercase">Change</th>
                  {onMoveToPosition && (
                    <th className="w-14 border-r border-gray-400 py-3 text-center uppercase">Jump</th>
                  )}
                  <th className="w-20 border-r border-gray-400 py-3 text-center uppercase">Actions</th>
                  <th className="w-14 py-1 text-center uppercase text-slate-600 bg-slate-100 align-middle">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="leading-none text-[9px]">Orig No.</span>
                      <button
                        type="button"
                        onClick={handleCopyOriginalOrders}
                        className="bg-white border border-slate-400 hover:bg-slate-200 text-slate-800 text-[8px] font-extrabold px-1 py-0.5 rounded shadow-sm active:scale-95 transition-all cursor-pointer leading-none"
                        title="Copy original serial numbers as spreadsheet vertical column"
                      >
                        COPY
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 text-xs">
                {preferences.map((item, index) => {
                  const prefNo = index + 1;
                  const isFirst = index === 0;
                  const isLast = index === preferences.length - 1;
                  const isEditing = editingId === item.id;

                  return (
                    <tr 
                      key={item.id} 
                      className={`text-gray-900 border-b border-gray-300 hover:bg-yellow-50 transition-colors font-sans ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } ${isEditing ? "bg-blue-50/50" : ""}`}
                      id={`row-${item.id}`}
                    >
                      {/* Preference Serial Number */}
                      <td className="text-center font-bold border-r border-gray-300 py-4 bg-gray-100 text-[#002d5a] w-12 font-mono text-xs">
                        {prefNo}
                      </td>

                      {/* Institution Name */}
                      <td className="px-3 py-4 border-r border-gray-300 font-medium break-words whitespace-normal text-xs md:text-[13px] leading-relaxed">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={editInstitution}
                              onChange={(e) => {
                                setEditInstitution(e.target.value);
                                setEditError(null);
                              }}
                              className="w-full border border-gray-500 p-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans text-gray-900"
                              placeholder="Enter Institution"
                              autoFocus
                            />
                            {editError && (
                              <span className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-200 px-1 py-0.5 uppercase tracking-tight">
                                {editError}
                              </span>
                            )}
                          </div>
                        ) : (
                          item.institution
                        )}
                      </td>

                      {/* Branch Name */}
                      <td className="px-3 py-4 border-r border-gray-300 text-gray-800 break-words whitespace-normal text-xs md:text-[13px] leading-relaxed font-sans">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editBranch}
                            onChange={(e) => {
                              setEditBranch(e.target.value);
                              setEditError(null);
                            }}
                            className="w-full border border-gray-500 p-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans text-gray-900"
                            placeholder="Enter Branch/Program"
                          />
                        ) : (
                          item.branch
                        )}
                      </td>

                      {/* Move Up / Move Down buttons */}
                      <td className="px-1 py-4 border-r border-gray-300 w-14 align-middle text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {/* Up Button */}
                          <button
                            onClick={() => onMoveUp(index)}
                            disabled={isFirst || isEditing}
                            title="Move Up"
                            className="w-11 py-1 bg-gray-200 border border-gray-400 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 text-gray-850 text-[9px] font-bold cursor-pointer disabled:cursor-not-allowed transition-colors text-center"
                            id={`btn-up-${item.id}`}
                          >
                            UP
                          </button>
                          
                          {/* Down Button */}
                          <button
                            onClick={() => onMoveDown(index)}
                            disabled={isLast || isEditing}
                            title="Move Down"
                            className="w-11 py-1 bg-gray-200 border border-gray-400 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 text-gray-850 text-[9px] font-bold cursor-pointer disabled:cursor-not-allowed transition-colors text-center"
                            id={`btn-down-${item.id}`}
                          >
                            DOWN
                          </button>
                        </div>
                      </td>

                      {/* Jump to Preference Number */}
                      {onMoveToPosition && (
                        <td className="px-1 py-4 border-r border-gray-300 w-14 align-middle text-center">
                          <form 
                            onSubmit={(e) => handleJumpSubmit(e, index, item.id)}
                            className="flex flex-col items-center justify-center gap-1"
                          >
                            <input
                              type="number"
                              min="1"
                              max={preferences.length}
                              disabled={isEditing}
                              value={jumpInputs[item.id] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setJumpInputs((prev) => ({ ...prev, [item.id]: val }));
                              }}
                              placeholder="No."
                              className="w-11 text-center border border-gray-400 bg-gray-50 text-gray-900 py-0.5 px-0.5 text-[10px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono disabled:bg-gray-200 disabled:cursor-not-allowed"
                            />
                            <button
                              type="submit"
                              disabled={isEditing}
                              className="w-11 bg-[#002d5a] text-white py-0.5 text-[9px] font-bold border border-gray-400 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed cursor-pointer"
                            >
                              GO
                            </button>
                          </form>
                        </td>
                      )}

                      {/* Actions column supporting Edit, Save, Cancel, and Confirming Remove */}
                      <td className="px-1 py-4 text-center w-20 align-middle border-r border-gray-300">
                        {isEditing ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveEdit(index)}
                              className="w-[64px] py-1 bg-green-100 border border-green-500 text-green-700 hover:bg-green-200 text-[9px] font-bold cursor-pointer transition-colors"
                              id={`btn-save-${item.id}`}
                            >
                              SAVE
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditError(null);
                              }}
                              className="w-[64px] py-1 bg-gray-100 border border-gray-400 text-gray-700 hover:bg-gray-200 text-[9px] font-bold cursor-pointer transition-colors"
                              id={`btn-cancel-${item.id}`}
                            >
                              CANCEL
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingId(item.id);
                                setEditInstitution(item.institution);
                                setEditBranch(item.branch);
                                setEditError(null);
                              }}
                              className="w-[64px] py-1 bg-blue-100 border border-blue-400 text-blue-700 hover:bg-blue-200 text-[9px] font-bold cursor-pointer transition-colors"
                              id={`btn-edit-${item.id}`}
                            >
                              EDIT
                            </button>
                            <button
                              onClick={() => {
                                  if (deleteConfirmId === item.id) {
                                    onDelete(index);
                                    setDeleteConfirmId(null);
                                  } else {
                                    setDeleteConfirmId(item.id);
                                    // Auto reset confirmation after 3 seconds
                                    setTimeout(() => {
                                      setDeleteConfirmId((curr) => (curr === item.id ? null : curr));
                                    }, 3000);
                                  }
                              }}
                              className={`w-[64px] py-1 border text-[9px] font-bold cursor-pointer transition-colors select-none ${
                                deleteConfirmId === item.id
                                  ? "bg-red-600 border-red-700 text-white hover:bg-red-700"
                                  : "bg-red-100 border-red-400 text-red-700 hover:bg-red-200"
                              }`}
                              id={`btn-delete-${item.id}`}
                            >
                              {deleteConfirmId === item.id ? "CONFIRM" : "REMOVE"}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Original Preference Number Column */}
                      <td className="text-center font-bold py-4 bg-slate-50 text-slate-500 w-14 font-mono text-[11px]">
                        {item.originalOrder !== undefined ? item.originalOrder : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Under-table micro footer with JoSAA style details */}
      {preferences.length > 0 && (
        <div className="mt-2 text-[10px] text-slate-500 font-mono flex flex-col sm:flex-row sm:justify-between sm:items-center px-1">
          <div>* Use UP / DOWN buttons, or enter a number in Jump Box to alter preference ordering directly.</div>
          <div className="mt-1 sm:mt-0 font-bold text-slate-600 uppercase">PREFERENCE LIST CURRENTLY UNLOCKED (DRAFT SAVED TO BROWSER STORAGE)</div>
        </div>
      )}

      {/* Modal Overlay for Order Corrector Tool (OCT) */}
      {isOCTOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto" id="oct-modal-overlay">
          <div className="bg-white border-2 border-[#002d5a] max-w-4xl w-full shadow-2xl rounded-sm my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left font-sans text-xs">
            {/* Modal Header */}
            <div className="bg-[#002d5a] text-white px-4 py-3 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-base">🛠️</span>
                <h3 className="font-bold text-sm uppercase tracking-wide">
                  Order Corrector Tool (Spreadsheet Alignment Tool)
                </h3>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-slate-50 border border-slate-300 p-3 text-slate-700 leading-relaxed rounded-sm">
                <p className="text-[12px] font-semibold text-[#002d5a] mb-1">
                  Reorder your master spreadsheet (with all columns) so that its rows match your target preference list sequence!
                </p>
                <p className="text-[11px] text-gray-600 leading-normal">
                  <strong>How it works:</strong> Upload or paste your master spreadsheet rows below (supporting SNo, College/Institution, and Branch/Program). We calculate the target position number for each row. Paste the generated numbers column back next to your master spreadsheet, sort <strong>ASCENDING</strong> by that column, and your full master spreadsheet reorders instantly!
                </p>
              </div>

              {/* Step 1: Target List A Selection */}
              <div className="bg-white border border-gray-300 p-3.5 flex flex-col gap-2 rounded-sm">
                <label className="font-bold text-gray-800 uppercase text-[11px] tracking-tight flex items-center justify-between">
                  <span>1. Select Target List A (Desired Priority Sequence):</span>
                  <span className="text-blue-800 font-mono font-bold text-[10px] bg-blue-50 px-2 py-0.5 border border-blue-200">
                    {useAppTableForA ? `${preferences.length} preferences active` : `${matcherListA.split(/\r?\n/).filter(Boolean).length} lines entered`}
                  </span>
                </label>
                <div className="flex flex-col sm:flex-row gap-3 text-xs my-1">
                  <label className={`flex items-center gap-2 cursor-pointer font-bold px-3 py-2 rounded border transition-all ${
                    useAppTableForA ? "bg-blue-50 border-blue-600 text-[#002d5a]" : "bg-slate-50 border-slate-300 text-slate-700"
                  }`}>
                    <input
                      type="radio"
                      name="modalTargetSource"
                      checked={useAppTableForA}
                      onChange={() => {
                        setUseAppTableForA(true);
                        setMatcherStats(null);
                        setMatcherOutput("");
                      }}
                      className="accent-[#002d5a]"
                    />
                    <span>🎯 Use Active Preference Table ({preferences.length} choices filled)</span>
                  </label>
                  <label className={`flex items-center gap-2 cursor-pointer font-bold px-3 py-2 rounded border transition-all ${
                    !useAppTableForA ? "bg-blue-50 border-blue-600 text-[#002d5a]" : "bg-slate-50 border-slate-300 text-slate-700"
                  }`}>
                    <input
                      type="radio"
                      name="modalTargetSource"
                      checked={!useAppTableForA}
                      onChange={() => {
                        setUseAppTableForA(false);
                        setMatcherStats(null);
                        setMatcherOutput("");
                      }}
                      className="accent-[#002d5a]"
                    />
                    <span>📝 Paste Custom Target List A</span>
                  </label>
                </div>

                {useAppTableForA && preferences.length > 0 && (
                  <div className="mt-1 bg-slate-50 border border-slate-200 p-2.5 max-h-28 overflow-y-auto font-mono text-[11px] text-slate-700 divide-y divide-gray-200">
                    {preferences.map((p, idx) => (
                      <div key={p.id} className="py-1 flex items-start gap-2">
                        <span className="font-bold text-[#002d5a] w-6 shrink-0">{idx + 1}.</span>
                        <span className="truncate">{p.institution} <span className="text-gray-500 font-sans">({p.branch})</span></span>
                      </div>
                    ))}
                  </div>
                )}

                {!useAppTableForA && (
                  <div className="mt-1 flex flex-col gap-1">
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Paste target preference lines (one item per line or CSV rows with College & Branch).
                    </p>
                    <textarea
                      value={matcherListA}
                      onChange={(e) => {
                        setMatcherListA(e.target.value);
                        setMatcherStats(null);
                        setMatcherOutput("");
                      }}
                      placeholder="Example:&#10;1, IIIT Dharwad, Computer Science and Engineering (BTECH)&#10;2, IIIT Pune, Electronics and Communication Engineering&#10;3, Birla Institute of Technology Mesra, Mechanical Engineering"
                      className="w-full h-28 border border-gray-400 p-2 font-mono text-[11px] bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                )}
              </div>

              {/* Step 2: Master Spreadsheet (List B) Input */}
              <div className="bg-white border border-gray-300 p-3.5 flex flex-col gap-2 rounded-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <label className="font-bold text-gray-800 uppercase text-[11px] tracking-tight">
                    2. Upload or Paste Master Spreadsheet Rows (List B):
                  </label>
                  <div className="flex flex-col items-end">
                    <label className="bg-[#002d5a] hover:bg-slate-800 text-white font-bold text-[10px] uppercase px-3 py-1 rounded cursor-pointer transition-colors flex items-center gap-1 shadow-sm">
                      📁 Upload indexed CSV File
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleUploadListBFile}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[9px] text-gray-500 font-medium italic mt-0.5">having an index column apart from data</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Supports 3-column spreadsheet rows (SNo, College/Institution, Branch/Program), 2-column rows, or tab-separated spreadsheet lines.
                </p>
                <textarea
                  value={matcherListB}
                  onChange={(e) => {
                    setMatcherListB(e.target.value);
                    setMatcherStats(null);
                    setMatcherOutput("");
                  }}
                  placeholder="Example (from spreadsheet / CSV):&#10;1   IIIT Dharwad   Computer Science and Engineering (BTECH)&#10;2   IIIT Pune   Electronics and Communication Engineering&#10;22  Birla Institute of Technology, Mesra, Ranchi   Civil Engineering (BTECH)"
                  className="w-full h-36 border border-gray-400 p-2 font-mono text-[11px] bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-center my-1">
                <button
                  type="button"
                  onClick={handleRunListMatcher}
                  className="bg-[#002d5a] hover:bg-slate-800 active:bg-slate-900 text-white font-bold uppercase tracking-wider px-6 py-2.5 text-xs border-b-2 border-slate-900 active:border-b-0 active:translate-y-0.5 cursor-pointer transition-all flex items-center gap-1.5 shadow"
                >
                  ⚡ Calculate Reorder Index Numbers
                </button>
              </div>

              {/* Match Results Output */}
              {matcherStats && (
                <div className="border border-gray-300 bg-slate-50 p-4 flex flex-col gap-3 rounded-sm">
                  <h5 className="font-bold uppercase text-[11px] text-gray-800 border-b border-gray-200 pb-1.5 flex items-center justify-between">
                    <span>📊 Alignment Results Stats</span>
                    <span className="font-mono text-xs">
                      Matched: <strong className="text-green-700">{matcherStats.matched}</strong> / {matcherStats.total}
                    </span>
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                    {/* Left instructions */}
                    <div className="md:col-span-3 flex flex-col gap-2">
                      <div className="text-[11px] leading-relaxed text-gray-700 bg-white border border-gray-200 p-2.5">
                        <p className="font-bold text-[#002d5a] mb-1">✅ Calculation Complete!</p>
                        <p>We mapped each row in your master spreadsheet to its target preference position.</p>
                        <p className="mt-1 font-semibold text-amber-800">
                          Click <strong>Copy Reorder Column</strong>, paste it directly next to your master spreadsheet, select all columns, and sort <strong>ASCENDING</strong> by this new column!
                        </p>
                      </div>

                      {matcherStats.isIdentical && (
                        <div className="border border-blue-300 bg-blue-50/95 text-blue-950 p-2.5 text-[11px] rounded flex flex-col gap-1.5 shadow-sm">
                          <div className="font-bold uppercase text-[11px] text-blue-900 flex items-center justify-between border-b border-blue-200 pb-1">
                            <span>ℹ️ Purely Identical Lists Detected</span>
                            <span className="text-[10px] bg-blue-200 text-blue-900 font-mono px-1.5 py-0.5 rounded">
                              Identical (1 to {matcherStats.total})
                            </span>
                          </div>
                          <p className="leading-snug text-[11px] text-blue-950 font-medium">
                            uh oh , itseems like you are either used wrong list to correct or you might already on the same page on your spreadsheet too ,
                          </p>
                          <p className="text-[10.5px] text-blue-800 leading-normal">
                            Both Target List A and Uploaded CSV List B match row-for-row in the exact same sequence (1 to {matcherStats.total}). The reorder column generated is just 1, 2, 3... in natural order.
                          </p>
                        </div>
                      )}

                      {matcherStats.unmatched > 0 && (
                        <div className="border border-amber-300 bg-amber-50/90 text-amber-950 p-2.5 text-[11px] rounded flex flex-col gap-2">
                          <div className="font-bold uppercase text-[11px] text-amber-900 flex items-center justify-between border-b border-amber-200 pb-1">
                            <span>⚠️ Warning: {matcherStats.unmatched} Item{matcherStats.unmatched > 1 ? "s" : ""} Missing from Target</span>
                            <span className="text-[10px] bg-amber-200 text-amber-900 font-mono px-1.5 py-0.5 rounded">
                              Appended as #{matcherStats.targetCount + 1}+
                            </span>
                          </div>

                          <p className="leading-snug text-[10.5px] text-amber-900">
                            The following item{matcherStats.unmatched > 1 ? "s" : ""} in your uploaded indexed CSV were not found in your target preference list (likely deleted from your target). They have been assigned sequential numbers continuing directly after your target list (<strong>#{matcherStats.targetCount + 1}, #{matcherStats.targetCount + 2}, ...</strong>) preserving their original relative order. When sorted <strong>ASCENDING</strong> in your master spreadsheet, all valid target choices (1 to {matcherStats.targetCount}) sort to the top, and deleted/extra choices smoothly append directly below them.
                          </p>

                          <div className="max-h-24 overflow-y-auto font-mono text-[10px] bg-white border border-amber-200 p-1 divide-y divide-amber-100 text-slate-800 rounded-sm">
                            {matcherStats.unmatchedItems.map((item, idx) => (
                              <div key={idx} className="py-0.5 px-1 truncate">
                                • {item}
                              </div>
                            ))}
                          </div>

                          <div className="bg-amber-100/80 border border-amber-300 p-2 rounded text-[10.5px] text-amber-950 flex flex-col gap-1">
                            <div className="font-bold text-amber-900 uppercase text-[10px] tracking-wide flex items-center gap-1">
                              💡 Actionable Steps Options:
                            </div>
                            <div className="flex flex-col gap-1 pl-1">
                              <div>
                                <strong className="text-amber-900">Option 1 (Clean Master CSV):</strong> Delete these {matcherStats.unmatched} row{matcherStats.unmatched > 1 ? "s" : ""} (which will sort to positions #{matcherStats.targetCount + 1}+ at the end) from your master spreadsheet if you no longer need them.
                              </div>
                              <div>
                                <strong className="text-amber-900">Option 2 (Restore to Target):</strong> {useAppTableForA ? (
                                  <>Add these missing choice(s) back into your <strong>Active Preference Table</strong> in the app, then click '⚡ Calculate Reorder Index Numbers' again.</>
                                ) : (
                                  <>Add these missing choice(s) into your <strong>Custom Target List A</strong>, then click '⚡ Calculate Reorder Index Numbers' again.</>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {matcherStats.targetMissingItems && matcherStats.targetMissingItems.length > 0 && (
                        <div className="border border-red-300 bg-red-50/90 text-red-950 p-2.5 text-[11px] rounded flex flex-col gap-2">
                          <div className="font-bold uppercase text-[11px] text-red-900 flex items-center justify-between border-b border-red-200 pb-1">
                            <span>⚠️ Warning: {matcherStats.targetMissingItems.length} Target Choice{matcherStats.targetMissingItems.length > 1 ? "s" : ""} Missing from Uploaded CSV</span>
                            <span className="text-[10px] bg-red-200 text-red-900 font-mono px-1.5 py-0.5 rounded">Not Found in CSV</span>
                          </div>

                          <p className="leading-snug text-[10.5px] text-red-900">
                            Your target preference list contains {matcherStats.targetMissingItems.length} choice{matcherStats.targetMissingItems.length > 1 ? "s" : ""} that do not exist in your uploaded indexed CSV.
                          </p>

                          <div className="max-h-24 overflow-y-auto font-mono text-[10px] bg-white border border-red-200 p-1 divide-y divide-red-100 text-slate-800 rounded-sm">
                            {matcherStats.targetMissingItems.map((item, idx) => (
                              <div key={idx} className="py-0.5 px-1 truncate">
                                • {item}
                              </div>
                            ))}
                          </div>

                          <div className="bg-red-100/80 border border-red-300 p-2 rounded text-[10.5px] text-red-950 flex flex-col gap-1">
                            <div className="font-bold text-red-900 uppercase text-[10px] tracking-wide flex items-center gap-1">
                              💡 Actionable Steps Options:
                            </div>
                            <div className="flex flex-col gap-1 pl-1">
                              <div>
                                <strong className="text-red-900">Option 1 (Add Rows to Master CSV):</strong> Manually add these {matcherStats.targetMissingItems.length} missing row{matcherStats.targetMissingItems.length > 1 ? "s" : ""} into your master CSV/spreadsheet so that all choices can be indexed and reordered.
                              </div>
                              <div>
                                <strong className="text-red-900">Option 2 (Remove from Target):</strong> {useAppTableForA ? (
                                  <>Delete or remove these choice(s) from your <strong>Active Preference Table</strong> in the app, then click '⚡ Calculate Reorder Index Numbers' again.</>
                                ) : (
                                  <>Remove these line(s) from your <strong>Custom Target List A</strong>, then click '⚡ Calculate Reorder Index Numbers' again.</>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Output Textarea and Copy */}
                    <div className="md:col-span-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleCopyMatcherOutput}
                        className="w-full bg-[#28a745] hover:bg-[#218838] active:bg-[#1e7e34] text-white py-2 text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer transition-colors"
                      >
                        📋 Copy Reorder Column
                      </button>
                      <textarea
                        readOnly
                        value={matcherOutput}
                        className="w-full h-32 border border-gray-300 p-2 font-mono text-center text-xs bg-white text-gray-800 select-all focus:outline-none"
                        title="Click and press Ctrl+A to select all"
                        placeholder="Generated Column"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-100 border-t border-gray-300 px-4 py-3 flex justify-end">
              <button
                type="button"
                onClick={closeOCTModal}
                className="bg-[#002d5a] hover:bg-slate-800 text-white px-5 py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer font-sans transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
