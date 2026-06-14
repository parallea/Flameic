'use client';
import React, { useState } from 'react';
import {
  X,
  FileCode,
  ChevronDown,
  Send,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Pipeline } from './PipelineViewClient';

interface PipelineDetailPanelProps {
  pipeline: Pipeline;
  onClose: () => void;
}

const codeSnippets: Record<string, string> = {
  'pipe-auth': `// src/pipelines/auth-pipeline.ts
import { JWTService } from '../utils/jwt';


export class AuthPipeline {
  private jwt: JWTService;
  
  constructor() {
    this.jwt = new JWTService({
      secret: process.env.JWT_SECRET!,
      expiresIn: '15m',
    });
  }

  async validate(token: string): Promise<boolean> {
    try {
      const payload = await this.jwt.verify(token);
      return !!payload.userId;
    } catch {
      return false;
    }
  }
}`,
  'pipe-webhook': `// src/webhooks/validator.ts
import { WebhookPayload } from './types';

export function validateWebhook(raw: unknown): WebhookPayload {
  // ❌ BUG: raw.payload is undefined when
  // incoming webhook uses flat structure
  const payload = (raw as any).payload; // line 42
  
  if (!payload.event || !payload.data) {
    throw new TypeError(
      'Invalid webhook: missing event or data'
    );
  }
  
  return payload as WebhookPayload;
}`,
  'pipe-legacy': `// src/sync/legacy-client.ts
import axios from 'axios';

export class LegacyClient {
  async getContacts(): Promise<Contact[]> {
    // ❌ ERROR: Endpoint removed in API v2
    // Migrate to: /api/v2/contacts
    const res = await axios.get(
      'https://crm.example.com/api/v1/contacts'
    );
    // 410 Gone — this endpoint no longer exists
    return res.data;
  }
}`,
  default: `// Select a file to view its contents
// Click any highlighted file on the left
// to preview the relevant code section

export default function pipeline() {
  // Pipeline implementation
  // Last modified by AI agent
}`,
};

const statusConfig = {
  active: {
    label: 'ACTIVE',
    className: 'text-running bg-running/10 border-running/20',
    Icon: CheckCircle2,
  },
  coded: { label: 'CODED', className: 'text-coded bg-coded/10 border-coded/20', Icon: Code2 },
  broken: {
    label: 'BROKEN',
    className: 'text-error bg-error/10 border-error/20',
    Icon: AlertTriangle,
  },
};

export default function PipelineDetailPanel({ pipeline, onClose }: PipelineDetailPanelProps) {
  const [selectedModel, setSelectedModel] = useState<'Claude' | 'Codex'>('Claude');
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(pipeline.files[0]?.name ?? '');
  const [copied, setCopied] = useState(false);

  const cfg = statusConfig[pipeline.status];
  const StatusIcon = cfg.Icon;

  const codeContent = codeSnippets[pipeline.id] ?? codeSnippets.default;

  const handleSend = () => {
    if (!prompt.trim()) {
      toast.error('Please describe what you want to change');
      return;
    }
    setSending(true);
    // Backend: POST /api/agents/edit with { pipelineId, file: selectedFile, prompt, model: selectedModel }
    setTimeout(() => {
      setSending(false);
      toast.success(`Sent to ${selectedModel} — agent is editing ${selectedFile}`);
      setPrompt('');
    }, 1800);
  };

  const handleCopy = () => {
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="w-80 flex-shrink-0 border-l border-subtle flex flex-col overflow-hidden slide-in-right"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-subtle flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 text-2xs font-mono font-semibold px-2 py-0.5 rounded border flex-shrink-0 ${cfg.className}`}
          >
            <StatusIcon size={9} />
            {cfg.label}
          </span>
          <span className="text-sm font-mono text-foreground font-medium truncate">
            {pipeline.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Description */}
      <div className="px-3 py-2 border-b border-subtle flex-shrink-0">
        <p className="text-xs text-muted-foreground leading-relaxed">{pipeline.description}</p>
        {pipeline.errorMessage && (
          <div className="mt-2 p-2 rounded bg-error/5 border border-error/20">
            <p className="text-2xs font-mono text-error leading-relaxed">{pipeline.errorMessage}</p>
          </div>
        )}
      </div>

      {/* Concerned Files */}
      <div className="flex-shrink-0 border-b border-subtle">
        <div className="px-3 py-2">
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Concerned Files
          </p>
          <div className="flex flex-col gap-0.5">
            {pipeline.files.map((file) => (
              <button
                key={`detail-file-${file.name}`}
                onClick={() => setSelectedFile(file.name)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all duration-150 w-full ${
                  selectedFile === file.name
                    ? 'bg-primary/10 border-l-2 border-primary'
                    : 'hover:bg-hover'
                }`}
              >
                <FileCode
                  size={11}
                  className={file.highlighted ? 'text-primary' : 'text-muted-foreground'}
                />
                <span
                  className={`text-2xs font-mono truncate ${
                    file.highlighted ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {file.name}
                </span>
                {file.highlighted && (
                  <span className="ml-auto text-2xs text-primary bg-primary/10 px-1 rounded flex-shrink-0">
                    HL
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Code Preview */}
      <div className="flex-shrink-0 border-b border-subtle">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-2xs text-muted-foreground font-mono truncate flex-1 mr-2">
            {selectedFile}
          </span>
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title="Copy code"
          >
            {copied ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
          </button>
        </div>
        <div
          className="mx-3 mb-2 rounded border border-subtle overflow-hidden"
          style={{ background: '#0d0d0d' }}
        >
          <div className="overflow-auto max-h-40">
            <pre className="code-block p-3 text-foreground/90 whitespace-pre leading-relaxed">
              {codeContent.split('\n').map((line, li) => {
                const isErrorLine =
                  pipeline.status === 'broken' &&
                  (line.includes('// ❌') || line.includes('throw') || line.includes('410'));
                return (
                  <div key={`codeline-${li}`} className={isErrorLine ? 'highlight-line' : ''}>
                    <span className="select-none text-muted-foreground/40 mr-3 text-2xs tabular-nums">
                      {(li + 1).toString().padStart(2, ' ')}
                    </span>
                    {line}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      </div>

      {/* AI Edit Section */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-subtle flex-shrink-0">
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            Edit with AI
          </p>
          <p className="text-2xs text-muted-foreground/60 mt-0.5">
            Uses your API key from Settings
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
          {/* Model Selector */}
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as 'Claude' | 'Codex')}
              className="w-full bg-input border border-subtle rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-ring appearance-none cursor-pointer pr-7"
            >
              <option value="Claude">Claude 3.5 Sonnet</option>
              <option value="Codex">OpenAI Codex</option>
            </select>
            <ChevronDown
              size={11}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>

          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              pipeline.status === 'broken'
                ? 'Describe the fix... (e.g. "Fix the payload validation to handle flat webhook structure")'
                : 'Describe what you want to change... (e.g. "Add error handling for network timeouts")'
            }
            rows={4}
            className="w-full bg-input border border-subtle rounded px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring resize-none leading-relaxed"
          />

          <button
            onClick={handleSend}
            disabled={sending || !prompt.trim()}
            className="w-full btn-primary text-xs justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                Sending to {selectedModel}...
              </>
            ) : (
              <>
                <Send size={11} />
                Send to {selectedModel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
