/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  Sliders,
  Globe,
  Brain,
  Code2,
  Eye,
  Volume2,
  RotateCcw,
  Lock,
  Mic,
  Sun,
  Moon,
  Laptop,
  Calendar,
  Clock,
} from 'lucide-react';
import { ModelCapabilitiesConfig, ThemeMode } from '../types';
import { DEFAULT_CAPABILITIES, SYSTEM_PRESETS } from '../data/providersAndModels';

interface CapabilitiesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ModelCapabilitiesConfig;
  onChangeConfig: (newConfig: ModelCapabilitiesConfig) => void;
  activeModelId: string;
  onOpenSecretPrompt?: () => void;
  onOpenVoiceModal?: () => void;
  theme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
}

export const CapabilitiesSettingsModal: React.FC<CapabilitiesSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  activeModelId,
  onOpenSecretPrompt,
  onOpenVoiceModal,
  theme = 'dark',
  onThemeChange,
}) => {
  if (!isOpen) return null;

  const getLocalTodayIso = (offsetDays = 0) => {
    const d = new Date();
    if (offsetDays !== 0) {
      d.setDate(d.getDate() + offsetDays);
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const updateSettings = (patch: Partial<ModelCapabilitiesConfig>) => {
    onChangeConfig({
      ...config,
      ...patch,
    });
  };

  const updateSetting = <K extends keyof ModelCapabilitiesConfig>(
    key: K,
    val: ModelCapabilitiesConfig[K]
  ) => {
    onChangeConfig({
      ...config,
      [key]: val,
    });
  };

  const handleResetDefaults = () => {
    onChangeConfig({ ...DEFAULT_CAPABILITIES });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#1e1f20] border border-[#2d2f31] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2f31]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#282a2c] text-[#8ab4f8]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#e3e3e3]">
                  Model Settings & Audio
                </h2>
                <span className="text-xs text-[#8e918f] font-mono">
                  ({activeModelId})
                </span>
              </div>
              <p className="text-xs text-[#8e918f]">
                Configure reasoning, web search, voice synthesis, and parameters.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#c4c7c5] hover:text-white bg-[#282a2c] hover:bg-[#333538] rounded-full transition-colors"
              title="Reset defaults"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#8e918f] hover:text-[#e3e3e3] rounded-lg hover:bg-[#282a2c] transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* SECTION 0: Appearance & Theme */}
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[#8e918f]">
              Appearance & Theme
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'light' as ThemeMode, name: 'Light Mode', icon: Sun, desc: 'High-contrast day' },
                { id: 'dark' as ThemeMode, name: 'Dark Mode', icon: Moon, desc: 'OLED pitch dark' },
                { id: 'system' as ThemeMode, name: 'System', icon: Laptop, desc: 'Follow device OS' },
              ].map((t) => {
                const isSelected = theme === t.id;
                const IconComp = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onThemeChange?.(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer touch-manipulation active:scale-[0.98] ${
                      isSelected
                        ? 'bg-[#282a2c] border-[#8ab4f8] shadow-md shadow-[#8ab4f8]/5 ring-1 ring-[#8ab4f8]/30'
                        : 'bg-[#131314] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#8e918f]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]' : 'bg-[#1e1f20] text-[#8e918f]'}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#8ab4f8] bg-[#8ab4f8]' : 'border-[#444746]'}`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div>
                      <div className={`text-xs font-medium leading-tight ${isSelected ? 'text-[#e3e3e3]' : 'text-[#c4c7c5]'}`}>
                        {t.name}
                      </div>
                      <div className="text-[10px] text-[#8e918f] mt-0.5 hidden sm:block">
                        {t.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 1: Capabilities */}
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[#8e918f]">
              Core Capabilities
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Web Search */}
              <div
                onClick={() => updateSetting('webSearch', !config.webSearch)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                  config.webSearch
                    ? 'bg-[#282a2c] border-[#444746]'
                    : 'bg-[#131314] hover:bg-[#282a2c]/50 border-[#2d2f31]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#1e1f20] text-[#8ab4f8] shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#e3e3e3]">
                      Live Web Search
                    </div>
                    <p className="text-[11px] text-[#8e918f] mt-0.5">
                      Ground responses with real-time web sources.
                    </p>
                  </div>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 mt-0.5 ${
                    config.webSearch ? 'bg-[#8ab4f8]' : 'bg-[#3c4043]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.webSearch ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Reasoning */}
              <div
                onClick={() => updateSetting('reasoning', !config.reasoning)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                  config.reasoning
                    ? 'bg-[#282a2c] border-[#444746]'
                    : 'bg-[#131314] hover:bg-[#282a2c]/50 border-[#2d2f31]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#1e1f20] text-[#8ab4f8] shrink-0">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#e3e3e3]">
                      Step-by-Step Reasoning
                    </div>
                    <p className="text-[11px] text-[#8e918f] mt-0.5">
                      Show reasoning process and thoughts.
                    </p>
                  </div>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 mt-0.5 ${
                    config.reasoning ? 'bg-[#8ab4f8]' : 'bg-[#3c4043]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.reasoning ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Code Sandbox */}
              <div
                onClick={() => updateSetting('codeExecution', !config.codeExecution)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                  config.codeExecution
                    ? 'bg-[#282a2c] border-[#444746]'
                    : 'bg-[#131314] hover:bg-[#282a2c]/50 border-[#2d2f31]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#1e1f20] text-[#8ab4f8] shrink-0">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#e3e3e3]">
                      Code Sandbox
                    </div>
                    <p className="text-[11px] text-[#8e918f] mt-0.5">
                      Interactive HTML/JS code execution preview.
                    </p>
                  </div>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 mt-0.5 ${
                    config.codeExecution ? 'bg-[#8ab4f8]' : 'bg-[#3c4043]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.codeExecution ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Auto Read Aloud */}
              <div
                onClick={() => updateSetting('ttsEnabled', !config.ttsEnabled)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                  config.ttsEnabled
                    ? 'bg-[#282a2c] border-[#444746]'
                    : 'bg-[#131314] hover:bg-[#282a2c]/50 border-[#2d2f31]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#1e1f20] text-[#8ab4f8] shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#e3e3e3]">
                      Auto Read Aloud
                    </div>
                    <p className="text-[11px] text-[#8e918f] mt-0.5">
                      Automatically play speech for every incoming response.
                    </p>
                  </div>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 mt-0.5 ${
                    config.ttsEnabled ? 'bg-[#8ab4f8]' : 'bg-[#3c4043]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.ttsEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Changeable Voice Option */}
          <div className="p-4 rounded-xl bg-[#131314] border border-[#2d2f31] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#1e1f20] text-[#8ab4f8] shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-medium text-[#e3e3e3]">
                  Change Voice & Speech Rate
                </div>
                <div className="text-[11px] text-[#8e918f] mt-0.5">
                  Current voice: <strong className="text-white">{config.voiceConfig?.voiceName || 'System Default'}</strong> ({(config.voiceConfig?.rate || 1).toFixed(2)}x speed)
                </div>
              </div>
            </div>
            {onOpenVoiceModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVoiceModal();
                }}
                className="px-4 py-1.5 rounded-full text-xs font-medium text-[#131314] bg-[#8ab4f8] hover:bg-[#a8c7fa] transition-colors"
              >
                Change Voice
              </button>
            )}
          </div>

          {/* SECTION 3: System Date & Temporal Context for LLM */}
          <div className="space-y-3 pt-4 border-t border-[#2d2f31]">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wider text-[#8e918f] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#8ab4f8]" />
                <span>System Date for LLM</span>
              </div>
              <span className="text-[11px] text-[#8ab4f8] font-mono">
                {config.systemDateMode === 'custom'
                  ? `Custom: ${config.customSystemDate || getLocalTodayIso()}`
                  : `Live: ${getLocalTodayIso()}`}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#131314] border border-[#2d2f31] space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="text-xs font-medium text-[#e3e3e3] flex items-center gap-1.5">
                    <span>LLM Time Anchor</span>
                  </div>
                  <p className="text-[11px] text-[#8e918f] mt-0.5">
                    Specifies the current system date injected into the LLM prompt. Used for temporal grounding and BackEval evaluations.
                  </p>
                </div>

                <div className="flex items-center p-0.5 rounded-xl bg-[#1e1f20] border border-[#2d2f31] shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      updateSettings({
                        systemDateMode: 'current',
                        systemDate: getLocalTodayIso(),
                      });
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      config.systemDateMode !== 'custom'
                        ? 'bg-[#8ab4f8] text-[#131314] font-medium shadow-xs'
                        : 'text-[#8e918f] hover:text-[#e3e3e3]'
                    }`}
                  >
                    Live Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const dateVal = config.customSystemDate || getLocalTodayIso();
                      updateSettings({
                        systemDateMode: 'custom',
                        customSystemDate: dateVal,
                        systemDate: dateVal,
                      });
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      config.systemDateMode === 'custom'
                        ? 'bg-[#8ab4f8] text-[#131314] font-medium shadow-xs'
                        : 'text-[#8e918f] hover:text-[#e3e3e3]'
                    }`}
                  >
                    Custom Date
                  </button>
                </div>
              </div>

              {config.systemDateMode === 'custom' && (
                <div className="p-3.5 rounded-xl bg-[#1e1f20] border border-[#3c4043] space-y-3 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="text-xs font-medium text-[#c4c7c5] flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#8ab4f8]" />
                      <span>Select System Date:</span>
                    </label>
                    <input
                      type="date"
                      value={config.customSystemDate || getLocalTodayIso()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          updateSettings({
                            systemDateMode: 'custom',
                            customSystemDate: val,
                            systemDate: val,
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#131314] border border-[#2d2f31] text-xs text-[#e3e3e3] font-mono focus:border-[#8ab4f8] focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Date Quick Presets */}
                  <div>
                    <div className="text-[10px] text-[#8e918f] uppercase tracking-wider mb-1.5">
                      Quick Benchmarking Presets
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Today', val: getLocalTodayIso(0) },
                        { label: 'Yesterday', val: getLocalTodayIso(-1) },
                        { label: '1 Year Ago', val: getLocalTodayIso(-365) },
                        { label: '2025-01-01', val: '2025-01-01' },
                        { label: '2024-01-01', val: '2024-01-01' },
                        { label: '2020-01-01', val: '2020-01-01' },
                        { label: 'Future 2030', val: '2030-01-01' },
                      ].map((preset) => {
                        const isSelected = (config.customSystemDate || '') === preset.val;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              updateSettings({
                                systemDateMode: 'custom',
                                customSystemDate: preset.val,
                                systemDate: preset.val,
                              });
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#8ab4f8] text-[#131314] font-medium'
                                : 'bg-[#131314] hover:bg-[#282a2c] text-[#8e918f] hover:text-[#e3e3e3] border border-[#2d2f31]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* LLM Prompt Preview */}
                  <div className="text-[11px] bg-[#131314] p-2.5 rounded-lg border border-[#2d2f31] text-[#9aa0a6]">
                    <span className="text-[#8ab4f8] font-semibold">Active LLM Prompt Context: </span>
                    &quot;Today&apos;s current date is {config.customSystemDate || getLocalTodayIso()}. You must consider this exact date as the present time for all reasoning...&quot;
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: Parameters */}
          <div className="space-y-4 pt-4 border-t border-[#2d2f31]">
            <div className="text-xs font-medium uppercase tracking-wider text-[#8e918f]">
              Generation Parameters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Temperature */}
              <div className="p-4 rounded-xl bg-[#131314] border border-[#2d2f31] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#c4c7c5]">Temperature</span>
                  <span className="font-mono text-[#e3e3e3]">{config.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={config.temperature}
                  onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
                  className="w-full accent-[#8ab4f8]"
                />
                <div className="flex justify-between text-[10px] text-[#8e918f]">
                  <span>Precise (0.0)</span>
                  <span>Creative (2.0)</span>
                </div>
              </div>

              {/* Max Output Tokens */}
              <div className="p-4 rounded-xl bg-[#131314] border border-[#2d2f31] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#c4c7c5]">Max Tokens</span>
                  <span className="font-mono text-[#e3e3e3]">{config.maxTokens}</span>
                </div>
                <input
                  type="range"
                  min="512"
                  max="16384"
                  step="512"
                  value={config.maxTokens}
                  onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value))}
                  className="w-full accent-[#8ab4f8]"
                />
                <div className="flex justify-between text-[10px] text-[#8e918f]">
                  <span>512</span>
                  <span>16,384</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] border-t border-[#2d2f31] flex justify-end shrink-0 bg-[#1e1f20]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#e3e3e3] hover:bg-white text-[#131314] font-medium text-xs transition-colors cursor-pointer touch-manipulation active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
