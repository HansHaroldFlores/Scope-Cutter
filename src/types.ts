export type EffortLevel = "Small" | "Medium" | "Large";
export type FeatureCategory = "must" | "nice" | "cut";

export interface FeatureCard {
  id: string;
  title: string;
  description: string;
  effort: EffortLevel;
  category: FeatureCategory;
  prompt: string;
}

export interface DecomposeResponse {
  features: FeatureCard[];
}
