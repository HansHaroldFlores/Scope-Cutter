import React, { useState, useEffect, useRef } from "react";
import { 
  Scissors, 
  Copy, 
  Check, 
  Trash2, 
  Plus, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  AlertTriangle, 
  Download, 
  Upload,
  HelpCircle,
  RefreshCw,
  Info
} from "lucide-react";
import { FeatureCard, FeatureCategory, EffortLevel } from "./types";

function isFeatureCard(value: unknown): value is FeatureCard {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const card = value as Record<string, unknown>;
  return typeof card.id === "string" &&
    typeof card.title === "string" &&
    typeof card.description === "string" &&
    typeof card.prompt === "string" &&
    (card.effort === "Small" || card.effort === "Medium" || card.effort === "Large") &&
    (card.category === "must" || card.category === "nice" || card.category === "cut");
}

const SAMPLE_IDEAS = [
  {
    title: "AI Travel Planner",
    text: "A travel app that builds personalized 5-day itineraries based on user interests, budget, and real-time weather, with interactive map routes and social sharing."
  },
  {
    title: "SaaS CRM Dashboard",
    text: "A modern CRM dashboard with custom pipelines, automatic email integration, team activity tracking, client document signing, and complex analytics charts."
  },
  {
    title: "Pet Social Network",
    text: "A social media platform for pet owners to share posts, find playdates via real-time geolocation, message nearby owners, and schedule vet visits."
  },
  {
    title: "Finance Tracker",
    text: "A personal budget manager that imports banking CSVs, categorizes transactions with deep learning, sends daily mobile summaries, and generates tax forms."
  }
];

// Copies text to the clipboard, falling back to execCommand when the Clipboard API is unavailable
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      return document.execCommand("copy");
    } catch (e) {
      console.error("Failed to copy text", e);
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

export default function App() {
  const [idea, setIdea] = useState("");
  const [ideaHistory, setIdeaHistory] = useState<string[]>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("scope_cutter_idea_history") || "[]");
      return Array.isArray(cached)
        ? [...new Set(cached.filter((item): item is string => typeof item === "string" && !!item.trim()))].slice(0, 5)
        : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureCard[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [undoState, setUndoState] = useState<{ features: FeatureCard[]; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [effortFilter, setEffortFilter] = useState<EffortLevel | "All">("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<FeatureCard | null>(null);
  const [copiedMustHaves, setCopiedMustHaves] = useState(false);
  
  // Custom states for adding a new card
  const [showAddForm, setShowAddForm] = useState<FeatureCategory | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEffort, setNewEffort] = useState<EffortLevel>("Medium");
  const [newPrompt, setNewPrompt] = useState("");

  useEffect(() => {
    try {
      if (ideaHistory.length > 0) {
        localStorage.setItem("scope_cutter_idea_history", JSON.stringify(ideaHistory));
      } else {
        localStorage.removeItem("scope_cutter_idea_history");
      }
    } catch {
      // Keep history usable in memory when browser storage is unavailable.
    }
  }, [ideaHistory]);

  // Default initial instructions if no features loaded yet
  useEffect(() => {
    // Check if we have cached state
    const cached = localStorage.getItem("scope_cutter_features");
    if (cached) {
      try {
        setFeatures(JSON.parse(cached));
      } catch {
        // Fallback if parsing fails
      }
    }
  }, []);

  useEffect(() => {
    if (!undoState) return;
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [undoState]);

  // Any board change dismisses a pending undo so it can't revert later edits
  const saveToCache = (updated: FeatureCard[]) => {
    setUndoState(null);
    setFeatures(updated);
    localStorage.setItem("scope_cutter_features", JSON.stringify(updated));
  };

  const handleDecompose = async () => {
    if (!idea.trim()) return;
    const submittedIdea = idea.trim();
    setIdeaHistory(history => [submittedIdea, ...history.filter(item => item !== submittedIdea)].slice(0, 5));
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000); // 30 seconds hard timeout

    try {
      const response = await fetch("/api/decompose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idea }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to decompose the idea. Check API configuration.");
      }

      const data = await response.json();
      console.log("[Scope Cutter Client] Raw parsed response:", data);

      if (data && Array.isArray(data.features)) {
        saveToCache(data.features);
      } else {
        throw new Error("Invalid structure returned by the scope server.");
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      console.error("[Scope Cutter Client] handleDecompose failed:", err);
      if (err instanceof Error && err.name === "AbortError") {
        setError("The request timed out (30 seconds limit reached). Please check your internet connection or try again.");
      } else {
        setError((err instanceof Error && err.message) || "An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = async (id: string, text: string) => {
    if (await copyText(text)) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetCategory: FeatureCategory) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    const updated = features.map(f => {
      if (f.id === id) {
        return { ...f, category: targetCategory };
      }
      return f;
    });
    saveToCache(updated);
  };

  const moveCard = (id: string, direction: 'left' | 'right' | FeatureCategory) => {
    const categories: FeatureCategory[] = ["must", "nice", "cut"];
    const updated = features.map(f => {
      if (f.id === id) {
        let newCat = f.category;
        if (typeof direction === 'string' && categories.includes(direction as FeatureCategory)) {
          newCat = direction as FeatureCategory;
        } else {
          const currentIndex = categories.indexOf(f.category);
          if (direction === 'left' && currentIndex > 0) {
            newCat = categories[currentIndex - 1];
          } else if (direction === 'right' && currentIndex < categories.length - 1) {
            newCat = categories[currentIndex + 1];
          }
        }
        return { ...f, category: newCat };
      }
      return f;
    });
    saveToCache(updated);
  };

  const deleteCard = (id: string) => {
    const updated = features.filter(f => f.id !== id);
    saveToCache(updated);
    setUndoState({ features, message: "Card deleted." });
  };

  const undoDelete = () => {
    if (!undoState) return;
    saveToCache(undoState.features);
  };

  const addCustomCard = (category: FeatureCategory) => {
    if (!newTitle.trim() || !newDesc.trim()) return;

    const newCard: FeatureCard = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      effort: newEffort,
      category,
      prompt: newPrompt.trim() || `Build a feature called "${newTitle.trim()}" described as: ${newDesc.trim()}. Include clean React hooks, robust Tailwind styling, custom error boundary, and responsive layouts.`
    };

    saveToCache([...features, newCard]);
    // reset form
    setNewTitle("");
    setNewDesc("");
    setNewEffort("Medium");
    setNewPrompt("");
    setShowAddForm(null);
  };

  const updateCard = () => {
    if (!editingCard) return;
    const updated = features.map(f => f.id === editingCard.id ? editingCard : f);
    saveToCache(updated);
    setEditingCard(null);
  };

  const clearAll = () => {
    if (window.confirm("Are you sure you want to clear your current board?")) {
      saveToCache([]);
      setUndoState({ features, message: "Board cleared." });
    }
  };

  const mustHaves = features.filter(f => f.category === "must");
  const niceToHaves = features.filter(f => f.category === "nice");
  const cutIts = features.filter(f => f.category === "cut");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesFilters = (card: FeatureCard) =>
    (effortFilter === "All" || card.effort === effortFilter) &&
    (card.title.toLowerCase().includes(normalizedSearch) ||
      card.description.toLowerCase().includes(normalizedSearch));
  const visibleMustHaves = mustHaves.filter(matchesFilters);
  const visibleNiceToHaves = niceToHaves.filter(matchesFilters);
  const visibleCutIts = cutIts.filter(matchesFilters);
  const getEffortScore = (cards: FeatureCard[]) =>
    cards.reduce((total, card) => total + ({ Small: 1, Medium: 3, Large: 5 }[card.effort] || 0), 0);

  const hasScopeCreep = mustHaves.length > 5;

  // Export full project scope brief
  const downloadMVPPlan = () => {
    if (features.length === 0) return;
    
    let content = `# Scope Cutter - Project Decomposition Plan\n`;
    content += `Generated on ${new Date().toLocaleDateString()}\n\n`;
    content += `## 🟢 MUST HAVE (MVP) [${mustHaves.length} Features]${hasScopeCreep ? ' - ⚠️ SCOPE CREEP WARNING (>5 features)' : ''}\n`;
    mustHaves.forEach((f, i) => {
      content += `### ${i+1}. ${f.title} (Effort: ${f.effort})\n`;
      content += `> ${f.description}\n\n`;
      content += `**AI Prompt for this feature:**\n\`\`\`text\n${f.prompt}\n\`\`\`\n\n`;
    });

    content += `\n## 🟡 NICE TO HAVE [${niceToHaves.length} Features]\n`;
    niceToHaves.forEach((f, i) => {
      content += `### ${i+1}. ${f.title} (Effort: ${f.effort})\n`;
      content += `> ${f.description}\n\n`;
      content += `**AI Prompt for this feature:**\n\`\`\`text\n${f.prompt}\n\`\`\`\n\n`;
    });

    content += `\n## 🔴 CUT IT (Scope Cut) [${cutIts.length} Features]\n`;
    cutIts.forEach((f, i) => {
      content += `### ${i+1}. ${f.title} (Effort: ${f.effort})\n`;
      content += `> ${f.description}\n\n`;
      content += `**AI Prompt for this feature:**\n\`\`\`text\n${f.prompt}\n\`\`\`\n\n`;
    });

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Scope_Cutter_MVP_Plan.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportFeatures = () => {
    const blob = new Blob([JSON.stringify(features, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Scope_Cutter_Features.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importFeatures = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportError(null);
    let importedFeatures: unknown;
    try {
      importedFeatures = JSON.parse(await file.text());
    } catch {
      setImportError("The selected file is not valid JSON.");
      return;
    }

    if (!Array.isArray(importedFeatures) || !importedFeatures.every(isFeatureCard)) {
      setImportError("Invalid feature data. Expected an array of feature cards with string id, title, description, and prompt fields, a valid effort, and a valid category.");
      return;
    }

    if (new Set(importedFeatures.map(card => card.id)).size !== importedFeatures.length) {
      setImportError("Invalid feature data. Each feature card must have a unique id.");
      return;
    }

    if (!window.confirm("Importing will replace your current board. Continue?")) return;

    try {
      saveToCache(importedFeatures);
    } catch {
      setImportError("The file is valid, but the board could not be saved to browser storage.");
    }
  };

  const copyMustHavePrompts = async () => {
    if (mustHaves.length === 0) return;
    let markdown = `# Must Have MVP Prompts\n\n`;
    mustHaves.forEach((f, i) => {
      markdown += `${i + 1}. **${f.title}** (${f.effort} Effort)\n`;
      markdown += `   *Description:* ${f.description}\n`;
      markdown += `   *AI Build Prompt:*\n   \`\`\`text\n   ${f.prompt.replace(/\n/g, "\n   ")}\n   \`\`\`\n\n`;
    });

    if (await copyText(markdown)) {
      setCopiedMustHaves(true);
      setTimeout(() => setCopiedMustHaves(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f1f5f9] px-4 py-8 md:px-8 selection:bg-cyan-500 selection:text-black">
      {/* Container to restrict max width for sleek desktop layout */}
      <div className="max-w-7xl mx-auto space-y-8" id="scope-cutter-app">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500 rounded-xl shadow-lg shadow-cyan-500/10">
              <Scissors className="w-7 h-7 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-display tracking-tight text-white flex items-center gap-2">
                Scope Cutter
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950/50 text-cyan-400 border border-cyan-850">
                  AI Decomposer
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Stop overbuilding. Cut the fat and design buildable, micro-scoped features.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {features.length > 0 && (
              <>
                {mustHaves.length > 0 && (
                  <button
                    onClick={copyMustHavePrompts}
                    className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
                      copiedMustHaves
                        ? "bg-emerald-950/40 text-emerald-400 border border-emerald-850"
                        : "bg-cyan-500 hover:bg-cyan-600 text-black border border-transparent shadow-md shadow-cyan-500/10"
                    }`}
                    title="Copy all Must Have prompts to clipboard as a markdown list"
                  >
                    {copiedMustHaves ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedMustHaves ? "Copied MVP Prompts" : "Export MVP Prompts"}</span>
                  </button>
                )}
                <button
                  onClick={downloadMVPPlan}
                  className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                  title="Download dynamic plan markdown file"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Download Plan</span>
                </button>
              </>
            )}
            {features.length > 0 && (
              <button
                type="button"
                onClick={exportFeatures}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                title="Export feature cards as a JSON file"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Export JSON</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
              title="Import feature cards from a JSON file"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Import JSON</span>
            </button>
            <input
              id="import-json-file"
              name="import-json-file"
              aria-label="Import board JSON file"
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={importFeatures}
              className="hidden"
            />
            {features.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/30 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Board</span>
              </button>
            )}
          </div>
        </header>
        {importError && (
          <div role="alert" className="bg-red-950/20 border border-red-900/40 p-4 rounded-xl text-red-200 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-red-400">Could not import JSON</span>
                <p className="text-xs text-slate-300">{importError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Input area */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/10 backdrop-blur-sm space-y-4">
          <div className="space-y-1">
            <label htmlFor="idea-input" className="block text-sm font-semibold tracking-wide text-slate-200 uppercase font-display">
              Describe your big app idea
            </label>
            <p className="text-xs text-slate-400">
              Paste your raw, vague brainstorm or product requirement document (PRD). Gemini will strip the fat and generate atomic features.
            </p>
          </div>

          <div className="relative">
            <textarea
              id="idea-input"
              name="idea-input"
              className="w-full h-32 md:h-36 bg-[#070a13] border border-slate-800 rounded-xl p-4 pr-20 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-sans text-sm resize-none"
              placeholder="e.g., I want to build a fitness social network where people can post their workout streaks, find gym buddies nearby with geolocation, integrate with Strava, have a full audio streaming coach inside, and generate smart training exercises using custom machine learning algorithms..."
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (!loading && !e.repeat) {
                    void handleDecompose();
                  }
                }
              }}
              disabled={loading}
            />
            {idea && (
              <button 
                onClick={() => setIdea("")}
                className="absolute right-3 top-3 text-xs text-slate-400 hover:text-white bg-slate-800/80 px-2 py-1 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {ideaHistory.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Recent ideas</span>
                <button
                  type="button"
                  onClick={() => setIdeaHistory([])}
                  className="text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Clear history
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {ideaHistory.map(previousIdea => (
                  <button
                    key={previousIdea}
                    type="button"
                    onClick={() => setIdea(previousIdea)}
                    disabled={loading}
                    title={previousIdea}
                    className="max-w-full truncate rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs text-slate-300 hover:border-cyan-500 hover:text-cyan-400 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {previousIdea}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Preset Ideas to kickstart */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-yellow-400" /> Try templates:
            </span>
            {SAMPLE_IDEAS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                className="px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition cursor-pointer"
                onClick={() => setIdea(sample.text)}
              >
                {sample.title}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Info className="w-4 h-4 text-slate-400" />
              <span>Uses Gemini 3.5 Flash for high-speed decomposition</span>
            </div>

            <button
              onClick={handleDecompose}
              disabled={loading || !idea.trim()}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer ${
                loading || !idea.trim() 
                  ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed" 
                  : "bg-cyan-500 hover:bg-cyan-600 text-black shadow-md shadow-cyan-500/15 active:scale-95"
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Decomposing & Prioritizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                  <span>Decompose Idea</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Scope creep banner */}
        {features.length > 0 && (
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 ${
            hasScopeCreep 
              ? "bg-red-950/30 border-red-900/60 text-red-200" 
              : "bg-cyan-950/25 border-cyan-900/50 text-cyan-200"
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${hasScopeCreep ? "bg-red-900/30 text-red-400" : "bg-cyan-950 text-cyan-400"}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight">
                  {hasScopeCreep ? "⚠️ Scope Creep Warning Active" : "🟢 Scope Healthy"}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  You have <strong className="text-white">{mustHaves.length}</strong> items in <strong className="text-emerald-400">Must Have (MVP)</strong>. 
                  {hasScopeCreep 
                    ? " Anything over 5 features raises your risk of project failure. Move some cards to Nice to Have or Cut It!" 
                    : " Excellent discipline! Keeping the MVP focused guarantees you can build it successfully."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800/80 text-xs shrink-0 font-mono">
              <span>MVP Count:</span>
              <span className={`font-bold ${hasScopeCreep ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}`}>
                {mustHaves.length} / 5 max
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-xl text-red-200 text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block text-red-400">Failed to Decompose App Idea</span>
                <p className="text-xs text-slate-300">{error}</p>
              </div>
            </div>
            <button
              onClick={handleDecompose}
              disabled={loading}
              className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-white rounded-lg border border-red-800 text-xs font-semibold cursor-pointer transition shrink-0 active:scale-95"
            >
              Retry Decompose
            </button>
          </div>
        )}

        {/* Help State / Empty State */}
        {features.length === 0 && !loading && (
          <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4 max-w-2xl mx-auto">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
              <HelpCircle className="w-6 h-6 text-slate-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-200">No features decomposed yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Paste your complex app idea or choose one of our templates, then click "Decompose Idea" to experience scope prioritization like a pro.
              </p>
            </div>
          </div>
        )}

        {/* Decomposing loader overlay mock if loading */}
        {loading && features.length === 0 && (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-16 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/10 border-t-cyan-500 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-indigo-500/15 border-b-indigo-400 animate-spin animate-duration-1000"></div>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-md font-semibold text-slate-200">Consulting AI Product Manager</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Deconstructing requirements, assigning developer effort levels, and writing atomic code-generation prompts. Please wait...
              </p>
            </div>
          </div>
        )}

        {features.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="board-search" className="block text-xs font-semibold text-slate-300">
                Search cards
              </label>
              <input
                id="board-search" name="board-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or description"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="board-effort" className="block text-xs font-semibold text-slate-300">
                Effort
              </label>
              <select
                id="board-effort" name="board-effort"
                value={effortFilter}
                onChange={(e) => setEffortFilter(e.target.value as EffortLevel | "All")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="All">All</option>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
              </select>
            </div>
          </div>
        )}

        {/* Column board */}
        {features.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* MUST HAVE */}
            <div 
              id="column-must"
              className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-4 min-h-[500px] transition-all"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "must")}
            >
              <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-400 font-mono">Must Have (MVP)</h2>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50 font-semibold font-mono">
                  {mustHaves.length} cards · {getEffortScore(mustHaves)} pts
                </span>
              </div>

              {/* Add feature helper inside Must Have */}
              <button
                onClick={() => setShowAddForm("must")}
                className="w-full py-2 border border-dashed border-slate-800/80 hover:border-cyan-500/40 hover:bg-cyan-500/5 rounded-xl text-xs text-slate-400 hover:text-cyan-400 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Must Have</span>
              </button>

              <div className="flex-1 space-y-5 overflow-y-auto max-h-[700px] pr-1">
                {visibleMustHaves.length === 0 ? (
                  <div className="h-40 border border-dashed border-slate-800/40 rounded-xl flex items-center justify-center text-xs text-slate-500">
                    {mustHaves.length === 0 ? "Drag items here or add a card" : "No matching cards"}
                  </div>
                ) : (
                  visibleMustHaves.map(f => renderCard(f))
                )}
              </div>
            </div>

            {/* NICE TO HAVE */}
            <div 
              id="column-nice"
              className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-4 min-h-[500px] transition-all"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "nice")}
            >
              <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                  <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-400 font-mono">Nice to Have</h2>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50 font-semibold font-mono">
                  {niceToHaves.length} cards · {getEffortScore(niceToHaves)} pts
                </span>
              </div>

              <button
                onClick={() => setShowAddForm("nice")}
                className="w-full py-2 border border-dashed border-slate-800/80 hover:border-cyan-500/40 hover:bg-cyan-500/5 rounded-xl text-xs text-slate-400 hover:text-cyan-400 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Nice-to-Have</span>
              </button>

              <div className="flex-1 space-y-5 overflow-y-auto max-h-[700px] pr-1">
                {visibleNiceToHaves.length === 0 ? (
                  <div className="h-40 border border-dashed border-slate-800/40 rounded-xl flex items-center justify-center text-xs text-slate-500">
                    {niceToHaves.length === 0 ? "Drag items here or add a card" : "No matching cards"}
                  </div>
                ) : (
                  visibleNiceToHaves.map(f => renderCard(f))
                )}
              </div>
            </div>

            {/* CUT IT */}
            <div 
              id="column-cut"
              className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-4 min-h-[500px] transition-all"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "cut")}
            >
              <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                  <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-400 font-mono">Cut It</h2>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50 font-semibold font-mono">
                  {cutIts.length} cards · {getEffortScore(cutIts)} pts
                </span>
              </div>

              <button
                onClick={() => setShowAddForm("cut")}
                className="w-full py-2 border border-dashed border-slate-800/80 hover:border-cyan-500/40 hover:bg-cyan-500/5 rounded-xl text-xs text-slate-400 hover:text-cyan-400 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Scope Cut</span>
              </button>

              <div className="flex-1 space-y-5 overflow-y-auto max-h-[700px] pr-1">
                {visibleCutIts.length === 0 ? (
                  <div className="h-40 border border-dashed border-slate-800/40 rounded-xl flex items-center justify-center text-xs text-slate-500">
                    {cutIts.length === 0 ? "Drag items here or add a card" : "No matching cards"}
                  </div>
                ) : (
                  visibleCutIts.map(f => renderCard(f))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {undoState && (
        <div
          role="status"
          className="fixed bottom-4 left-4 right-4 sm:left-auto z-[60] flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 shadow-xl"
        >
          <span>{undoState.message}</span>
          <button
            type="button"
            onClick={undoDelete}
            className="font-semibold text-cyan-400 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 rounded cursor-pointer"
          >
            Undo
          </button>
        </div>
      )}

      {/* --- ADD CARD MODAL --- */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-slate-900/80 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <span>Add custom feature to {showAddForm.toUpperCase()}</span>
              </h3>
              <button 
                onClick={() => setShowAddForm(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label htmlFor="new-card-title" className="block text-xs font-semibold text-slate-300 uppercase">Title</label>
                <input
                  id="new-card-title"
                  name="new-card-title"
                  type="text"
                  placeholder="e.g., Google Maps Store Finder"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="new-card-description" className="block text-xs font-semibold text-slate-300 uppercase">One-Line Description</label>
                <input
                  id="new-card-description"
                  name="new-card-description"
                  type="text"
                  placeholder="Allows searchers to browse stores on Google Map viewport"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="new-card-effort" className="block text-xs font-semibold text-slate-300 uppercase">Effort Level</label>
                  <select
                    id="new-card-effort"
                    name="new-card-effort"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                    value={newEffort}
                    onChange={(e) => setNewEffort(e.target.value as EffortLevel)}
                  >
                    <option value="Small">Small Effort</option>
                    <option value="Medium">Medium Effort</option>
                    <option value="Large">Large Effort</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label htmlFor="new-card-prompt" className="block text-xs font-semibold text-slate-300 uppercase">AI Builder Prompt (Optional)</label>
                  <span className="text-[10px] text-slate-500">Auto-generated if left empty</span>
                </div>
                <textarea
                  id="new-card-prompt"
                  name="new-card-prompt"
                  placeholder="Specify exact tech stack, API requirements, visual styling instruction, or data structures for the AI builder..."
                  className="w-full h-24 bg-slate-950 border border-slate-850 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-slate-900/60 px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setShowAddForm(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => addCustomCard(showAddForm)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-black transition"
              >
                Create Feature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT CARD MODAL --- */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-slate-900/80 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <span>Edit Feature Card</span>
              </h3>
              <button 
                onClick={() => setEditingCard(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label htmlFor="edit-card-title" className="block text-xs font-semibold text-slate-300 uppercase">Title</label>
                <input
                  id="edit-card-title"
                  name="edit-card-title"
                  type="text"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  value={editingCard.title}
                  onChange={(e) => setEditingCard({ ...editingCard, title: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-card-description" className="block text-xs font-semibold text-slate-300 uppercase">One-Line Description</label>
                <input
                  id="edit-card-description"
                  name="edit-card-description"
                  type="text"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  value={editingCard.description}
                  onChange={(e) => setEditingCard({ ...editingCard, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="edit-card-effort" className="block text-xs font-semibold text-slate-300 uppercase">Effort Level</label>
                  <select
                    id="edit-card-effort"
                    name="edit-card-effort"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                    value={editingCard.effort}
                    onChange={(e) => setEditingCard({ ...editingCard, effort: e.target.value as EffortLevel })}
                  >
                    <option value="Small">Small Effort</option>
                    <option value="Medium">Medium Effort</option>
                    <option value="Large">Large Effort</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="edit-card-category" className="block text-xs font-semibold text-slate-300 uppercase">Category</label>
                  <select
                    id="edit-card-category"
                    name="edit-card-category"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                    value={editingCard.category}
                    onChange={(e) => setEditingCard({ ...editingCard, category: e.target.value as FeatureCategory })}
                  >
                    <option value="must">Must Have</option>
                    <option value="nice">Nice to Have</option>
                    <option value="cut">Cut It</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-card-prompt" className="block text-xs font-semibold text-slate-300 uppercase">AI Developer Prompt</label>
                <textarea
                  id="edit-card-prompt"
                  name="edit-card-prompt"
                  className="w-full h-36 bg-slate-950 border border-slate-850 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono resize-none"
                  value={editingCard.prompt}
                  onChange={(e) => setEditingCard({ ...editingCard, prompt: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-slate-900/60 px-6 py-4 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={() => {
                  deleteCard(editingCard.id);
                  setEditingCard(null);
                }}
                className="text-xs text-red-400 hover:text-red-300 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete card</span>
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={updateCard}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-black transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderCard(f: FeatureCard) {
    const isCopied = copiedId === f.id;

    // Effort colors
    const effortColors: Record<EffortLevel, { bg: string, text: string, border: string, leftBorder: string }> = {
      Small: { bg: "bg-emerald-950/40", text: "text-emerald-400", border: "border-emerald-900/40", leftBorder: "border-l-emerald-500" },
      Medium: { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-900/40", leftBorder: "border-l-amber-500" },
      Large: { bg: "bg-rose-950/40", text: "text-rose-400", border: "border-rose-900/40", leftBorder: "border-l-rose-500" }
    };

    const color = effortColors[f.effort] || effortColors.Medium;

    return (
      <div
        key={f.id}
        draggable
        onDragStart={(e) => handleDragStart(e, f.id)}
        className={`group relative bg-slate-900 border border-slate-800/80 ${color.leftBorder} border-l-4 rounded-xl p-4 space-y-3 shadow-lg hover:border-slate-750 transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-black/20`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-sm tracking-tight text-white group-hover:text-cyan-400 transition">
            {f.title}
          </h4>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${color.bg} ${color.text} ${color.border} shrink-0`}>
            {f.effort}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
          {f.description}
        </p>

        {/* AI Prompt copy actions */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
          {/* Action button to copy AI prompt */}
          <button
            onClick={() => handleCopyPrompt(f.id, f.prompt)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex-1 justify-center cursor-pointer ${
              isCopied 
                ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800" 
                : "bg-[#070a13] text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
            }`}
            title="Copy a highly detailed build prompt for this feature to paste into an AI builder"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied Prompt!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>Copy Prompt</span>
              </>
            )}
          </button>

          {/* Quick Edit */}
          <button
            onClick={() => setEditingCard({ ...f })}
            className="p-1.5 rounded-lg bg-[#070a13] border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer text-xs"
            title="Edit feature details"
          >
            Edit
          </button>
        </div>

        {/* Manual Column-Changer Quick Buttons for Mobile/Iframe Accessibility */}
        <div className="flex justify-between items-center pt-1.5 text-slate-500 text-[10px]">
          <span className="opacity-0 group-hover:opacity-100 transition text-[9px] text-slate-400 font-medium">
            Drag card or move:
          </span>
          <div className="flex items-center gap-1 ml-auto">
            {f.category !== "must" && (
              <button
                onClick={() => moveCard(f.id, 'left')}
                className="p-1 rounded bg-slate-800/40 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
                title="Move Left"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
            )}
            {f.category !== "cut" && (
              <button
                onClick={() => moveCard(f.id, 'right')}
                className="p-1 rounded bg-slate-800/40 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
                title="Move Right"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
