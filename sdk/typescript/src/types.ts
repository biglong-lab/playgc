// 📘 CHITO API v1 — TypeScript types
// 對應 OpenAPI 3.1 spec：https://game.homi.cc/api/v1/openapi.json

export type ScenarioCategory = "social" | "event" | "public" | "corporate" | "venue";
export type ScenarioStatus = "live" | "preview" | "planned";
export type ComponentAxis = "host" | "multi" | "solo" | "shared";

export interface ScenarioListItem {
  id: string;
  name: string;
  tagline: string;
  category: ScenarioCategory;
  icon: string;
  estimatedPlayers: string;
  estimatedDuration: string;
  status: ScenarioStatus;
  componentCount: number;
  axes: ComponentAxis[];
  valueProposition: string;
}

export interface ScenarioComponent {
  pageType: string;
  label: string;
  role: string;
  axis: ComponentAxis;
}

export interface Scenario {
  object: "scenario";
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: ScenarioCategory;
  icon: string;
  gradient: string;
  estimatedPlayers: string;
  estimatedDuration: string;
  useCases: string[];
  components: ScenarioComponent[];
  valueProposition: string;
  status: ScenarioStatus;
}

export interface InstanceComponent {
  axis: ComponentAxis;
  gameId: string;
  pageType: string;
  label: string;
  hostUrl?: string;
  playUrl?: string;
  gameUrl?: string;
}

export interface Instance {
  object: "instance";
  scenario: { id: string; name: string };
  displayName: string;
  customerEmail: string | null;
  expiresAt: string;
  totalCreated: number;
  breakdown: { host: number; multi: number; other: number };
  components: InstanceComponent[];
  createdBy: string;
}

export interface ApiKeyMetadata {
  object: "api_key_metadata";
  keyId: string;
  label: string;
  isTest: boolean;
  fieldId: string | null;
  quota: number | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    documentation_url?: string;
  };
}
