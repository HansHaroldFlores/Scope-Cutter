import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini SDK to prevent crash if key is missing on startup
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "your_actual_api_key") {
      throw new Error("GEMINI_API_KEY is not configured or still has the placeholder value. Set GEMINI_API_KEY in the project's .env file and restart the server.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Decompose endpoint
app.post("/api/decompose", async (req, res) => {
  const { idea } = req.body;
  if (!idea || typeof idea !== "string" || !idea.trim()) {
    return res.status(400).json({ error: "Please provide a valid app idea." });
  }

  const normalizedIdea = idea.toLowerCase();
  
  // Heuristic-based dynamic fallback generator in case Gemini is unavailable or rate-limited
  const getFallbackFeatures = (userInput: string) => {
    console.log("[Scope Cutter Fallback] Creating dynamic smart features for:", userInput);
    
    const isSocial = normalizedIdea.includes("social") || normalizedIdea.includes("network") || normalizedIdea.includes("buddy") || normalizedIdea.includes("friend") || normalizedIdea.includes("pet") || normalizedIdea.includes("chat");
    const isMap = normalizedIdea.includes("map") || normalizedIdea.includes("location") || normalizedIdea.includes("geo") || normalizedIdea.includes("nearby") || normalizedIdea.includes("gps") || normalizedIdea.includes("travel");
    const isAI = normalizedIdea.includes("ai") || normalizedIdea.includes("gemini") || normalizedIdea.includes("generator") || normalizedIdea.includes("automatic") || normalizedIdea.includes("smart") || normalizedIdea.includes("learning");
    const isFitness = normalizedIdea.includes("fitness") || normalizedIdea.includes("workout") || normalizedIdea.includes("streak") || normalizedIdea.includes("run") || normalizedIdea.includes("gym") || normalizedIdea.includes("health");
    const isFinance = normalizedIdea.includes("finance") || normalizedIdea.includes("budget") || normalizedIdea.includes("money") || normalizedIdea.includes("crm") || normalizedIdea.includes("analytics") || normalizedIdea.includes("chart") || normalizedIdea.includes("csv");

    let featuresList = [];

    if (isFitness) {
      featuresList = [
        {
          id: "fit-1",
          title: "Simple Activity Logger",
          description: "Local storage based manual tracker for workouts, repetitions, and durations.",
          effort: "Small",
          category: "must",
          prompt: "Build an interactive manual workout logger with simple form fields for exercise name, duration, and sets/reps. Persist the entries securely to local state and localStorage. Style with high-contrast active items."
        },
        {
          id: "fit-2",
          title: "Streak Counter Tracker",
          description: "Calculates consecutive days logged and displays a responsive visual badge/calendar.",
          effort: "Small",
          category: "must",
          prompt: "Build a persistent streak tracker that calculates daily usage streak based on workout logs. Render a flame icon with scale animations and a minimalist month-view grid showing completed days."
        },
        {
          id: "fit-3",
          title: "Social Buddy Matcher",
          description: "Minimal matching screen to view pet/gym buddies filtered by workout interests.",
          effort: "Medium",
          category: "nice",
          prompt: "Create a list-based discovery component showing dummy profiles of gym/pet partners. Filter by availability and exercise tags with a simple 'Say Hello' direct message popup."
        },
        {
          id: "fit-4",
          title: "Strava API Integration",
          description: "Third-party login and automated exercise activity synchronizer.",
          effort: "Large",
          category: "nice",
          prompt: "Implement an Express API endpoint proxy to handle OAuth2 authorization flow with Strava. Upon success, fetch workouts and sync with local storage logs."
        },
        {
          id: "fit-5",
          title: "AI Audio Voice Coach",
          description: "Real-time speech feedback and synthetic voice advice during active timers.",
          effort: "Large",
          category: "cut",
          prompt: "Create an audio synthesis assistant using Web Speech API synthesis that speaks countdown triggers, encouragement, and form reminders during workouts."
        },
        {
          id: "fit-6",
          title: "Wearable Hardware Integration",
          description: "Direct Bluetooth connection to gather live heart-rate and pulse stats.",
          effort: "Large",
          category: "cut",
          prompt: "Implement a Web Bluetooth API manager to discover and connect with standard BLE heart-rate monitors, decoding raw stream packets on a live responsive chart."
        }
      ];
    } else if (isFinance || isSocial || isMap || isAI) {
      // General hybrid rich template customized with words from user input
      const mainSubject = isFinance ? "Transaction Ledger" : isSocial ? "Public Micro-Feed" : isMap ? "Interactive Vector Map" : "AI Smart Generator";
      const secondSubject = isFinance ? "Visual Budget Charts" : isSocial ? "Simple Comments & Hearts" : isMap ? "Search & Filter Locations" : "Prompt Playground Dashboard";

      featuresList = [
        {
          id: "gen-1",
          title: `${mainSubject}`,
          description: `The core view to list and manage basic ${isFinance ? "expense records" : isSocial ? "user posts" : isMap ? "saved venues" : "generated content"}.`,
          effort: "Medium",
          category: "must",
          prompt: `Build a beautiful single-page component displaying a listing of ${isFinance ? "expenses" : isSocial ? "posts" : isMap ? "locations" : "prompts"}. Include standard actions to add, edit, and delete items from local state. Include smooth list sorting.`
        },
        {
          id: "gen-2",
          title: `${secondSubject}`,
          description: `Visual indicators, filter pills, or secondary widgets to enrich user exploration.`,
          effort: "Small",
          category: "must",
          prompt: `Implement clean responsive filter chips at the top of the interface. Style search filtering and custom tags using a single accent color and nice transitions.`
        },
        {
          id: "gen-3",
          title: "Detailed Activity Analytics",
          description: "Data-heavy dashboard with charts displaying status metrics over time.",
          effort: "Medium",
          category: "nice",
          prompt: "Build an interactive charts page using Recharts library. Render beautiful, high-contrast area charts showing usage statistics and metrics with custom tooltips."
        },
        {
          id: "gen-4",
          title: "Real-time Workspace Sync",
          description: "Syncs state across open tabs and multiple browsers seamlessly.",
          effort: "Large",
          category: "nice",
          prompt: "Integrate a real-time state synchronization tool using BroadcastChannel or simple socket connections to notify open browser tabs when data updates."
        },
        {
          id: "gen-5",
          title: "Enterprise Multi-tenant SAML SSO",
          description: "Full suite authorization with Okta, Azure AD, and hardware keys.",
          effort: "Large",
          category: "cut",
          prompt: "Implement complete server-side passport authentication strategy with SAML v2 configurations, token signature verification, and fallback sessions."
        },
        {
          id: "gen-6",
          title: "Native Mobile App Wrapper Shell",
          description: "Compilation shell to bundle the React code into true binary stores.",
          effort: "Large",
          category: "cut",
          prompt: "Configure a capacitor.config.json and native splash configurations to build native iOS Xcode and Android Gradle wrappers."
        }
      ];
    } else {
      // General SaaS App Default Fallback
      featuresList = [
        {
          id: "def-1",
          title: "Core Schema & Storage State",
          description: "Main client state engine handling item additions, status toggles, and offline storage.",
          effort: "Small",
          category: "must",
          prompt: "Build a robust React state controller with support for standard actions (add, remove, filter) backed by a localStorage synchronizer hook. Design high-contrast responsive layouts."
        },
        {
          id: "def-2",
          title: "Interactive Search & Category Filters",
          description: "Instantly filter long lists by keyword search and active categories.",
          effort: "Small",
          category: "must",
          prompt: "Create a search filter component with clean empty states, debounced lookup, and clear active tag badges. Style using minimalist borders."
        },
        {
          id: "def-3",
          title: "CSV Import/Export System",
          description: "Enables backup and bulk upload of raw client-managed spreadsheets.",
          effort: "Medium",
          category: "nice",
          prompt: "Implement a client-side CSV parser that processes plain files into typed JSON records, adding a warning check if columns are formatted incorrectly."
        },
        {
          id: "def-4",
          title: "In-App Achievement Streak Badges",
          description: "Triggers confetti animations and unlocks motivational milestones.",
          effort: "Small",
          category: "nice",
          prompt: "Implement a lightweight milestone tracker that fires a canvas confetti animation when specific item counts or streaks are reached."
        },
        {
          id: "def-5",
          title: "Machine Learning Automation",
          description: "Custom auto-classification algorithms running live on the device.",
          effort: "Large",
          category: "cut",
          prompt: "Build a local classification pipeline using client-side tensorflow.js modeling to automatically categorize entries based on keyword text clusters."
        },
        {
          id: "def-6",
          title: "Enterprise Biometric 2FA Security",
          description: "Hardware key authentication using WebAuthn or touch biometric readers.",
          effort: "Large",
          category: "cut",
          prompt: "Configure a multi-factor authorization gateway relying on navigator.credentials to register and verify physical FIDO2 keys and TouchID prompts."
        }
      ];
    }

    return { features: featuresList };
  };

  try {
    let ai;
    try {
      ai = getGeminiClient();
    } catch (e: any) {
      console.warn("[Scope Cutter Server] Gemini client init failed, using heuristic fallback.", e.message);
      return res.json(getFallbackFeatures(idea));
    }

    const systemInstruction = `You are Scope Cutter, an elite, highly pragmatic digital product manager and software architect.
Your mission is to save users from "AI slop" and massive, over-engineered project scopes.
When a user describes their vague or large app idea, you aggressively decompose it into exactly 6 to 9 modular, clean, buildable features.
You MUST categorize these features into exactly three groups:
1. "must" (Must Have MVP): The absolute bare minimum to deliver the core value. Keep this to 3-4 features.
2. "nice" (Nice to Have): Desirable enhancements that are out of scope for the immediate first release.
3. "cut" (Cut It): Proactive scope cutting. Identify features that are usually unneeded, over-complicated, or risky for a fast initial build (e.g., enterprise authentication, VR support, heavy real-time video streaming, native app ports, custom trained AI models, custom blockchain integration).

For every single feature, you must write a highly detailed, self-contained AI developer prompt ('prompt').
The 'prompt' must be a direct instruction that a developer can copy and paste into an AI coder to build JUST that single feature, assuming a modern React + Tailwind setup. It should be rich in technical detail for that module.

CRITICAL: Return RAW JSON only. Do NOT include any explanations, introduction, markdown blocks, backticks, or code fences like \`\`\`json. Just raw, parsable JSON matching the schema.`;

    const contents = `Decompose the following app idea: "${idea.trim()}"`;

    // Primary model first; the lite model is a backup when the primary is overloaded
    const models = ["gemini-3.5-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
    let parsedData = null;

    for (let i = 0; i < models.length; i++) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000 * i));
      try {
        const response = await ai.models.generateContent({
          model: models[i],
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                features: {
                  type: Type.ARRAY,
                  description: "The list of decomposed features.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING, description: "A unique short alphanumeric ID (e.g., 'feat-1')." },
                      title: { type: Type.STRING, description: "Crisp feature title (2-4 words)." },
                      description: { type: Type.STRING, description: "A clear one-line description of the feature." },
                      effort: { type: Type.STRING, enum: ["Small", "Medium", "Large"], description: "Estimated effort: Must be exactly 'Small', 'Medium', or 'Large'." },
                      category: { type: Type.STRING, enum: ["must", "nice", "cut"], description: "Must be exactly 'must', 'nice', or 'cut'." },
                      prompt: { type: Type.STRING, description: "A self-contained, descriptive build prompt for this feature." }
                    },
                    required: ["id", "title", "description", "effort", "category", "prompt"]
                  }
                }
              },
              required: ["features"]
            }
          }
        });

        const text = response.text;
        if (process.env.DEBUG_GEMINI) {
          console.log("=== RAW GEMINI MODEL RESPONSE ===");
          console.log(text);
          console.log("=================================");
        }

        if (!text) {
          throw new Error("No response text received from Gemini.");
        }

        // Clean any stray backticks or markdown fences
        let cleaned = text.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/i, "");
        }
        if (cleaned.endsWith("```")) {
          cleaned = cleaned.replace(/\n?```$/, "");
        }
        cleaned = cleaned.trim();

        parsedData = JSON.parse(cleaned);
        if (parsedData && Array.isArray(parsedData.features)) {
          break; // Success!
        } else {
          throw new Error("Response JSON did not contain 'features' array.");
        }
      } catch (err: any) {
        const status = Number(err.status ?? err.code ?? err.response?.status);
        if ([400, 401, 403].includes(status) || err.message?.includes("API_KEY_INVALID")) {
          console.warn("[Scope Cutter Server] Gemini rejected the API key. Set GEMINI_API_KEY in .env and restart the server. Using heuristic fallback.");
          return res.json(getFallbackFeatures(idea));
        }
        console.warn(`[Scope Cutter Server] ${models[i]} attempt ${i + 1} failed${Number.isFinite(status) ? ` (${status})` : ""}: ${(String(err.message ?? err).match(/"message":"([^"]+)"/)?.[1] ?? String(err.message ?? err)).slice(0, 120)}`);
      }
    }

    if (!parsedData) {
      console.warn("[Scope Cutter Server] Gemini failed or overloaded. Falling back to rule-based fallback generation.");
      return res.json(getFallbackFeatures(idea));
    }

    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini decomposition error, using offline fallback:", error);
    try {
      return res.json(getFallbackFeatures(idea));
    } catch (fallbackError) {
      res.status(500).json({
        error: error.message || "An unexpected error occurred while decomposing the app idea."
      });
    }
  }
});

// Setup Vite Dev server or production static serving
async function initializeApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Scope Cutter] Server running on http://localhost:${PORT}`);
  });
}

initializeApp().catch((err) => {
  console.error("Failed to start application server:", err);
});
