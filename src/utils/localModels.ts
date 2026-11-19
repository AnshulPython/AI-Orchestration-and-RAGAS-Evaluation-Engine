/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CreateMLCEngine,
  CreateWebWorkerMLCEngine,
  hasModelInCache,
  deleteModelAllInfoInCache,
  prebuiltAppConfig,
  type MLCEngineInterface,
  type InitProgressReport,
} from '@mlc-ai/web-llm';
import type {
  AIModel,
  ChatMessage,
  LocalRuntimeMode,
  ModelCapabilitiesConfig,
} from '../types';

export interface WebGPUStatus {
  supported: boolean;
  adapterLabel?: string;
  hasF16?: boolean;
  reason?: string;
}

let cachedEngine: MLCEngineInterface | null = null;
let loadedModelId: string | null = null;
let loadingPromise: Promise<MLCEngineInterface> | null = null;

export function getLoadedWebLLMModelId(): string | null {
  return loadedModelId;
}

export async function checkWebGPUSupport(): Promise<WebGPUStatus> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator) || !(navigator as any).gpu) {
    return {
      supported: false,
      reason: 'WebGPU is not supported in this browser. Use Chrome 113+, Edge 113+, or switch to Ollama / LM Studio mode.',
    };
  }
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        reason: 'No compatible WebGPU hardware GPU adapter was found. You can still connect a local Ollama or LM Studio server.',
      };
    }
    const info = adapter.info || (await adapter.requestAdapterInfo?.().catch(() => null)) || {};
    const parts = [info.vendor, info.architecture, info.description || info.device].filter(Boolean);
    const hasF16 = Boolean(adapter.features?.has?.('shader-f16'));
    return {
      supported: true,
      adapterLabel: parts.length > 0 ? parts.join(' • ') : 'WebGPU Hardware Adapter',
      hasF16,
    };
  } catch (err: any) {
    return {
      supported: false,
      reason: err?.message || 'Failed to initialize WebGPU adapter.',
    };
  }
}

export function isWebLLMModelId(modelId: string): boolean {
  if (modelId.endsWith('-MLC')) return true;
  return prebuiltAppConfig.model_list.some((m) => m.model_id === modelId);
}

/**
 * Dynamically builds an up-to-date WebGPU local model catalog directly from
 * @mlc-ai/web-llm's prebuiltAppConfig.model_list, preserving curated descriptions
 * and surfacing any newer models bundled in the WebLLM registry.
 */
export function getUpToDateWebGPUModels(curatedWebGPUModels: AIModel[]): AIModel[] {
  const curatedMap = new Map<string, AIModel>(
    curatedWebGPUModels.map((m) => [m.id, { ...m, isLiveSynced: true }])
  );
  const prebuiltIds = new Set(prebuiltAppConfig.model_list.map((m) => m.model_id));

  // Keep curated models that actually exist in the current prebuilt registry (or fallback if empty)
  const merged: AIModel[] = [];
  for (const cur of curatedWebGPUModels) {
    if (prebuiltIds.size === 0 || prebuiltIds.has(cur.id)) {
      const prebuiltMatch = prebuiltAppConfig.model_list.find((p) => p.model_id === cur.id);
      merged.push({
        ...cur,
        vramRequiredMB: prebuiltMatch?.vram_required_MB ?? cur.vramRequiredMB,
        isLiveSynced: true,
      });
    }
  }

  // Dynamically discover additional up-to-date chat models from prebuiltAppConfig
  // Prefer q4f16_1 quantizations and skip embedding / legacy / tiny context variants
  const seenFamilies = new Set(
    merged.map((m) => m.id.replace(/-q\d+f\d+_\d+-MLC.*$/, '').toLowerCase())
  );

  const preferredPrefixes = [
    'Qwen3-',
    'Qwen2.5-',
    'gemma-4',
    'gemma3-',
    'gemma-3',
    'Phi-4',
    'Llama-3.3',
    'Llama-3.2',
    'DeepSeek-R1',
    'SmolLM2-',
    'Mistral-',
  ];

  const extraCandidates = prebuiltAppConfig.model_list.filter((entry) => {
    const id = entry.model_id;
    if (!id.includes('-q4f16_1-MLC')) return false;
    if (id.includes('-1k') || id.includes('embed') || id.includes('RedPajama') || id.includes('WizardMath')) {
      return false;
    }
    if (curatedMap.has(id)) return false;
    const familyKey = id.replace(/-q\d+f\d+_\d+-MLC.*$/, '').toLowerCase();
    if (seenFamilies.has(familyKey)) return false;
    return preferredPrefixes.some((prefix) => id.startsWith(prefix));
  });

  for (const entry of extraCandidates.slice(0, 14)) {
    const id = entry.model_id;
    const familyKey = id.replace(/-q\d+f\d+_\d+-MLC.*$/, '').toLowerCase();
    seenFamilies.add(familyKey);

    const ctx = entry.overrides?.context_window_size;
    const vramMB = entry.vram_required_MB || 2000;
    const isReasoning =
      id.includes('R1') ||
      id.includes('Qwen3') ||
      id.includes('Phi-4') ||
      id.includes('gemma-4');
    const cleanName = id
      .replace(/-q\d+f\d+_\d+-MLC.*$/, '')
      .replace(/-/g, ' ');

    merged.push({
      id,
      name: `${cleanName} (WebGPU)`,
      provider: 'local',
      description: `Live WebLLM registry model running 100% locally in your browser via WebGPU (~${(vramMB / 1000).toFixed(1)} GB VRAM).`,
      contextWindow: ctx ? `${Math.round(ctx / 1024)}k tokens` : '32k tokens',
      capabilities: isReasoning ? ['reasoning', 'codeExecution'] : ['fastSpeed', 'codeExecution'],
      minPlanTier: 'free',
      supportedPlans: ['free', 'tier1', 'pro', 'enterprise'],
      speed: vramMB < 1800 ? 'Ultra-Fast' : vramMB < 3200 ? 'Fast' : 'Balanced',
      intelligenceLevel: vramMB >= 3500 ? 'Maximum' : 'Very High',
      localRuntime: 'webgpu',
      sizeLabel: `~${(vramMB / 1000).toFixed(1)} GB VRAM`,
      vramRequiredMB: vramMB,
      isLiveSynced: true,
    });
  }

  return merged;
}

export async function getCachedWebLLMModels(modelIds: string[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  await Promise.all(
    modelIds.map(async (id) => {
      try {
        result[id] = await hasModelInCache(id, prebuiltAppConfig);
      } catch {
        result[id] = false;
      }
    })
  );
  return result;
}

export async function clearCachedWebLLMModel(modelId: string): Promise<void> {
  if (loadedModelId === modelId && cachedEngine) {
    try {
      await cachedEngine.unload();
    } catch {}
    cachedEngine = null;
    loadedModelId = null;
  }
  await deleteModelAllInfoInCache(modelId, prebuiltAppConfig);
}

export async function ensureWebLLMEngine(
  modelId: string,
  onProgress?: (report: InitProgressReport) => void
): Promise<MLCEngineInterface> {
  if (cachedEngine && loadedModelId === modelId) {
    return cachedEngine;
  }

  if (loadingPromise) {
    await loadingPromise.catch(() => {});
    if (cachedEngine && loadedModelId === modelId) {
      return cachedEngine;
    }
  }

  const initTask = (async () => {
    if (cachedEngine) {
      try {
        await cachedEngine.unload();
      } catch {}
      cachedEngine = null;
      loadedModelId = null;
    }

    const gpuStatus = await checkWebGPUSupport();
    if (!gpuStatus.supported) {
      throw new Error(
        gpuStatus.reason ||
          'WebGPU is unavailable in this browser. Switch Local Runtime to Ollama / LM Studio in API Keys settings.'
      );
    }

    const initProgressCallback = (report: InitProgressReport) => {
      onProgress?.(report);
    };

    let engine: MLCEngineInterface;
    try {
      const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), {
        type: 'module',
      });
      engine = await CreateWebWorkerMLCEngine(worker, modelId, {
        appConfig: prebuiltAppConfig,
        initProgressCallback,
      });
    } catch (workerErr) {
      console.warn('[Local WebLLM] Worker init failed, falling back to main-thread engine:', workerErr);
      engine = await CreateMLCEngine(modelId, {
        appConfig: prebuiltAppConfig,
        initProgressCallback,
      });
    }

    cachedEngine = engine;
    loadedModelId = modelId;
    return engine;
  })();

  loadingPromise = initTask;
  try {
    return await initTask;
  } finally {
    loadingPromise = null;
  }
}

export function interruptWebLLMGeneration(): void {
  try {
    cachedEngine?.interruptGenerate();
  } catch {}
}

function buildSystemDateInstruction(capabilities: ModelCapabilitiesConfig): string {
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let resolvedSystemDate = localToday;
  if (capabilities?.systemDateMode === 'custom' && capabilities?.customSystemDate) {
    resolvedSystemDate = String(capabilities.customSystemDate).trim();
  } else if (capabilities?.customSystemDate && capabilities?.systemDateMode !== 'current') {
    resolvedSystemDate = String(capabilities.customSystemDate).trim();
  } else if (capabilities?.systemDate && capabilities?.systemDateMode === 'custom') {
    resolvedSystemDate = String(capabilities.systemDate).trim();
  }

  let formattedDate = resolvedSystemDate;
  try {
    const parsedDate = new Date(`${resolvedSystemDate}T12:00:00Z`);
    if (!isNaN(parsedDate.getTime())) {
      formattedDate = `${parsedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })} (${resolvedSystemDate})`;
    }
  } catch {}

  return `[Current System Date]: Today's date is ${formattedDate}. Treat this as the exact current date for all temporal reasoning, time calculations, and date-sensitive queries.`;
}

function extractAttachmentText(att: NonNullable<ChatMessage['attachments']>[number]): string {
  if (typeof att.textContent === 'string' && att.textContent.length > 0) {
    return att.textContent;
  }
  if (typeof att.textPreview === 'string' && att.textPreview.length > 0) {
    return att.textPreview;
  }
  if (
    att.dataUrl &&
    (att.type === 'text' ||
      !att.mimeType ||
      att.mimeType.startsWith('text/') ||
      att.mimeType.includes('json') ||
      att.mimeType.includes('javascript') ||
      att.mimeType.includes('xml'))
  ) {
    const matches = att.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (matches) {
      try {
        return decodeURIComponent(escape(atob(matches[1])));
      } catch {
        try {
          return atob(matches[1]);
        } catch {}
      }
    }
  }
  return '';
}

export function buildLocalChatMessages(
  messages: ChatMessage[],
  capabilities: ModelCapabilitiesConfig,
  secretPrompt?: string,
  secretPromptEnabled?: boolean,
  modelId?: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const formatted: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  const hasSecret = Boolean(secretPromptEnabled && secretPrompt && secretPrompt.trim().length > 0);
  const secretText = secretPrompt ? secretPrompt.trim() : '';
  const reasoningEnabled = capabilities.reasoning !== false;
  const depth = capabilities.thinkingLevel || 'high';
  const lowerModel = (modelId || '').toLowerCase();
  const isQwen3 = lowerModel.includes('qwen3');

  const systemParts: string[] = [];
  if (hasSecret) {
    systemParts.push(
      `=== SYSTEM DIRECTIVE ===\n${secretText}\nFollow this directive strictly in every response.`
    );
  }
  systemParts.push(buildSystemDateInstruction(capabilities));

  if (!reasoningEnabled) {
    systemParts.push(
      '[Reasoning Mode: OFF]: Answer directly and concisely without outputting <think> blocks or internal reasoning steps.'
    );
  } else {
    const depthGuidance: Record<string, string> = {
      low: '[Reasoning Depth: LOW]: Keep internal thinking brief and focused on quick verification before giving a direct answer.',
      medium: '[Reasoning Depth: MEDIUM]: Think through the problem step by step with balanced analysis before giving your final answer.',
      high: '[Reasoning Depth: HIGH]: Perform thorough, structured multi-step reasoning and verify edge cases before concluding.',
      xhigh: '[Reasoning Depth: XHIGH]: Perform exhaustive, deep first-principles analysis, check assumptions and edge cases rigorously, and double-check all calculations before delivering your final answer.',
    };
    systemParts.push(depthGuidance[depth] || depthGuidance.high);
  }

  if (capabilities.systemPrompt) {
    systemParts.push(capabilities.systemPrompt);
  }
  if (capabilities.voiceConfig?.respondInVoiceLanguage && capabilities.voiceConfig?.lang) {
    systemParts.push(
      `[Language Preference]: Respond naturally in the language matching locale ${capabilities.voiceConfig.lang} unless the user explicitly asks for another language.`
    );
  }

  formatted.push({
    role: 'system',
    content: systemParts.join('\n\n'),
  });

  const nonSys = messages.filter((m) => m.role !== 'system');
  for (let i = 0; i < nonSys.length; i++) {
    const msg = nonSys[i];
    const isLast = i === nonSys.length - 1;
    let textContent = msg.content || '';

    if (msg.attachments && msg.attachments.length > 0) {
      const attTexts: string[] = [];
      for (const att of msg.attachments) {
        if (att.type === 'image') {
          attTexts.push(`[Attached Image: ${att.name || 'image'}]`);
        } else {
          const extracted = extractAttachmentText(att);
          if (extracted) {
            attTexts.push(`[Attached File: ${att.name || 'document.txt'}]\n${extracted}`);
          }
        }
      }
      if (attTexts.length > 0) {
        textContent = `${attTexts.join('\n\n')}\n\n${textContent}`;
      }
    }

    if (hasSecret && msg.role === 'user' && isLast) {
      textContent = `${textContent}\n\n[MANDATORY CONSTRAINT: ${secretText}]`;
    }

    // Qwen3 native soft-switch for enabling/disabling thinking mode
    if (isQwen3 && msg.role === 'user' && isLast) {
      textContent = reasoningEnabled ? `${textContent} /think` : `${textContent} /no_think`;
    }

    formatted.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: textContent,
    });
  }

  return formatted;
}

/**
 * Splits streaming tokens containing `<think>...</think>` blocks into
 * separate thinking and answer callbacks.
 */
function createThinkTagStreamSplitter(
  onChunk: (text: string) => void,
  onThinkingChunk: (thinking: string) => void
) {
  let buffer = '';
  let insideThink = false;

  const process = (delta: string, flush = false) => {
    buffer += delta;
    while (buffer.length > 0) {
      if (!insideThink) {
        const openIdx = buffer.indexOf('<think>');
        if (openIdx !== -1) {
          const before = buffer.slice(0, openIdx);
          if (before) onChunk(before);
          buffer = buffer.slice(openIdx + 7);
          insideThink = true;
          continue;
        }
        // Hold partial `<think>` prefix at end unless flushing
        if (!flush) {
          const lastLt = buffer.lastIndexOf('<');
          if (lastLt !== -1 && '<think>'.startsWith(buffer.slice(lastLt))) {
            const safe = buffer.slice(0, lastLt);
            if (safe) onChunk(safe);
            buffer = buffer.slice(lastLt);
            break;
          }
        }
        onChunk(buffer);
        buffer = '';
        break;
      } else {
        const closeIdx = buffer.indexOf('</think>');
        if (closeIdx !== -1) {
          const thinkContent = buffer.slice(0, closeIdx);
          if (thinkContent) onThinkingChunk(thinkContent);
          buffer = buffer.slice(closeIdx + 8);
          insideThink = false;
          continue;
        }
        if (!flush) {
          const lastLt = buffer.lastIndexOf('<');
          if (lastLt !== -1 && '</think>'.startsWith(buffer.slice(lastLt))) {
            const safe = buffer.slice(0, lastLt);
            if (safe) onThinkingChunk(safe);
            buffer = buffer.slice(lastLt);
            break;
          }
        }
        onThinkingChunk(buffer);
        buffer = '';
        break;
      }
    }
  };

  return {
    push: (delta: string) => process(delta, false),
    end: () => process('', true),
  };
}

export interface LocalStreamCallbacks {
  onProgress?: (report: { progress: number; text: string; runtime: LocalRuntimeMode }) => void;
  onChunk: (chunk: string) => void;
  onThinkingChunk?: (thinkingChunk: string) => void;
}

export async function streamWebLLMChat(
  params: {
    modelId: string;
    messages: ChatMessage[];
    capabilities: ModelCapabilitiesConfig;
    secretPrompt?: string;
    secretPromptEnabled?: boolean;
    signal?: AbortSignal;
  },
  callbacks: LocalStreamCallbacks
): Promise<void> {
  const { modelId, messages, capabilities, secretPrompt, secretPromptEnabled, signal } = params;

  const onAbort = () => {
    interruptWebLLMGeneration();
  };
  if (signal) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const engine = await ensureWebLLMEngine(modelId, (report) => {
      callbacks.onProgress?.({
        progress: report.progress ?? 0,
        text: report.text || 'Initializing WebGPU model...',
        runtime: 'webgpu',
      });
    });

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const reasoningEnabled = capabilities.reasoning !== false;
    const formattedMessages = buildLocalChatMessages(
      messages,
      capabilities,
      secretPrompt,
      secretPromptEnabled,
      modelId
    );

    const splitter = createThinkTagStreamSplitter(
      callbacks.onChunk,
      (t) => {
        if (reasoningEnabled) callbacks.onThinkingChunk?.(t);
      }
    );

    const depthTokenCap =
      !reasoningEnabled
        ? 2048
        : capabilities.thinkingLevel === 'xhigh'
        ? 4096
        : capabilities.thinkingLevel === 'high'
        ? 3584
        : capabilities.thinkingLevel === 'medium'
        ? 2560
        : 1536;

    const stream = await engine.chat.completions.create({
      messages: formattedMessages,
      stream: true,
      temperature: capabilities.temperature ?? 0.7,
      top_p: capabilities.topP ?? 0.95,
      max_tokens: Math.min(Math.max(capabilities.maxTokens || 2048, depthTokenCap), 4096),
    });

    for await (const chunk of stream) {
      if (signal?.aborted) {
        engine.interruptGenerate();
        break;
      }
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        splitter.push(delta);
      }
    }
    splitter.end();
  } finally {
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

function normalizeBaseUrls(endpointUrl: string) {
  const trimmed = (endpointUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
  const rootUrl = trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed;
  const v1Url = trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  return { rootUrl, v1Url };
}

export async function discoverLocalServerModels(
  endpointUrl: string,
  mode: LocalRuntimeMode = 'ollama'
): Promise<{ ok: boolean; models: AIModel[]; error?: string; corsHint?: boolean }> {
  const { rootUrl, v1Url } = normalizeBaseUrls(endpointUrl);

  // 1. Try Ollama native /api/tags first (richest metadata: size, quantization, parameter size)
  if (mode === 'ollama' || rootUrl.includes('11434')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${rootUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const rawModels = Array.isArray(data.models) ? data.models : [];
        const models: AIModel[] = rawModels.map((m: any, idx: number) => {
          const id = m.name || m.model;
          const sizeBytes = Number(m.size || 0);
          const sizeGB = sizeBytes > 0 ? `${(sizeBytes / 1024 ** 3).toFixed(1)} GB` : undefined;
          const details = m.details || {};
          const paramLabel = details.parameter_size ? `${details.parameter_size}` : '';
          const quantLabel = details.quantization_level ? ` • ${details.quantization_level}` : '';
          const family = details.family ? `${details.family}` : 'Ollama';
          return {
            id,
            name: `${id} (Ollama)`,
            provider: 'local',
            description: `Local ${family} model (${paramLabel}${quantLabel}) served at ${rootUrl}`,
            contextWindow: 'Local',
            capabilities: id.toLowerCase().includes('r1') || id.toLowerCase().includes('qwen3')
              ? ['reasoning', 'codeExecution']
              : ['codeExecution'],
            recommended: idx === 0,
            minPlanTier: 'free',
            supportedPlans: ['free', 'tier1', 'pro', 'enterprise'],
            isAccountVerified: true,
            speed: 'Fast',
            intelligenceLevel: 'Very High',
            localRuntime: 'ollama',
            sizeLabel: sizeGB || paramLabel || 'Local',
          };
        });
        return { ok: true, models };
      }
    } catch {
      // Fall through to OpenAI-compatible /v1/models check
    }
  }

  // 2. Try OpenAI-compatible /v1/models (LM Studio, llama.cpp, vLLM, LocalAI, Ollama /v1)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${v1Url}/models`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const rawModels = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
      const runtimeLabel =
        mode === 'lmstudio' ? 'LM Studio' : mode === 'llamacpp' ? 'llama.cpp' : 'Local Server';
      const models: AIModel[] = rawModels.map((m: any, idx: number) => {
        const id = m.id || m.name;
        return {
          id,
          name: `${id} (${runtimeLabel})`,
          provider: 'local',
          description: `Running locally via ${runtimeLabel} at ${v1Url}`,
          contextWindow: 'Local',
          capabilities: ['codeExecution'],
          recommended: idx === 0,
          minPlanTier: 'free',
          supportedPlans: ['free', 'tier1', 'pro', 'enterprise'],
          isAccountVerified: true,
          speed: 'Fast',
          intelligenceLevel: 'High',
          localRuntime: mode,
          sizeLabel: runtimeLabel,
        };
      });
      return { ok: true, models };
    }
    return {
      ok: false,
      models: [],
      error: `Local server at ${v1Url} responded with HTTP ${res.status}.`,
    };
  } catch (err: any) {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isLocalhost = rootUrl.includes('localhost') || rootUrl.includes('127.0.0.1');
    return {
      ok: false,
      models: [],
      corsHint: isHttps && isLocalhost,
      error:
        err?.name === 'AbortError'
          ? `Timed out connecting to ${rootUrl}. Make sure your local server is running.`
          : `Could not reach ${rootUrl} from browser (${err?.message || 'connection refused / CORS'}).`,
    };
  }
}

export async function streamLocalServerChat(
  params: {
    endpointUrl: string;
    mode: LocalRuntimeMode;
    modelId: string;
    messages: ChatMessage[];
    capabilities: ModelCapabilitiesConfig;
    secretPrompt?: string;
    secretPromptEnabled?: boolean;
    apiKey?: string;
    signal?: AbortSignal;
  },
  callbacks: LocalStreamCallbacks
): Promise<void> {
  const {
    endpointUrl,
    mode,
    modelId,
    messages,
    capabilities,
    secretPrompt,
    secretPromptEnabled,
    apiKey,
    signal,
  } = params;

  const reasoningEnabled = capabilities.reasoning !== false;
  const { rootUrl, v1Url } = normalizeBaseUrls(endpointUrl);
  const formattedMessages = buildLocalChatMessages(
    messages,
    capabilities,
    secretPrompt,
    secretPromptEnabled,
    modelId
  );

  const splitter = createThinkTagStreamSplitter(
    callbacks.onChunk,
    (t) => {
      if (reasoningEnabled) callbacks.onThinkingChunk?.(t);
    }
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  // Prefer Ollama native /api/chat when mode === 'ollama' or port 11434 (supports native thinking field + think toggle)
  const useOllamaNative = mode === 'ollama' || (!endpointUrl.includes('/v1') && rootUrl.includes('11434'));

  if (useOllamaNative) {
    try {
      const lowerLocalModel = modelId.toLowerCase();
      const thinkParam: boolean | string = !reasoningEnabled
        ? false
        : lowerLocalModel.includes('gpt-oss')
        ? capabilities.thinkingLevel === 'xhigh'
          ? 'high'
          : capabilities.thinkingLevel || 'medium'
        : true;

      const ollamaPayload: any = {
        model: modelId,
        messages: formattedMessages,
        stream: true,
        think: thinkParam,
        options: {
          temperature: capabilities.temperature ?? 0.7,
          top_p: capabilities.topP ?? 0.95,
          num_predict: capabilities.maxTokens ?? 4096,
        },
      };

      let response = await fetch(`${rootUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ollamaPayload),
        signal,
      });

      // Older Ollama versions or non-thinking models may reject the `think` field with HTTP 400
      if (!response.ok && response.status === 400) {
        const fallbackPayload = { ...ollamaPayload };
        delete fallbackPayload.think;
        response = await fetch(`${rootUrl}/api/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify(fallbackPayload),
          signal,
        });
      }

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.message?.thinking && reasoningEnabled) {
                callbacks.onThinkingChunk?.(parsed.message.thinking);
              }
              if (parsed.message?.content) {
                splitter.push(parsed.message.content);
              }
            } catch (e: any) {
              if (e?.message && !e.message.includes('JSON')) throw e;
            }
          }
        }
        splitter.end();
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      // If /api/chat wasn't supported, fall through to OpenAI-compatible /v1/chat/completions
    }
  }

  // OpenAI-compatible /v1/chat/completions (LM Studio, llama.cpp, Ollama /v1, LocalAI)
  const response = await fetch(`${v1Url}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: formattedMessages,
      stream: true,
      temperature: capabilities.temperature ?? 0.7,
      top_p: capabilities.topP ?? 0.95,
      max_tokens: capabilities.maxTokens ?? 4096,
    }),
    signal,
  }).catch((err: any) => {
    if (err?.name === 'AbortError') throw err;
    throw new Error(
      `Failed to reach local server at ${v1Url}. Ensure Ollama/LM Studio is running with CORS enabled (e.g. OLLAMA_ORIGINS="*" ollama serve), or switch to In-Browser WebGPU mode.`
    );
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Local server error (${response.status}): ${errText || response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream reader unavailable from local server');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta;
        if (delta) {
          const reasoning = delta.reasoning_content || delta.reasoning || '';
          if (reasoning && reasoningEnabled) callbacks.onThinkingChunk?.(reasoning);
          if (delta.content) splitter.push(delta.content);
        }
      } catch {}
    }
  }
  splitter.end();
}
