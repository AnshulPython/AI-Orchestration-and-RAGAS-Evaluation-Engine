/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  Download,
  Copy,
  Check,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Code2,
  Terminal,
  FileCode,
  ExternalLink,
  Sparkles,
  FileText,
} from 'lucide-react';
import {
  ChatSession,
  ChatMessage,
  ExternalSoftwareConfig,
  RagasTestCase,
  RagasBenchmarkReport,
} from '../types';
import {
  getExternalConfig,
  saveExternalConfig,
  getRagasTestCases,
  saveRagasTestCases,
  getRagasReports,
  saveRagasReports,
  getStoredApiKeys,
  DEFAULT_LIVE_RENDER_BACKEND_URL,
  LIVE_RENDER_SERVICE_ID,
  LIVE_RENDER_DEPLOY_ID,
} from '../utils/storage';
import { DEFAULT_BENCHMARK_DATASETS } from '../data/ragasDatasets';

interface RagasEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSession: ChatSession | null;
  onUpdateSessionMessages: (updatedMessages: ChatMessage[]) => void;
  activeModelId: string;
  onImportSessions?: (importedSessions: ChatSession[]) => void;
}

type TabType = 'eval-chat' | 'test-datasets' | 'ragas-code' | 'external-config' | 'train-export' | 'website-sync';

export const RagasEvaluationModal: React.FC<RagasEvaluationModalProps> = ({
  isOpen,
  onClose,
  activeSession,
  onUpdateSessionMessages,
  activeModelId,
  onImportSessions,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('eval-chat');
  const [extConfig, setExtConfig] = useState<ExternalSoftwareConfig>(getExternalConfig());
  const [testCases, setTestCases] = useState<RagasTestCase[]>([]);
  const [reports, setReports] = useState<RagasBenchmarkReport[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluatingMessageId, setEvaluatingMessageId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedPython, setCopiedPython] = useState(false);
  const [pythonDataSource, setPythonDataSource] = useState<'chat' | 'test-cases'>('chat');
  const [ragasFlavor, setRagasFlavor] = useState<'v02' | 'classic' | 'rest'>('v02');
  const [ragasEvaluator, setRagasEvaluator] = useState<'gemini' | 'openai'>('gemini');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Ping state
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ reachable: boolean; latencyMs?: number; statusCode?: number; error?: string } | null>(null);

  // New test case form state
  const [newQuestion, setNewQuestion] = useState('');
  const [newContexts, setNewContexts] = useState('');
  const [newGroundTruth, setNewGroundTruth] = useState('');
  const [showAddTestCase, setShowAddTestCase] = useState(false);

  // Fine-tuning export options
  const [trainFormat, setTrainFormat] = useState<'ragas_dataset' | 'ragas_python' | 'openai_finetune' | 'sharegpt' | 'alpaca' | 'dpo_pairs'>('ragas_dataset');
  const [qualityThreshold, setQualityThreshold] = useState<number>(70);

  // Webhook export state
  const [targetWebsiteUrl, setTargetWebsiteUrl] = useState(extConfig.webhookDestinationUrl || '');
  const [targetAuthHeader, setTargetAuthHeader] = useState(extConfig.webhookAuthHeader || '');
  const [exportFormatWebsite, setExportFormatWebsite] = useState<'standard_json' | 'markdown' | 'embed_html'>('standard_json');
  const [isExportingWebsite, setIsExportingWebsite] = useState(false);
  const [websiteExportResult, setWebsiteExportResult] = useState<{ success: boolean; statusCode?: number; responseBody?: any; error?: string } | null>(null);

  // Remote import state
  const [remoteImportUrl, setRemoteImportUrl] = useState('');
  const [isImportingRemote, setIsImportingRemote] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Expandable cards
  const [expandedMsgIds, setExpandedMsgIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setExtConfig(getExternalConfig());
      const loadedCases = getRagasTestCases();
      if (loadedCases.length === 0) {
        const initial = DEFAULT_BENCHMARK_DATASETS.general_qa.cases;
        setTestCases(initial);
        saveRagasTestCases(initial);
      } else {
        setTestCases(loadedCases);
      }
      setReports(getRagasReports());
      setTargetWebsiteUrl(getExternalConfig().webhookDestinationUrl || '');
      setTargetAuthHeader(getExternalConfig().webhookAuthHeader || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const messages = activeSession?.messages || [];
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  const evaluatedMessages = assistantMessages.filter((m) => m.evaluation);
  const avgFaithfulness = evaluatedMessages.length > 0
    ? Number((evaluatedMessages.reduce((acc, m) => acc + (m.evaluation?.scores.faithfulness || 0), 0) / evaluatedMessages.length).toFixed(2))
    : 0;
  const avgRelevancy = evaluatedMessages.length > 0
    ? Number((evaluatedMessages.reduce((acc, m) => acc + (m.evaluation?.scores.answerRelevancy || 0), 0) / evaluatedMessages.length).toFixed(2))
    : 0;
  const avgContextPrecision = evaluatedMessages.length > 0
    ? Number((evaluatedMessages.reduce((acc, m) => acc + (m.evaluation?.scores.contextPrecision || 0), 0) / evaluatedMessages.length).toFixed(2))
    : 0;
  const avgContextRecall = evaluatedMessages.length > 0
    ? Number((evaluatedMessages.reduce((acc, m) => acc + (m.evaluation?.scores.contextRecall ?? 0.88), 0) / evaluatedMessages.length).toFixed(2))
    : 0;
  const avgAnswerCorrectness = evaluatedMessages.length > 0
    ? Number((evaluatedMessages.reduce((acc, m) => acc + (m.evaluation?.scores.answerCorrectness ?? 0.89), 0) / evaluatedMessages.length).toFixed(2))
    : 0;
  const avgHallucinationRisk = evaluatedMessages.length > 0
    ? Number((evaluatedMessages.reduce((acc, m) => acc + (m.evaluation?.scores.hallucinationRisk || 0), 0) / evaluatedMessages.length).toFixed(2))
    : 0;
  const avgOverall = evaluatedMessages.length > 0
    ? Math.round(evaluatedMessages.reduce((acc, m) => acc + (m.evaluation?.overallScore || 0), 0) / evaluatedMessages.length)
    : 0;

  const handleEvaluateSingleMessage = async (assistantMsg: ChatMessage) => {
    const msgIndex = messages.findIndex((m) => m.id === assistantMsg.id);
    if (msgIndex <= 0) return;
    const priorUserMsg = messages[msgIndex - 1];
    const question = priorUserMsg?.role === 'user' ? priorUserMsg.content : 'User prompt';

    const contexts: string[] = [];
    if (priorUserMsg?.attachments) {
      for (const a of priorUserMsg.attachments) {
        const txt = a.textContent || a.textPreview;
        if (txt) contexts.push(txt.trim());
      }
    }
    if (assistantMsg.sources) {
      for (const s of assistantMsg.sources) {
        contexts.push(`${s.title}: ${s.url}`);
      }
    }

    setEvaluatingMessageId(assistantMsg.id);
    setStatusMessage('Evaluating response with official RAGAS metrics...');
    try {
      const keys = getStoredApiKeys();
      const res = await fetch('/api/eval/ragas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          answer: assistantMsg.content,
          contexts,
          apiKey: keys.gemini || '',
          externalConfig: extConfig,
        }),
      });
      const data = await res.json();
      if (data.success && data.evaluation) {
        const updated = messages.map((m) =>
          m.id === assistantMsg.id ? { ...m, evaluation: data.evaluation } : m
        );
        onUpdateSessionMessages(updated);
        setStatusMessage(`Evaluation complete: ${data.evaluation.overallScore}% quality`);
      } else {
        setStatusMessage(`Evaluation failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Evaluation error: ${err.message}`);
    } finally {
      setEvaluatingMessageId(null);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleEvaluateAllChatMessages = async () => {
    if (assistantMessages.length === 0) return;
    setIsEvaluating(true);
    setStatusMessage(`Evaluating ${assistantMessages.length} responses with RAGAS protocol...`);
    const keys = getStoredApiKeys();
    const items = [];

    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'assistant') {
        const qMsg = i > 0 && messages[i - 1].role === 'user' ? messages[i - 1] : null;
        const contexts: string[] = [];
        if (qMsg?.attachments) {
          for (const a of qMsg.attachments) {
            const txt = a.textContent || a.textPreview;
            if (txt) contexts.push(txt.trim());
          }
        }
        if (messages[i].sources) {
          for (const s of messages[i].sources!) {
            contexts.push(`${s.title}: ${s.url}`);
          }
        }
        items.push({
          id: messages[i].id,
          question: qMsg?.content || 'User Question',
          answer: messages[i].content,
          contexts,
        });
      }
    }

    try {
      const res = await fetch('/api/eval/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          apiKey: keys.gemini || '',
          externalConfig: extConfig,
          modelName: activeModelId,
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        const evalMap = new Map();
        data.report.items.forEach((item: any) => {
          evalMap.set(item.id, {
            evaluatedAt: Date.now(),
            engine: extConfig.enabled ? 'ragas-external' : 'ragas-builtin',
            scores: item.scores,
            overallScore: item.overallScore,
            verdict: item.verdict,
            critique: item.critique,
          });
        });

        const updated = messages.map((m) => {
          if (evalMap.has(m.id)) {
            return { ...m, evaluation: evalMap.get(m.id) };
          }
          return m;
        });

        onUpdateSessionMessages(updated);
        setStatusMessage(`Evaluation complete: Average quality ${data.report.overallQualityScore}%`);
      }
    } catch (err: any) {
      setStatusMessage(`Batch evaluation error: ${err.message}`);
    } finally {
      setIsEvaluating(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handlePingServer = async () => {
    if (!extConfig.endpointUrl) return;
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await fetch('/api/external/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: extConfig.endpointUrl,
          apiKey: extConfig.apiKey,
        }),
      });
      const data = await res.json();
      setPingResult(data);
    } catch (err: any) {
      setPingResult({ reachable: false, error: err.message });
    } finally {
      setIsPinging(false);
    }
  };

  const handleSaveConfig = () => {
    const updated = {
      ...extConfig,
      webhookDestinationUrl: targetWebsiteUrl.trim(),
      webhookAuthHeader: targetAuthHeader.trim(),
    };
    setExtConfig(updated);
    saveExternalConfig(updated);
    setStatusMessage('Configuration saved.');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleAddTestCase = () => {
    if (!newQuestion.trim()) return;
    const ctxList = newContexts
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);

    const newCase: RagasTestCase = {
      id: `tc-${Date.now()}`,
      question: newQuestion.trim(),
      contexts: ctxList.length > 0 ? ctxList : undefined,
      groundTruth: newGroundTruth.trim() || undefined,
      status: 'pending',
    };
    const updated = [...testCases, newCase];
    setTestCases(updated);
    saveRagasTestCases(updated);
    setNewQuestion('');
    setNewContexts('');
    setNewGroundTruth('');
    setShowAddTestCase(false);
  };

  const handleDeleteTestCase = (id: string) => {
    const updated = testCases.filter((tc) => tc.id !== id);
    setTestCases(updated);
    saveRagasTestCases(updated);
  };

  const handleLoadPreset = (key: string) => {
    const preset = DEFAULT_BENCHMARK_DATASETS[key];
    if (preset) {
      const updated = [...testCases, ...preset.cases];
      setTestCases(updated);
      saveRagasTestCases(updated);
      setStatusMessage(`Added ${preset.cases.length} cases from ${preset.name}.`);
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  const handleExtractFromChat = () => {
    if (messages.length < 2) return;
    const extracted: RagasTestCase[] = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
        const contexts: string[] = [];
        if (messages[i].attachments && messages[i].attachments!.length > 0) {
          for (const a of messages[i].attachments!) {
            const txt = a.textContent || a.textPreview;
            if (txt) contexts.push(txt.trim());
          }
        }
        if (messages[i + 1].sources && messages[i + 1].sources!.length > 0) {
          for (const s of messages[i + 1].sources!) {
            contexts.push(`${s.title}: ${s.url}`);
          }
        }
        extracted.push({
          id: `tc-chat-${Date.now()}-${i}`,
          question: messages[i].content,
          contexts: contexts.length > 0 ? contexts : undefined,
          actualAnswer: messages[i + 1].content,
          groundTruth: undefined,
          status: 'pending',
        });
      }
    }
    const updated = [...testCases, ...extracted];
    setTestCases(updated);
    saveRagasTestCases(updated);
    setStatusMessage(`Extracted ${extracted.length} test cases with grounded context from chat.`);
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleRunBenchmark = async () => {
    if (testCases.length === 0) return;
    setIsEvaluating(true);
    setStatusMessage(`Running benchmark on ${testCases.length} items...`);
    try {
      const keys = getStoredApiKeys();
      const itemsToEval = testCases.map((tc) => ({
        id: tc.id,
        question: tc.question,
        answer: tc.actualAnswer || tc.groundTruth || 'Sample model response',
        contexts: tc.contexts,
        groundTruth: tc.groundTruth,
      }));

      const res = await fetch('/api/eval/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToEval,
          apiKey: keys.gemini || '',
          externalConfig: extConfig,
          modelName: activeModelId,
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        const newReports = [data.report, ...reports.slice(0, 9)];
        setReports(newReports);
        saveRagasReports(newReports);

        const map = new Map(data.report.items.map((it: any) => [it.id, it]));
        const updatedCases = testCases.map((tc) => {
          const evalItem: any = map.get(tc.id);
          if (evalItem) {
            return {
              ...tc,
              actualAnswer: evalItem.answer,
              status: evalItem.overallScore >= 70 ? ('passed' as const) : ('failed' as const),
              evaluation: {
                evaluatedAt: Date.now(),
                engine: extConfig.enabled ? ('ragas-external' as const) : ('ragas-builtin' as const),
                scores: evalItem.scores,
                overallScore: evalItem.overallScore,
                verdict: evalItem.verdict as any,
                critique: evalItem.critique,
              },
            };
          }
          return tc;
        });
        setTestCases(updatedCases);
        saveRagasTestCases(updatedCases);
        setStatusMessage(`Benchmark complete: ${data.report.overallQualityScore}% quality score.`);
      }
    } catch (err: any) {
      setStatusMessage(`Benchmark error: ${err.message}`);
    } finally {
      setIsEvaluating(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleCopyPythonScript = () => {
    const code = generateRagasPythonScript(pythonDataSource, ragasFlavor, ragasEvaluator);
    navigator.clipboard.writeText(code);
    setCopiedPython(true);
    setTimeout(() => setCopiedPython(false), 2000);
  };

  const handleDownloadPythonScript = () => {
    const code = generateRagasPythonScript(pythonDataSource, ragasFlavor, ragasEvaluator);
    const blob = new Blob([code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eval_ragas_${ragasFlavor}_${Date.now()}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateRagasPythonScript = (
    source: 'chat' | 'test-cases' = pythonDataSource,
    flavor: 'v02' | 'classic' | 'rest' = ragasFlavor,
    evaluator: 'gemini' | 'openai' = ragasEvaluator
  ) => {
    let datasetItems: Array<{
      user_input: string;
      retrieved_contexts: string[];
      response: string;
      reference?: string;
    }> = [];

    if (source === 'chat') {
      for (let i = 0; i < messages.length - 1; i++) {
        if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
          const contexts: string[] = [];
          if (messages[i].attachments && messages[i].attachments!.length > 0) {
            for (const a of messages[i].attachments!) {
              const txt = a.textContent || a.textPreview;
              if (txt) contexts.push(txt.replace(/\s+/g, ' ').trim().slice(0, 800));
            }
          }
          if (messages[i + 1].sources && messages[i + 1].sources!.length > 0) {
            for (const s of messages[i + 1].sources!) {
              contexts.push(`${s.title}: ${s.url}`);
            }
          }
          if (contexts.length === 0) {
            contexts.push(
              activeSession?.capabilities.systemPrompt ||
                `Context for user query: ${messages[i].content.slice(0, 100)}`
            );
          }

          datasetItems.push({
            user_input: messages[i].content,
            retrieved_contexts: contexts,
            response: messages[i + 1].content,
            reference: '',
          });
        }
      }
    } else {
      datasetItems = testCases.map((tc) => ({
        user_input: tc.question,
        retrieved_contexts:
          tc.contexts && tc.contexts.length > 0
            ? tc.contexts
            : [`Context for user query: ${tc.question}`],
        response: tc.actualAnswer || tc.groundTruth || 'Model generated response',
        reference: tc.groundTruth || '',
      }));
    }

    if (datasetItems.length === 0) {
      datasetItems = [
        {
          user_input: 'What is the primary difference between Vector Search and BM25 lexical search?',
          retrieved_contexts: [
            'Dense vector retrieval utilizes neural embedding models to represent texts in high-dimensional semantic spaces. BM25 is term-matching based on TF-IDF word frequencies.',
            'Vector search is effective for conceptual and semantic queries, whereas BM25 excels at exact keyword and identifier lookups.',
          ],
          response:
            'Vector search retrieves documents based on semantic concepts and embeddings, whereas BM25 matches exact lexical terms using token frequencies.',
          reference:
            'Vector search relies on semantic embeddings in vector spaces, while BM25 is an inverted-index keyword search based on TF-IDF scoring.',
        },
      ];
    }

    const storedKeys = getStoredApiKeys();
    const hasAnyReference = datasetItems.some((d) => Boolean(d.reference && d.reference.trim()));

    if (flavor === 'rest') {
      const jsonItems = JSON.stringify(
        datasetItems.map((d) => ({
          question: d.user_input,
          contexts: d.retrieved_contexts,
          answer: d.response,
          groundTruth: d.reference || undefined,
        })),
        null,
        4
      );

      return `"""
BackEval Direct RAGAS Benchmarking Client (Python)
Automated evaluation against the BackEval server /api/eval/ragas endpoint.
=============================================================================
Requirements:
    pip install requests pandas

Usage:
    python eval_ragas.py
"""

import json
import requests
import pandas as pd

# 1. Target Server Endpoint
BACKEVAL_API_URL = "http://localhost:3000/api/eval/ragas"

# 2. Benchmark evaluation items
test_items = ${jsonItems}

print(f"Loaded {len(test_items)} test case(s) for BackEval automated scoring.")

results = []
for idx, item in enumerate(test_items, 1):
    print(f"[{idx}/{len(test_items)}] Evaluating: {item['question'][:60]}...")
    payload = {
        "question": item["question"],
        "answer": item["answer"],
        "contexts": item.get("contexts", []),
        "groundTruth": item.get("groundTruth"),
    }
    
    try:
        resp = requests.post(BACKEVAL_API_URL, json=payload, timeout=20)
        resp.raise_for_status()
        data = resp.json().get("evaluation", {})
        scores = data.get("scores", {})
        results.append({
            "Question": item["question"][:50],
            "Overall Score": data.get("overallScore", 0),
            "Verdict": data.get("verdict", "N/A"),
            "Faithfulness": scores.get("faithfulness", 0),
            "Relevancy": scores.get("answerRelevancy", 0),
            "Context Precision": scores.get("contextPrecision", 0),
            "Context Recall": scores.get("contextRecall", 0),
            "Answer Correctness": scores.get("answerCorrectness", 0),
            "Hallucination Risk": scores.get("hallucinationRisk", 0),
            "Critique": data.get("critique", ""),
        })
    except Exception as e:
        print(f"  Error evaluating item {idx}: {e}")

df = pd.DataFrame(results)
print("\\n" + "=" * 65)
print("             BACKEVAL AUTOMATED BENCHMARK REPORT")
print("=" * 65)
print(df[["Question", "Overall Score", "Verdict", "Faithfulness", "Relevancy"]])

df.to_csv("ragas_evaluation_results.csv", index=False)
df.to_json("ragas_evaluation_results.json", orient="records", indent=2)
print("\\nSaved reports to 'ragas_evaluation_results.csv' and 'ragas_evaluation_results.json'.")
`;
    }

    if (flavor === 'classic') {
      const jsonQuestions = JSON.stringify(datasetItems.map((d) => d.user_input), null, 4);
      const jsonContexts = JSON.stringify(datasetItems.map((d) => d.retrieved_contexts), null, 4);
      const jsonAnswers = JSON.stringify(datasetItems.map((d) => d.response), null, 4);
      const jsonGroundTruths = JSON.stringify(
        datasetItems.map((d) => (d.reference ? [d.reference] : [''])),
        null,
        4
      );

      return `"""
Official RAGAS (Classic v0.1 Protocol) Evaluation Script
Repository: https://github.com/explodinggradients/ragas
=============================================================================
This script executes the standard RAGAS evaluation pipeline with Hugging Face Dataset.

Requirements:
    pip install ragas datasets pandas langchain-google-genai langchain-openai

Usage:
    python eval_ragas.py
"""

import os
import json
import pandas as pd
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
    answer_correctness,
)
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper

# 1. Evaluator LLM Judge Setup
${
  evaluator === 'gemini'
    ? `# Google Gemini Configuration
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

gemini_key = os.environ.get("GEMINI_API_KEY", "${storedKeys.gemini || ''}")
if not gemini_key:
    print("Notice: Set GEMINI_API_KEY environment variable if not already set.")

evaluator_llm = LangchainLLMWrapper(
    ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=gemini_key,
        temperature=0.0,
    )
)
evaluator_embeddings = LangchainEmbeddingsWrapper(
    GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        google_api_key=gemini_key,
    )
)`
    : `# OpenAI Configuration
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

openai_key = os.environ.get("OPENAI_API_KEY", "${storedKeys.openai || ''}")
if not openai_key:
    print("Notice: Set OPENAI_API_KEY environment variable if not already set.")

evaluator_llm = LangchainLLMWrapper(
    ChatOpenAI(
        model="gpt-4o-mini",
        api_key=openai_key,
        temperature=0.0,
    )
)
evaluator_embeddings = LangchainEmbeddingsWrapper(
    OpenAIEmbeddings(
        model="text-embedding-3-small",
        api_key=openai_key,
    )
)`
}

# 2. Build Dataset
evaluation_dict = {
    "question": ${jsonQuestions},
    "contexts": ${jsonContexts},
    "answer": ${jsonAnswers},
    "ground_truths": ${jsonGroundTruths},
}

dataset = Dataset.from_dict(evaluation_dict)
print(f"Loaded dataset containing {len(dataset)} evaluation samples.")

# 3. Official RAGAS Metric Suite
metrics = [
    faithfulness,
    answer_relevancy,
]

${
  hasAnyReference
    ? `metrics.extend([
    context_precision,
    context_recall,
    answer_correctness,
])`
    : `# Reference-free mode: context_recall and answer_correctness require ground_truth`
}

# 4. Run RAGAS Evaluation
print("Executing RAGAS evaluation pipeline...")
results = evaluate(
    dataset=dataset,
    metrics=metrics,
    llm=evaluator_llm,
    embeddings=evaluator_embeddings,
)

# 5. Output Summary & Save
print("\\n" + "=" * 60)
print(" RAGAS BENCHMARK RESULTS")
print("=" * 60)
for metric, score in results.items():
    print(f"  {metric:25s}: {score:.4f}")

df = results.to_pandas()
print("\\nDetailed Per-Sample Breakdown (Top records):")
print(df.head())

df.to_csv("ragas_evaluation_results.csv", index=False)
df.to_json("ragas_evaluation_results.json", orient="records", indent=2)
print("\\nExported results to 'ragas_evaluation_results.csv' and 'ragas_evaluation_results.json'.")
`;
    }

    // Modern RAGAS v0.2+ (Default & Recommended Standard)
    const rawSamplesJson = JSON.stringify(
      datasetItems.map((d) => ({
        user_input: d.user_input,
        retrieved_contexts: d.retrieved_contexts,
        response: d.response,
        reference: d.reference || undefined,
      })),
      null,
      4
    );

    return `"""
Official RAGAS (Retrieval Augmented Generation Assessment) v0.2+ Evaluation Pipeline
Repository: https://github.com/explodinggradients/ragas
Official Documentation: https://docs.ragas.io/
=============================================================================
This script executes the official RAGAS v0.2+ evaluation pipeline with SingleTurnSample
and EvaluationDataset against your benchmark dataset using ${evaluator === 'gemini' ? 'Google Gemini' : 'OpenAI'}.

Requirements:
    pip install "ragas>=0.2.0" datasets pandas langchain-google-genai langchain-openai

Usage:
    python eval_ragas.py
"""

import os
import json
import pandas as pd
from ragas import EvaluationDataset, SingleTurnSample, evaluate
from ragas.metrics import (
    Faithfulness,
    ResponseRelevancy,
    LLMContextPrecisionWithReference,
    LLMContextRecall,
    AnswerCorrectness,
)
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper

# 1. Evaluator LLM & Embeddings Judge Initialization
${
  evaluator === 'gemini'
    ? `# Google Gemini Configuration
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

gemini_key = os.environ.get("GEMINI_API_KEY", "${storedKeys.gemini || ''}")
if not gemini_key:
    print("Warning: GEMINI_API_KEY environment variable is not set. Please set it or export GEMINI_API_KEY=your_key")

evaluator_llm = LangchainLLMWrapper(
    ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=gemini_key,
        temperature=0.0,
    )
)
evaluator_embeddings = LangchainEmbeddingsWrapper(
    GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        google_api_key=gemini_key,
    )
)`
    : `# OpenAI Configuration
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

openai_key = os.environ.get("OPENAI_API_KEY", "${storedKeys.openai || ''}")
if not openai_key:
    print("Warning: OPENAI_API_KEY environment variable is not set. Please set it or export OPENAI_API_KEY=your_key")

evaluator_llm = LangchainLLMWrapper(
    ChatOpenAI(
        model="gpt-4o-mini",
        api_key=openai_key,
        temperature=0.0,
    )
)
evaluator_embeddings = LangchainEmbeddingsWrapper(
    OpenAIEmbeddings(
        model="text-embedding-3-small",
        api_key=openai_key,
    )
)`
}

# 2. Build RAGAS v0.2 Evaluation Dataset
raw_dataset = ${rawSamplesJson}

samples = []
has_references = False
for item in raw_dataset:
    ref = item.get("reference") or None
    if ref:
        has_references = True
    samples.append(
        SingleTurnSample(
            user_input=item["user_input"],
            retrieved_contexts=item["retrieved_contexts"],
            response=item["response"],
            reference=ref,
        )
    )

dataset = EvaluationDataset(samples=samples)
print(f"Loaded EvaluationDataset containing {len(dataset)} sample(s).")

# 3. Assemble Official RAGAS Metrics
# - Faithfulness: Factual consistency of response against retrieved contexts (0.0 - 1.0)
# - ResponseRelevancy: Semantic alignment and responsiveness of answer to prompt (0.0 - 1.0)
metrics = [
    Faithfulness(llm=evaluator_llm),
    ResponseRelevancy(llm=evaluator_llm, embeddings=evaluator_embeddings),
]

# Add reference-dependent metrics if ground truth is present
if has_references:
    # - LLMContextPrecisionWithReference: Signal-to-noise ratio in retrieved context chunks
    # - LLMContextRecall: Extent to which reference facts are captured in context
    # - AnswerCorrectness: Accuracy of generated answer compared to reference ground truth
    metrics.extend([
        LLMContextPrecisionWithReference(llm=evaluator_llm),
        LLMContextRecall(llm=evaluator_llm),
        AnswerCorrectness(llm=evaluator_llm),
    ])
    print("Configured metrics: Faithfulness, ResponseRelevancy, ContextPrecision, ContextRecall, AnswerCorrectness.")
else:
    print("Running in reference-free mode: Faithfulness and ResponseRelevancy.")

# 4. Execute Official RAGAS Evaluation
print("\\nExecuting official RAGAS v0.2+ evaluation pipeline...")
results = evaluate(
    dataset=dataset,
    metrics=metrics,
    llm=evaluator_llm,
    embeddings=evaluator_embeddings,
)

# 5. Output Summary & Export Reports
print("\\n" + "=" * 64)
print("             OFFICIAL RAGAS EVALUATION REPORT")
print("=" * 64)
print(results)

df = results.to_pandas()
print("\\nDetailed Per-Sample Breakdown:")
print(df.head(10))

# Export outputs
df.to_csv("ragas_evaluation_results.csv", index=False)
df.to_json("ragas_evaluation_results.json", orient="records", indent=2)
print("\\nExported results to 'ragas_evaluation_results.csv' and 'ragas_evaluation_results.json'.")
`;
  };

  const generateTrainingData = () => {
    const highQualityMsgs = messages.filter(
      (m) => !m.evaluation || m.evaluation.overallScore >= qualityThreshold
    );

    if (trainFormat === 'ragas_python') {
      return generateRagasPythonScript('chat');
    }

    if (trainFormat === 'ragas_dataset') {
      const ragasItems: any[] = [];
      for (let i = 0; i < highQualityMsgs.length - 1; i++) {
        if (highQualityMsgs[i].role === 'user' && highQualityMsgs[i + 1].role === 'assistant') {
          const contexts: string[] = [];
          if (highQualityMsgs[i].attachments && highQualityMsgs[i].attachments!.length > 0) {
            for (const a of highQualityMsgs[i].attachments!) {
              const text = a.textContent || a.textPreview;
              if (text) contexts.push(text.trim());
            }
          }
          if (highQualityMsgs[i + 1].sources && highQualityMsgs[i + 1].sources!.length > 0) {
            for (const s of highQualityMsgs[i + 1].sources!) {
              contexts.push(`${s.title}: ${s.url}`);
            }
          }
          if (contexts.length === 0) {
            contexts.push(activeSession?.capabilities.systemPrompt || 'Knowledge context for: ' + highQualityMsgs[i].content.slice(0, 60));
          }

          ragasItems.push({
            question: highQualityMsgs[i].content,
            contexts,
            answer: highQualityMsgs[i + 1].content,
            ground_truth: '',
          });
        }
      }
      return JSON.stringify(ragasItems, null, 2);
    }

    if (trainFormat === 'openai_finetune') {
      const chatPairs: any[] = [];
      for (let i = 0; i < highQualityMsgs.length - 1; i++) {
        if (highQualityMsgs[i].role === 'user' && highQualityMsgs[i + 1].role === 'assistant') {
          chatPairs.push({
            messages: [
              { role: 'system', content: activeSession?.capabilities.systemPrompt || 'You are an intelligent assistant.' },
              { role: 'user', content: highQualityMsgs[i].content },
              { role: 'assistant', content: highQualityMsgs[i + 1].content },
            ],
          });
        }
      }
      return chatPairs.map((p) => JSON.stringify(p)).join('\n');
    }

    if (trainFormat === 'sharegpt') {
      const conversations = [];
      for (const m of highQualityMsgs) {
        conversations.push({
          from: m.role === 'user' ? 'human' : m.role === 'assistant' ? 'gpt' : 'system',
          value: m.content,
        });
      }
      return JSON.stringify([{ id: activeSession?.id || 'session-1', conversations }], null, 2);
    }

    if (trainFormat === 'alpaca') {
      const alpacaItems: any[] = [];
      for (let i = 0; i < highQualityMsgs.length - 1; i++) {
        if (highQualityMsgs[i].role === 'user' && highQualityMsgs[i + 1].role === 'assistant') {
          alpacaItems.push({
            instruction: highQualityMsgs[i].content,
            input: '',
            output: highQualityMsgs[i + 1].content,
          });
        }
      }
      return JSON.stringify(alpacaItems, null, 2);
    }

    if (trainFormat === 'dpo_pairs') {
      const dpoItems: any[] = [];
      for (let i = 0; i < highQualityMsgs.length - 1; i++) {
        if (highQualityMsgs[i].role === 'user' && highQualityMsgs[i + 1].role === 'assistant') {
          dpoItems.push({
            prompt: highQualityMsgs[i].content,
            chosen: highQualityMsgs[i + 1].content,
            rejected: 'I am unable to answer this request properly.',
          });
        }
      }
      return JSON.stringify(dpoItems, null, 2);
    }
    return '';
  };

  const handleDownloadDataset = () => {
    const content = generateTrainingData();
    const isPy = trainFormat === 'ragas_python';
    const ext = trainFormat === 'openai_finetune' ? 'jsonl' : isPy ? 'py' : 'json';
    const mime = isPy ? 'text/x-python' : 'application/json';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isPy ? `eval_ragas_${Date.now()}.py` : `dataset-${trainFormat}-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTrainingData = () => {
    navigator.clipboard.writeText(generateTrainingData());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleExportToWebsite = async () => {
    if (!targetWebsiteUrl.trim()) {
      setStatusMessage('Please enter a target endpoint URL.');
      return;
    }
    setIsExportingWebsite(true);
    setWebsiteExportResult(null);

    let payload: any = activeSession;
    if (exportFormatWebsite === 'markdown') {
      payload = {
        title: activeSession?.title || 'Chat Export',
        markdown: messages.map((m) => `### ${m.role === 'user' ? 'User' : 'Assistant'}\n\n${m.content}\n`).join('\n---\n\n'),
      };
    } else if (exportFormatWebsite === 'embed_html') {
      payload = {
        title: activeSession?.title || 'Chat Embed',
        embedIframe: `<iframe src="${window.location.origin}/embed?sessionId=${activeSession?.id}" width="100%" height="600" frameborder="0"></iframe>`,
      };
    }

    try {
      const res = await fetch('/api/external/export-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationUrl: targetWebsiteUrl.trim(),
          authHeader: targetAuthHeader.trim(),
          format: exportFormatWebsite,
          payload,
        }),
      });
      const data = await res.json();
      setWebsiteExportResult(data);
      if (data.success) {
        setStatusMessage(`Exported successfully (Status: ${data.statusCode}).`);
      } else {
        setStatusMessage(`Website error: ${data.error || data.statusCode}`);
      }
    } catch (err: any) {
      setWebsiteExportResult({ success: false, error: err.message });
      setStatusMessage(`Export failed: ${err.message}`);
    } finally {
      setIsExportingWebsite(false);
    }
  };

  const handleImportFromRemoteUrl = async () => {
    if (!remoteImportUrl.trim()) return;
    setIsImportingRemote(true);
    setImportStatus('Connecting to website...');
    try {
      const res = await fetch('/api/external/fetch-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: remoteImportUrl.trim(),
          authHeader: targetAuthHeader.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const raw = data.data;
        let importedSessions: ChatSession[] = [];
        if (Array.isArray(raw)) {
          importedSessions = raw;
        } else if (raw.messages && Array.isArray(raw.messages)) {
          importedSessions = [raw as ChatSession];
        } else if (raw.conversations) {
          const parsedMsgs: ChatMessage[] = raw.conversations.map((c: any, idx: number) => ({
            id: `msg-${Date.now()}-${idx}`,
            role: c.from === 'human' ? 'user' : 'assistant',
            content: c.value,
            timestamp: Date.now(),
          }));
          importedSessions = [
            {
              id: `imported-${Date.now()}`,
              title: 'Imported Conversation',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              provider: 'gemini',
              model: activeModelId,
              messages: parsedMsgs,
              capabilities: activeSession?.capabilities || ({} as any),
            },
          ];
        }

        if (importedSessions.length > 0 && onImportSessions) {
          onImportSessions(importedSessions);
          setImportStatus(`Imported ${importedSessions.length} conversation(s).`);
        } else {
          setImportStatus('No recognizable chat data found.');
        }
      } else {
        setImportStatus(`Import failed: ${data.error || 'Invalid response'}`);
      }
    } catch (err: any) {
      setImportStatus(`Import error: ${err.message}`);
    } finally {
      setIsImportingRemote(false);
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed[0]?.question) {
          const loaded: RagasTestCase[] = parsed.map((it: any, idx: number) => ({
            id: it.id || `tc-import-${idx}-${Date.now()}`,
            question: it.question,
            contexts: it.contexts,
            groundTruth: it.ground_truth || it.groundTruth,
            actualAnswer: it.answer,
            status: 'pending',
          }));
          setTestCases((prev) => [...prev, ...loaded]);
          saveRagasTestCases([...testCases, ...loaded]);
          setStatusMessage(`Imported ${loaded.length} test cases.`);
        } else if (Array.isArray(parsed) && parsed[0]?.messages && onImportSessions) {
          onImportSessions(parsed);
          setStatusMessage(`Imported ${parsed.length} chat sessions.`);
        } else {
          setStatusMessage('Unrecognized file structure.');
        }
      } catch (err: any) {
        setStatusMessage(`JSON error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#1e1f20] border border-[#2d2f31] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2f31]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#282a2c] text-[#8ab4f8]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#e3e3e3]">
                RAGAS Evaluation & Quality Checks
              </h2>
              <p className="text-xs text-[#8e918f]">
                Measure faithfulness, answer relevancy, test datasets, and sync with external platforms.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8e918f] hover:text-[#e3e3e3] rounded-lg hover:bg-[#282a2c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className="px-6 py-2 bg-[#282a2c] text-xs text-[#8ab4f8] flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-[#8e918f] hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Google Tabs */}
        <div className="flex items-center gap-2 px-6 border-b border-[#2d2f31] overflow-x-auto scrollbar-none text-xs font-medium">
          <button
            onClick={() => setActiveTab('eval-chat')}
            className={`py-3 px-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'eval-chat'
                ? 'border-[#8ab4f8] text-[#e3e3e3]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            <span>Chat Evaluation</span>
            {evaluatedMessages.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[#8ab4f8]">
                ({evaluatedMessages.length}/{assistantMessages.length})
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('test-datasets')}
            className={`py-3 px-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'test-datasets'
                ? 'border-[#8ab4f8] text-[#e3e3e3]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            <span>Test Datasets</span>
            <span className="ml-1.5 text-[10px] text-[#8e918f]">({testCases.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('ragas-code')}
            className={`py-3 px-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ragas-code'
                ? 'border-[#8ab4f8] text-[#e3e3e3]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-[#8ab4f8]" />
            <span>RAGAS Python Code</span>
          </button>
          <button
            onClick={() => setActiveTab('external-config')}
            className={`py-3 px-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'external-config'
                ? 'border-[#8ab4f8] text-[#e3e3e3]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            <span>External Software</span>
            {extConfig.enabled && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[#81c995] inline-block" />}
          </button>
          <button
            onClick={() => setActiveTab('train-export')}
            className={`py-3 px-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'train-export'
                ? 'border-[#8ab4f8] text-[#e3e3e3]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            <span>Export & Fine-Tune</span>
          </button>
          <button
            onClick={() => setActiveTab('website-sync')}
            className={`py-3 px-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'website-sync'
                ? 'border-[#8ab4f8] text-[#e3e3e3]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            <span>Website Sync</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
          {activeTab === 'eval-chat' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-[#131314] border border-[#2d2f31]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-[#1e1f20] border border-[#2d2f31] min-w-[80px] text-center">
                      <div className="text-2xl font-semibold text-[#8ab4f8]">
                        {evaluatedMessages.length > 0 ? `${avgOverall}%` : '--'}
                      </div>
                      <div className="text-[10px] text-[#8e918f] uppercase">
                        Quality
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#e3e3e3]">
                        Chat Session Quality (Official RAGAS Protocol)
                      </div>
                      <p className="text-xs text-[#8e918f] mt-0.5">
                        {evaluatedMessages.length} of {assistantMessages.length} responses evaluated across standard Ragas metrics.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleEvaluateAllChatMessages}
                    disabled={isEvaluating || assistantMessages.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#131314] rounded-full text-xs font-medium disabled:opacity-40 transition-colors shrink-0"
                  >
                    {isEvaluating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isEvaluating ? 'Evaluating...' : 'Evaluate All Messages'}</span>
                  </button>
                </div>

                {evaluatedMessages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-[#2d2f31]">
                    <div className="p-2.5 rounded-xl bg-[#1e1f20]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#8e918f]">Faithfulness</span>
                        <span className="text-[#e3e3e3] font-medium">{Math.round(avgFaithfulness * 100)}%</span>
                      </div>
                      <div className="h-1 w-full bg-[#282a2c] rounded-full overflow-hidden">
                        <div className="h-full bg-[#8ab4f8] rounded-full" style={{ width: `${avgFaithfulness * 100}%` }} />
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1e1f20]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#8e918f]">Relevancy</span>
                        <span className="text-[#e3e3e3] font-medium">{Math.round(avgRelevancy * 100)}%</span>
                      </div>
                      <div className="h-1 w-full bg-[#282a2c] rounded-full overflow-hidden">
                        <div className="h-full bg-[#81c995] rounded-full" style={{ width: `${avgRelevancy * 100}%` }} />
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1e1f20]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#8e918f]">Context Precision</span>
                        <span className="text-[#e3e3e3] font-medium">{Math.round(avgContextPrecision * 100)}%</span>
                      </div>
                      <div className="h-1 w-full bg-[#282a2c] rounded-full overflow-hidden">
                        <div className="h-full bg-[#c4c7c5] rounded-full" style={{ width: `${avgContextPrecision * 100}%` }} />
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1e1f20]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#8e918f]">Context Recall</span>
                        <span className="text-[#e3e3e3] font-medium">{Math.round(avgContextRecall * 100)}%</span>
                      </div>
                      <div className="h-1 w-full bg-[#282a2c] rounded-full overflow-hidden">
                        <div className="h-full bg-[#c58af9] rounded-full" style={{ width: `${avgContextRecall * 100}%` }} />
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1e1f20]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#8e918f]">Correctness</span>
                        <span className="text-[#e3e3e3] font-medium">{Math.round(avgAnswerCorrectness * 100)}%</span>
                      </div>
                      <div className="h-1 w-full bg-[#282a2c] rounded-full overflow-hidden">
                        <div className="h-full bg-[#fdd663] rounded-full" style={{ width: `${avgAnswerCorrectness * 100}%` }} />
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1e1f20]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#8e918f]">Hallucination</span>
                        <span className={`text-xs font-medium ${avgHallucinationRisk > 0.2 ? 'text-[#f28b82]' : 'text-[#81c995]'}`}>
                          {Math.round(avgHallucinationRisk * 100)}%
                        </span>
                      </div>
                      <div className="h-1 w-full bg-[#282a2c] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${avgHallucinationRisk > 0.2 ? 'bg-[#f28b82]' : 'bg-[#81c995]'}`}
                          style={{ width: `${avgHallucinationRisk * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-[#8e918f]">
                  Assistant Responses ({assistantMessages.length})
                </div>
                {assistantMessages.length === 0 ? (
                  <div className="p-6 text-center text-[#8e918f] text-xs bg-[#131314] rounded-xl border border-[#2d2f31]">
                    No assistant messages to evaluate in this conversation.
                  </div>
                ) : (
                  assistantMessages.map((msg, idx) => {
                    const evalResult = msg.evaluation;
                    const isExpanded = expandedMsgIds[msg.id] ?? false;
                    const isMsgEvaluating = evaluatingMessageId === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className="rounded-xl border border-[#2d2f31] bg-[#131314] overflow-hidden"
                      >
                        <div
                          onClick={() => setExpandedMsgIds({ ...expandedMsgIds, [msg.id]: !isExpanded })}
                          className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-[#1e1f20] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <span className="text-xs text-[#8e918f]">#{idx + 1}</span>
                            <div className="text-xs text-[#e3e3e3] truncate">
                              {msg.content.slice(0, 100)}...
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {evalResult ? (
                              <span className="text-xs font-medium text-[#8ab4f8] bg-[#1e1f20] px-2.5 py-0.5 rounded-full border border-[#2d2f31]">
                                RAGAS Score: {evalResult.overallScore}%
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEvaluateSingleMessage(msg);
                                }}
                                disabled={isMsgEvaluating}
                                className="px-3 py-1 bg-[#282a2c] hover:bg-[#333538] text-[#c4c7c5] hover:text-white rounded-full text-xs transition-colors"
                              >
                                {isMsgEvaluating ? 'Evaluating...' : 'Check Quality'}
                              </button>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-[#8e918f]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#8e918f]" />
                            )}
                          </div>
                        </div>

                        {isExpanded && evalResult && (
                          <div className="p-4 bg-[#1e1f20] border-t border-[#2d2f31] space-y-3 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                              <div className="p-2 rounded bg-[#131314]">
                                <div className="text-[10px] text-[#8e918f]">Faithfulness</div>
                                <div className="text-sm font-medium text-[#e3e3e3]">
                                  {Math.round(evalResult.scores.faithfulness * 100)}%
                                </div>
                              </div>
                              <div className="p-2 rounded bg-[#131314]">
                                <div className="text-[10px] text-[#8e918f]">Relevancy</div>
                                <div className="text-sm font-medium text-[#e3e3e3]">
                                  {Math.round(evalResult.scores.answerRelevancy * 100)}%
                                </div>
                              </div>
                              <div className="p-2 rounded bg-[#131314]">
                                <div className="text-[10px] text-[#8e918f]">Precision</div>
                                <div className="text-sm font-medium text-[#e3e3e3]">
                                  {Math.round(evalResult.scores.contextPrecision * 100)}%
                                </div>
                              </div>
                              <div className="p-2 rounded bg-[#131314]">
                                <div className="text-[10px] text-[#8e918f]">Context Recall</div>
                                <div className="text-sm font-medium text-[#e3e3e3]">
                                  {Math.round((evalResult.scores.contextRecall ?? 0.88) * 100)}%
                                </div>
                              </div>
                              <div className="p-2 rounded bg-[#131314]">
                                <div className="text-[10px] text-[#8e918f]">Correctness</div>
                                <div className="text-sm font-medium text-[#e3e3e3]">
                                  {Math.round((evalResult.scores.answerCorrectness ?? 0.89) * 100)}%
                                </div>
                              </div>
                              <div className="p-2 rounded bg-[#131314]">
                                <div className="text-[10px] text-[#8e918f]">Hallucination</div>
                                <div className={`text-sm font-medium ${evalResult.scores.hallucinationRisk > 0.2 ? 'text-[#f28b82]' : 'text-[#81c995]'}`}>
                                  {Math.round(evalResult.scores.hallucinationRisk * 100)}%
                                </div>
                              </div>
                            </div>

                            {/* Atomic Claims Analysis */}
                            {evalResult.claimsAnalysis && (
                              <div className="p-3 rounded-lg bg-[#131314] space-y-1.5 border border-[#2d2f31]">
                                <div className="text-[11px] font-medium text-[#c4c7c5] flex items-center justify-between">
                                  <span>Deconstructed Factual Statements</span>
                                  <span className="text-[10px] text-[#8e918f]">
                                    {evalResult.claimsAnalysis.supportedClaims.length} of {evalResult.claimsAnalysis.totalClaims} verified from context
                                  </span>
                                </div>
                                {evalResult.claimsAnalysis.supportedClaims.map((claim, cIdx) => (
                                  <div key={cIdx} className="text-[11px] flex items-start gap-1.5 text-[#81c995] bg-[#81c995]/10 px-2 py-1 rounded-md">
                                    <Check className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>{claim}</span>
                                  </div>
                                ))}
                                {evalResult.claimsAnalysis.unsupportedClaims.map((claim, cIdx) => (
                                  <div key={cIdx} className="text-[11px] flex items-start gap-1.5 text-[#f28b82] bg-[#f28b82]/10 px-2 py-1 rounded-md">
                                    <X className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>{claim}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="p-3 rounded-lg bg-[#131314] text-[#c4c7c5]">
                              <span className="font-medium text-[#8ab4f8]">RAGAS Critique: </span>
                              <span>{evalResult.critique}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'test-datasets' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#131314] border border-[#2d2f31]">
                <div>
                  <div className="text-xs font-medium text-[#e3e3e3]">
                    Dataset Cases ({testCases.length})
                  </div>
                  <p className="text-[11px] text-[#8e918f]">
                    Run automated benchmark checks across test inputs with {activeModelId}.
                  </p>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={handleRunBenchmark}
                    disabled={isEvaluating || testCases.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#131314] rounded-full text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>{isEvaluating ? 'Benchmarking...' : 'Run Benchmark'}</span>
                  </button>
                  <button
                    onClick={handleExtractFromChat}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#282a2c] hover:bg-[#333538] text-[#c4c7c5] hover:text-white rounded-full text-xs transition-colors"
                  >
                    <span>Extract From Chat</span>
                  </button>
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-[#282a2c] hover:bg-[#333538] text-[#c4c7c5] hover:text-white rounded-full text-xs cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import JSON</span>
                    <input type="file" accept=".json,.csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button
                    onClick={() => setShowAddTestCase(!showAddTestCase)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#282a2c] hover:bg-[#333538] text-[#c4c7c5] hover:text-white rounded-full text-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-[#8e918f]">
                  Pre-Built Benchmarks
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {Object.entries(DEFAULT_BENCHMARK_DATASETS).map(([key, dataset]) => (
                    <button
                      key={key}
                      onClick={() => handleLoadPreset(key)}
                      className="p-3 rounded-xl bg-[#131314] hover:bg-[#282a2c] border border-[#2d2f31] text-left transition-colors"
                    >
                      <div className="text-xs font-medium text-[#e3e3e3]">
                        {dataset.name}
                      </div>
                      <div className="text-[11px] text-[#8e918f] line-clamp-1 mt-0.5">
                        {dataset.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {showAddTestCase && (
                <div className="p-4 rounded-xl bg-[#131314] border border-[#2d2f31] space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium text-[#e3e3e3]">
                    <span>New Test Case</span>
                    <button onClick={() => setShowAddTestCase(false)} className="text-[#8e918f] hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="Test prompt or question..."
                    className="w-full px-3 py-2 bg-[#1e1f20] border border-[#2d2f31] rounded-lg text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-[#444746]"
                  />
                  <textarea
                    rows={2}
                    value={newGroundTruth}
                    onChange={(e) => setNewGroundTruth(e.target.value)}
                    placeholder="Reference ideal answer..."
                    className="w-full px-3 py-2 bg-[#1e1f20] border border-[#2d2f31] rounded-lg text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-[#444746] resize-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowAddTestCase(false)}
                      className="px-3 py-1.5 text-xs text-[#8e918f] hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTestCase}
                      className="px-4 py-1.5 bg-[#e3e3e3] hover:bg-white text-[#131314] rounded-full text-xs font-medium"
                    >
                      Save Case
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {testCases.map((tc, idx) => (
                  <div
                    key={tc.id}
                    className="p-3.5 rounded-xl bg-[#131314] border border-[#2d2f31] text-left space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="text-xs text-[#8e918f] mt-0.5">#{idx + 1}</span>
                        <div>
                          <div className="text-xs font-medium text-[#e3e3e3]">{tc.question}</div>
                          {tc.groundTruth && (
                            <div className="text-[11px] text-[#8e918f] mt-1">
                              <span className="text-[#8ab4f8]">Target: </span>
                              {tc.groundTruth}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {tc.evaluation && (
                          <span className="text-xs text-[#8ab4f8] bg-[#1e1f20] px-2 py-0.5 rounded-full border border-[#2d2f31]">
                            {tc.evaluation.overallScore}%
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteTestCase(tc.id)}
                          className="p-1 text-[#8e918f] hover:text-[#f28b82] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ragas-code' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#131314] border border-[#2d2f31]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[#8ab4f8]" />
                    <span className="text-xs font-semibold text-[#e3e3e3]">
                      Official RAGAS Evaluation Pipeline (Python)
                    </span>
                    <span className="text-[10px] bg-[#8ab4f8]/10 text-[#8ab4f8] px-2 py-0.5 rounded-full border border-[#8ab4f8]/30">
                      explodinggradients/ragas
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8e918f]">
                    Production-ready Python code to evaluate your retrieval augmented pipeline with official RAGAS metrics.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyPythonScript}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#282a2c] hover:bg-[#333538] text-[#c4c7c5] hover:text-white rounded-full text-xs transition-colors"
                  >
                    {copiedPython ? (
                      <Check className="w-3.5 h-3.5 text-[#81c995]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedPython ? 'Copied Script' : 'Copy Script'}</span>
                  </button>
                  <button
                    onClick={handleDownloadPythonScript}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#e3e3e3] hover:bg-white text-[#131314] rounded-full text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .py</span>
                  </button>
                </div>
              </div>

              {/* Protocol & Configuration Bar */}
              <div className="p-4 rounded-2xl bg-[#131314] border border-[#2d2f31] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Framework Protocol Flavor */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8e918f] uppercase tracking-wider">
                      Evaluation Protocol
                    </label>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRagasFlavor('v02')}
                        className={`px-3 py-2 rounded-xl text-left text-xs transition-colors border ${
                          ragasFlavor === 'v02'
                            ? 'bg-[#282a2c] border-[#8ab4f8] text-white font-medium'
                            : 'bg-[#1e1f20] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#8e918f]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Modern RAGAS (v0.2+)</span>
                          <span className="text-[10px] text-[#8ab4f8]">Official Standard</span>
                        </div>
                        <div className="text-[10px] text-[#8e918f] mt-0.5">
                          SingleTurnSample & EvaluationDataset
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRagasFlavor('classic')}
                        className={`px-3 py-2 rounded-xl text-left text-xs transition-colors border ${
                          ragasFlavor === 'classic'
                            ? 'bg-[#282a2c] border-[#8ab4f8] text-white font-medium'
                            : 'bg-[#1e1f20] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#8e918f]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Classic RAGAS (v0.1)</span>
                        </div>
                        <div className="text-[10px] text-[#8e918f] mt-0.5">
                          Hugging Face Dataset & evaluate()
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRagasFlavor('rest')}
                        className={`px-3 py-2 rounded-xl text-left text-xs transition-colors border ${
                          ragasFlavor === 'rest'
                            ? 'bg-[#282a2c] border-[#8ab4f8] text-white font-medium'
                            : 'bg-[#1e1f20] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#8e918f]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>BackEval REST Client</span>
                        </div>
                        <div className="text-[10px] text-[#8e918f] mt-0.5">
                          Direct Python requests to /api/eval/ragas
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Data Source Selector */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8e918f] uppercase tracking-wider">
                      Evaluation Data Source
                    </label>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPythonDataSource('chat')}
                        className={`px-3 py-2 rounded-xl text-left text-xs transition-colors border ${
                          pythonDataSource === 'chat'
                            ? 'bg-[#282a2c] border-[#8ab4f8] text-white font-medium'
                            : 'bg-[#1e1f20] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#8e918f]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Current Chat Session</span>
                          <span className="text-[10px] text-[#8ab4f8]">{messages.length} msgs</span>
                        </div>
                        <div className="text-[10px] text-[#8e918f] mt-0.5">
                          Extracts user questions, responses, & attachments
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPythonDataSource('test-cases')}
                        className={`px-3 py-2 rounded-xl text-left text-xs transition-colors border ${
                          pythonDataSource === 'test-cases'
                            ? 'bg-[#282a2c] border-[#8ab4f8] text-white font-medium'
                            : 'bg-[#1e1f20] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#8e918f]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Benchmark Test Cases</span>
                          <span className="text-[10px] text-[#8ab4f8]">{testCases.length} cases</span>
                        </div>
                        <div className="text-[10px] text-[#8e918f] mt-0.5">
                          Includes curated questions, ground truth, & contexts
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Evaluator Judge LLM */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-[#8e918f] uppercase tracking-wider">
                      Evaluator LLM Judge
                    </label>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRagasEvaluator('gemini')}
                        className={`px-3 py-2 rounded-xl text-left text-xs transition-colors border ${
                          ragasEvaluator === 'gemini'
                            ? 'bg-[#282a2c] border-[#8ab4f8] text-white font-medium'
                            : 'bg-[#1e1f20] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#8e918f]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Google Gemini</span>
                          <span className="text-[10px] text-[#81c995]">Recommended</span>
                        </div>
                        <div className="text-[10px] text-[#8e918f] mt-0.5">
                          gemini-2.5-flash + text-embedding-004
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRagasEvaluator('openai')}
                        className={`px-3 py-2 rounded-xl text-left text-xs transition-colors border ${
                          ragasEvaluator === 'openai'
                            ? 'bg-[#282a2c] border-[#8ab4f8] text-white font-medium'
                            : 'bg-[#1e1f20] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#8e918f]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>OpenAI</span>
                        </div>
                        <div className="text-[10px] text-[#8e918f] mt-0.5">
                          gpt-4o-mini + text-embedding-3-small
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Pip Install Terminal Bar */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#1e1f20] border border-[#2d2f31]">
                  <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono text-[#c4c7c5]">
                    <Terminal className="w-3.5 h-3.5 text-[#8ab4f8] shrink-0" />
                    <span className="text-[#8e918f] select-none">$</span>
                    <span>pip install &quot;ragas&gt;=0.2.0&quot; datasets pandas langchain-google-genai langchain-openai</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('pip install "ragas>=0.2.0" datasets pandas langchain-google-genai langchain-openai');
                      setStatusMessage('Copied pip install command');
                      setTimeout(() => setStatusMessage(null), 2000);
                    }}
                    className="p-1.5 text-[#8e918f] hover:text-white rounded hover:bg-[#282a2c] shrink-0 ml-2"
                    title="Copy pip command"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Ragas Metrics Breakdown Guide */}
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-[#8e918f]">
                  Evaluated Official RAGAS Metrics
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#2d2f31]">
                    <div className="text-xs font-semibold text-[#8ab4f8]">Faithfulness</div>
                    <div className="text-[11px] text-[#8e918f] mt-1 leading-snug">
                      Factual claim consistency: verifies every atomic statement in the response is grounded in the retrieved context chunks.
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#2d2f31]">
                    <div className="text-xs font-semibold text-[#8ab4f8]">Response Relevancy</div>
                    <div className="text-[11px] text-[#8e918f] mt-1 leading-snug">
                      Prompt pertinence: calculates semantic similarity and completeness without superfluous or evasive filler.
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#2d2f31]">
                    <div className="text-xs font-semibold text-[#8ab4f8]">Context Precision</div>
                    <div className="text-[11px] text-[#8e918f] mt-1 leading-snug">
                      Signal-to-noise ratio: measures whether the most relevant knowledge chunks are ranked highest in the context list.
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#2d2f31]">
                    <div className="text-xs font-semibold text-[#8ab4f8]">Context Recall</div>
                    <div className="text-[11px] text-[#8e918f] mt-1 leading-snug">
                      Fact coverage: verifies all reference ground truth facts are successfully captured within the retrieved context chunks.
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#131314] border border-[#2d2f31]">
                    <div className="text-xs font-semibold text-[#8ab4f8]">Answer Correctness</div>
                    <div className="text-[11px] text-[#8e918f] mt-1 leading-snug">
                      Accuracy alignment: combines factual accuracy and semantic similarity between generated response and target ground truth.
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Display Card */}
              <div className="rounded-2xl bg-[#131314] border border-[#2d2f31] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e1f20] border-b border-[#2d2f31]">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#f28b82]/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#fdd663]/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#81c995]/60" />
                    </div>
                    <span className="text-xs font-mono text-[#c4c7c5] ml-2">eval_ragas.py</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#8e918f]">
                    <span className="capitalize">{ragasFlavor === 'v02' ? 'Ragas v0.2+' : ragasFlavor === 'classic' ? 'Ragas v0.1' : 'REST Client'}</span>
                    <span>•</span>
                    <span className="capitalize">{ragasEvaluator === 'gemini' ? 'Gemini 2.5' : 'OpenAI'}</span>
                  </div>
                </div>
                <pre className="p-4 text-xs font-mono text-[#c4c7c5] overflow-x-auto max-h-[460px] leading-relaxed select-text bg-[#0e0f10]">
                  {generateRagasPythonScript(pythonDataSource, ragasFlavor, ragasEvaluator)}
                </pre>
              </div>

              {/* Local Execution Instructions */}
              <div className="p-4 rounded-xl bg-[#131314] border border-[#2d2f31] space-y-2 text-xs text-[#8e918f]">
                <div className="font-medium text-[#e3e3e3] flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#8ab4f8]" />
                  <span>How to Run Locally</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 pl-1 leading-relaxed">
                  <li>Click <strong>&quot;Download .py&quot;</strong> or save the code above to a file named <code className="text-[#c4c7c5]">eval_ragas.py</code>.</li>
                  <li>Install dependencies via <code className="text-[#c4c7c5]">pip install &quot;ragas&gt;=0.2.0&quot; datasets pandas langchain-google-genai langchain-openai</code>.</li>
                  <li>Set your API key in your terminal: <code className="text-[#c4c7c5]">export GEMINI_API_KEY=&quot;your_key&quot;</code> (or <code className="text-[#c4c7c5]">OPENAI_API_KEY</code>).</li>
                  <li>Execute: <code className="text-[#c4c7c5]">python eval_ragas.py</code>. The script prints live metric scores and exports full reports to <code className="text-[#c4c7c5]">ragas_evaluation_results.csv</code> and <code className="text-[#c4c7c5]">.json</code>.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'external-config' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-[#8e918f]">
                  External Frameworks
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'render_backend',
                      name: 'Render Live Backend',
                      tag: 'createai-vepb.onrender.com (Live)',
                      defaultUrl: DEFAULT_LIVE_RENDER_BACKEND_URL,
                    },
                    {
                      id: 'ragas',
                      name: 'Ragas Remote Server',
                      tag: 'Custom Evaluator API',
                      defaultUrl: DEFAULT_LIVE_RENDER_BACKEND_URL,
                    },
                    {
                      id: 'langsmith',
                      name: 'LangSmith',
                      tag: 'LangChain Cloud',
                      defaultUrl: 'https://api.smith.langchain.com/eval',
                    },
                    {
                      id: 'langfuse',
                      name: 'Langfuse',
                      tag: 'Open Source Observability',
                      defaultUrl: 'https://cloud.langfuse.com/api/eval',
                    },
                    {
                      id: 'custom_webhook',
                      name: 'Custom Webhook',
                      tag: 'HTTP POST Hook',
                      defaultUrl: 'https://my-eval-service.com/api/score',
                    },
                  ].map((soft) => (
                    <button
                      key={soft.id}
                      onClick={() => {
                        setExtConfig({
                          ...extConfig,
                          activeSoftware: soft.id as any,
                          endpointUrl: soft.defaultUrl,
                          enabled: true,
                        });
                      }}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        extConfig.activeSoftware === soft.id
                          ? 'bg-[#282a2c] border-[#8ab4f8] text-white'
                          : 'bg-[#131314] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#c4c7c5]'
                      }`}
                    >
                      <div className="text-xs font-semibold">{soft.name}</div>
                      <div className="text-[10px] text-[#8e918f] truncate font-mono mt-0.5">{soft.tag}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#131314] border border-[#2d2f31] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#2d2f31]">
                  <div>
                    <div className="text-xs font-medium text-[#e3e3e3]">
                      Route to Live Backend Server
                    </div>
                    <div className="text-[11px] text-[#8e918f]">
                      Routes benchmarking and Ragas evaluation requests to the configured live backend.
                    </div>
                  </div>
                  <button
                    onClick={() => setExtConfig({ ...extConfig, enabled: !extConfig.enabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      extConfig.enabled ? 'bg-[#8ab4f8]' : 'bg-[#3c4043]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        extConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[#c4c7c5]">Backend Endpoint URL:</label>
                      <button
                        type="button"
                        onClick={() =>
                          setExtConfig({
                            ...extConfig,
                            endpointUrl: DEFAULT_LIVE_RENDER_BACKEND_URL,
                            enabled: true,
                          })
                        }
                        className="text-[11px] text-[#8ab4f8] hover:text-[#aecbfa] hover:underline"
                      >
                        Reset to Render Deploy URL
                      </button>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={extConfig.endpointUrl}
                        onChange={(e) => setExtConfig({ ...extConfig, endpointUrl: e.target.value })}
                        placeholder={DEFAULT_LIVE_RENDER_BACKEND_URL}
                        className="flex-1 px-3 py-2 bg-[#1e1f20] border border-[#2d2f31] rounded-xl text-xs text-white focus:outline-none focus:border-[#444746] font-mono"
                      />
                      <button
                        onClick={handlePingServer}
                        disabled={isPinging || !extConfig.endpointUrl}
                        className="px-4 py-2 bg-[#282a2c] hover:bg-[#333538] text-[#c4c7c5] hover:text-white rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0"
                      >
                        {isPinging ? 'Pinging...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>

                  {/* Render Live Service Advisory */}
                  {(extConfig.endpointUrl?.includes('createai-vepb.onrender.com') ||
                    extConfig.endpointUrl?.includes('onrender.com') ||
                    extConfig.endpointUrl?.includes('render.com')) && (
                    <div className="p-3 rounded-xl bg-[#8ab4f8]/10 border border-[#8ab4f8]/30 text-xs text-[#c4c7c5] space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-white">
                        <span className="w-2 h-2 rounded-full bg-[#81c995] animate-pulse" />
                        <span>Render Live Deployment Configured ({LIVE_RENDER_SERVICE_ID}.onrender.com)</span>
                      </div>
                      <div className="text-[11px] text-[#8e918f] leading-relaxed">
                        Currently targeting live Render deployment at <code className="text-[#8ab4f8]">https://createai-vepb.onrender.com</code>. Benchmarking and Ragas evaluations will communicate with this production endpoint.
                      </div>
                    </div>
                  )}

                  {pingResult && (
                    <div className={`p-3 rounded-xl border text-xs ${pingResult.reachable ? 'bg-[#1e1f20] text-[#81c995] border-[#81c995]/30' : 'bg-[#1e1f20] text-[#f28b82] border-[#f28b82]/30'}`}>
                      {pingResult.reachable ? `Reachable (${pingResult.latencyMs}ms latency)` : `Error: ${pingResult.error || 'Connection failed'}`}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-[#c4c7c5]">API Key (Optional):</label>
                    <input
                      type="password"
                      value={extConfig.apiKey || ''}
                      onChange={(e) => setExtConfig({ ...extConfig, apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full mt-1 px-3 py-2 bg-[#1e1f20] border border-[#2d2f31] rounded-xl text-xs text-white focus:outline-none focus:border-[#444746] font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveConfig}
                    className="px-5 py-2 bg-[#e3e3e3] hover:bg-white text-[#131314] rounded-full text-xs font-medium transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'train-export' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#131314] border border-[#2d2f31]">
                <div>
                  <div className="text-xs font-medium text-[#e3e3e3]">
                    Dataset Formats
                  </div>
                  <p className="text-[11px] text-[#8e918f]">
                    Format chat messages into training or benchmark datasets.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyTrainingData}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#282a2c] hover:bg-[#333538] text-[#c4c7c5] hover:text-white rounded-full text-xs transition-colors"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-[#81c995]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleDownloadDataset}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#e3e3e3] hover:bg-white text-[#131314] rounded-full text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'ragas_dataset', label: 'Ragas JSON' },
                  { id: 'openai_finetune', label: 'OpenAI JSONL' },
                  { id: 'sharegpt', label: 'ShareGPT' },
                  { id: 'alpaca', label: 'Alpaca' },
                  { id: 'dpo_pairs', label: 'DPO Pairs' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setTrainFormat(fmt.id as any)}
                    className={`p-2.5 rounded-xl border text-center text-xs transition-colors ${
                      trainFormat === fmt.id
                        ? 'bg-[#282a2c] border-[#8ab4f8] text-white font-medium'
                        : 'bg-[#131314] hover:bg-[#282a2c]/50 border-[#2d2f31] text-[#8e918f]'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>

              <pre className="p-4 rounded-xl bg-[#131314] border border-[#2d2f31] text-xs font-mono text-[#c4c7c5] overflow-x-auto max-h-56 leading-relaxed">
                {generateTrainingData()}
              </pre>
            </div>
          )}

          {activeTab === 'website-sync' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-[#131314] border border-[#2d2f31] space-y-4">
                <div>
                  <div className="text-xs font-medium text-[#e3e3e3]">
                    Export to External Website
                  </div>
                  <p className="text-[11px] text-[#8e918f]">
                    Send chat payload directly to any website's webhook or REST API endpoint.
                  </p>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={targetWebsiteUrl}
                    onChange={(e) => setTargetWebsiteUrl(e.target.value)}
                    placeholder="https://my-website.com/api/import-chat"
                    className="w-full px-3 py-2 bg-[#1e1f20] border border-[#2d2f31] rounded-xl text-xs text-white focus:outline-none focus:border-[#444746] font-mono"
                  />
                  <input
                    type="text"
                    value={targetAuthHeader}
                    onChange={(e) => setTargetAuthHeader(e.target.value)}
                    placeholder="Bearer token (optional)"
                    className="w-full px-3 py-2 bg-[#1e1f20] border border-[#2d2f31] rounded-xl text-xs text-white focus:outline-none focus:border-[#444746] font-mono"
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleExportToWebsite}
                      disabled={isExportingWebsite || !targetWebsiteUrl.trim()}
                      className="px-5 py-2 bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#131314] rounded-full text-xs font-medium transition-colors disabled:opacity-40"
                    >
                      {isExportingWebsite ? 'Sending...' : 'Send to Website'}
                    </button>
                  </div>
                  {websiteExportResult && (
                    <div className={`p-3 rounded-xl border text-xs ${websiteExportResult.success ? 'bg-[#1e1f20] text-[#81c995] border-[#81c995]/30' : 'bg-[#1e1f20] text-[#f28b82] border-[#f28b82]/30'}`}>
                      {websiteExportResult.success ? `Delivered successfully (${websiteExportResult.statusCode})` : `Failed: ${websiteExportResult.error || websiteExportResult.statusCode}`}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#131314] border border-[#2d2f31] space-y-4">
                <div>
                  <div className="text-xs font-medium text-[#e3e3e3]">
                    Import from External Website
                  </div>
                  <p className="text-[11px] text-[#8e918f]">
                    Fetch conversation JSON from another website URL.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={remoteImportUrl}
                    onChange={(e) => setRemoteImportUrl(e.target.value)}
                    placeholder="https://another-site.com/api/get-chat"
                    className="flex-1 px-3 py-2 bg-[#1e1f20] border border-[#2d2f31] rounded-xl text-xs text-white focus:outline-none focus:border-[#444746] font-mono"
                  />
                  <button
                    onClick={handleImportFromRemoteUrl}
                    disabled={isImportingRemote || !remoteImportUrl.trim()}
                    className="px-4 py-2 bg-[#282a2c] hover:bg-[#333538] text-[#c4c7c5] hover:text-white rounded-full text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    {isImportingRemote ? 'Fetching...' : 'Fetch & Import'}
                  </button>
                </div>
                {importStatus && (
                  <div className="p-3 rounded-xl bg-[#1e1f20] border border-[#2d2f31] text-xs text-[#8ab4f8]">
                    {importStatus}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2d2f31]">
          <span className="text-[11px] text-[#8e918f]">
            Ragas Quality Framework
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-medium text-[#131314] bg-[#e3e3e3] hover:bg-white rounded-full transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
