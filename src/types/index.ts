export type ThemeMode = 'dark' | 'light' | 'system';

export type AIProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'openrouter'
  | 'perplexity'
  | 'local'
  | 'custom';

export interface AIProviderInfo {
  id: AIProviderId;
  name: string;
  tagline: string;
  badge: string;
  color: string;
  defaultBaseUrl?: string;
  keyHelpUrl: string;
  placeholderKey: string;
  keyPrefix?: string;
  hasDefaultKeyInEnv?: boolean;
}

export type CapabilityType =
  | 'reasoning'
  | 'webSearch'
  | 'codeExecution'
  | 'vision'
  | 'tts'
  | 'jsonMode'
  | 'fastSpeed'
  | 'imageGeneration';

export type ApiPlanTier = 'free' | 'tier1' | 'pro' | 'enterprise';

export interface PlanTierInfo {
  id: ApiPlanTier;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  color: string;
}

export type LocalRuntimeMode = 'webgpu' | 'ollama' | 'lmstudio' | 'llamacpp';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderId;
  description: string;
  contextWindow: string;
  capabilities: CapabilityType[];
  recommended?: boolean;
  isPaid?: boolean;
  minPlanTier?: ApiPlanTier;
  supportedPlans?: ApiPlanTier[];
  isAccountVerified?: boolean;
  inputTokens?: number;
  speed: 'Ultra-Fast' | 'Fast' | 'Balanced' | 'Deep-Reasoning';
  intelligenceLevel: 'Maximum' | 'Very High' | 'High' | 'Standard';
  localRuntime?: LocalRuntimeMode;
  sizeLabel?: string;
  vramRequiredMB?: number;
  createdAt?: number;
  isLiveSynced?: boolean;
}

export interface VoiceConfig {
  voiceURI: string;
  voiceName: string;
  lang: string;
  rate: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 1.5
  volume: number; // 0.0 to 1.0
  autoMatchLanguage?: boolean; // Use native voice matching text language to avoid speaking other languages in an accent
  respondInVoiceLanguage?: boolean; // Instruct AI to reply in the voice's language so speech is naturally native
  nativeSampleText?: string;
}

export interface ModelCapabilitiesConfig {
  webSearch: boolean;
  reasoning: boolean;
  thinkingLevel: 'minimal' | 'low' | 'high';
  codeExecution: boolean;
  visionEnabled: boolean;
  ttsEnabled: boolean;
  temperature: number;
  topP: number;
  maxTokens: number;
  stream: boolean;
  systemPrompt: string;
  systemPreset: 'default' | 'developer' | 'researcher' | 'creative' | 'concise' | 'custom';
  memoryDepth: number; // 0 = unlimited
  secretPrompt?: string;
  secretPromptEnabled?: boolean;
  voiceConfig?: VoiceConfig;
  systemDateMode?: 'current' | 'custom';
  customSystemDate?: string;
  systemDate?: string;
}

export interface ChatAttachment {
  id: string;
  type: 'image' | 'text' | 'file';
  name: string;
  mimeType: string;
  dataUrl?: string; // base64 data url
  textPreview?: string;
  textContent?: string;
  size?: number;
}

export interface MessageEvaluationResult {
  evaluatedAt: number;
  engine: 'ragas-builtin' | 'ragas-external' | 'langsmith' | 'custom-webhook';
  scores: {
    faithfulness: number; // 0.0 - 1.0 (Ratio of factual claims in answer supported by context)
    answerRelevancy: number; // 0.0 - 1.0 (Pertinence and direct responsiveness to question)
    contextPrecision: number; // 0.0 - 1.0 (Signal-to-noise ratio of retrieved contexts)
    contextRecall?: number; // 0.0 - 1.0 (Ground truth statements attributed to context)
    answerCorrectness?: number; // 0.0 - 1.0 (Factual and semantic similarity to reference truth)
    hallucinationRisk: number; // 0.0 - 1.0 (Complement of faithfulness)
    conciseness?: number; // 0.0 - 1.0
  };
  overallScore: number; // 0 - 100
  verdict: 'Excellent' | 'Good' | 'Needs Improvement' | 'High Risk';
  critique: string;
  claimsAnalysis?: {
    totalClaims: number;
    supportedClaims: string[];
    unsupportedClaims: string[];
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string; // Step-by-step reasoning trace
  sources?: Array<{ title: string; url: string }>;
  timestamp: number;
  modelUsed?: string;
  providerUsed?: AIProviderId;
  tokensEstimated?: number;
  durationMs?: number;
  attachments?: ChatAttachment[];
  isStreaming?: boolean;
  localLoadProgress?: {
    progress: number; // 0 to 1
    text: string;
    runtime: LocalRuntimeMode;
  };
  error?: string;
  isRateLimit?: boolean;
  evaluation?: MessageEvaluationResult;
  generatedImage?: {
    url: string;
    prompt: string;
    aspectRatio?: string;
    modelUsed?: string;
    durationMs?: number;
  };
}

export interface RagasTestCase {
  id: string;
  question: string;
  contexts?: string[];
  groundTruth?: string;
  actualAnswer?: string;
  lastEvaluatedAt?: number;
  evaluation?: MessageEvaluationResult;
  status?: 'pending' | 'evaluating' | 'passed' | 'failed';
}

export interface RagasBenchmarkReport {
  id: string;
  title: string;
  createdAt: number;
  modelEvaluated: string;
  totalCases: number;
  passedCases: number;
  avgFaithfulness: number;
  avgAnswerRelevancy: number;
  avgContextPrecision: number;
  avgContextRecall?: number;
  avgAnswerCorrectness?: number;
  avgHallucinationRisk: number;
  overallQualityScore: number;
  verdict: 'Excellent' | 'Good' | 'Needs Improvement' | 'High Risk';
  items: Array<{
    id: string;
    question: string;
    answer: string;
    groundTruth?: string;
    scores: {
      faithfulness: number;
      answerRelevancy: number;
      contextPrecision: number;
      contextRecall?: number;
      answerCorrectness?: number;
      hallucinationRisk: number;
    };
    verdict: string;
    critique: string;
  }>;
}

export interface ExternalSoftwareConfig {
  activeSoftware: 'render_backend' | 'ragas' | 'langsmith' | 'langfuse' | 'traceloop' | 'custom_webhook';
  enabled: boolean;
  endpointUrl: string;
  apiKey?: string;
  autoEvaluateOnMessage: boolean;
  exportFormat: 'ragas_dataset' | 'ragas_python' | 'openai_finetune' | 'sharegpt' | 'huggingface' | 'standard_json' | 'alpaca' | 'dpo_pairs';
  webhookDestinationUrl?: string;
  webhookAuthHeader?: string;
  evalMetrics: {
    faithfulness: boolean;
    answerRelevancy: boolean;
    contextPrecision: boolean;
    contextRecall: boolean;
    answerCorrectness: boolean;
    hallucinationDetection: boolean;
    conciseness: boolean;
  };
  thresholds?: {
    minFaithfulness: number;
    minAnswerRelevancy: number;
    maxHallucinationRisk: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  provider: AIProviderId;
  model: string;
  messages: ChatMessage[];
  capabilities: ModelCapabilitiesConfig;
  secretPrompt?: string;
  secretPromptEnabled?: boolean;
}

export interface StoredAPIKeys {
  gemini?: string;
  openai?: string;
  anthropic?: string;
  groq?: string;
  deepseek?: string;
  mistral?: string;
  openrouter?: string;
  perplexity?: string;
  local?: string;
  localRuntimeMode?: LocalRuntimeMode;
  localEndpointUrl?: string;
  custom?: string;
  customBaseUrl?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  authProvider?: 'google' | 'email' | 'guest';
  googleId?: string;
  isGoogleVerified?: boolean;
  createdAt: number;
  lastLoginAt: number;
  apiKeys: StoredAPIKeys;
  savedModels?: Record<string, string>;
  isDefault?: boolean;
}
