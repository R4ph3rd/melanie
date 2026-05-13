import { useState } from 'react'
import { useStore } from '../store'
import { AVAILABLE_MODELS } from '../api/claude'

export default function TopBar() {
  const apiKey   = useStore((s) => s.apiKey)
  const model    = useStore((s) => s.model)
  const setApiKey = useStore((s) => s.setApiKey)
  const setModel  = useStore((s) => s.setModel)

  const [draft, setDraft] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  function saveKey() {
    setApiKey(draft.trim())
  }

  return (
    <>
      <header
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          height: 48,
          background: '#0c0c14',
          borderBottom: '1px solid #222',
          zIndex: 100,
        }}
      >
        {/* Avatar / logo */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#1e1e2e', border: '1px solid #333' }}
          title="melanie"
        >
          <span className="text-xs" style={{ color: '#7c3aed' }}>✦</span>
        </div>

        {/* App name */}
        <span className="text-sm font-semibold text-text-primary tracking-tight select-none">
          melanie
        </span>
        <span className="text-xs text-text-muted hidden sm:block">
          : Node-based Creative Coding with AI
        </span>

        <div className="flex-1" />

        {/* API key input */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-text-muted flex-shrink-0">API Key</label>
          <div className="relative flex items-center">
            <input
              type={showKey ? 'text' : 'password'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveKey()}
              placeholder="sk-ant-…"
              className="text-xs px-2 py-1 rounded outline-none"
              style={{
                background: '#1a1a24',
                border: `1px solid ${apiKey ? '#4ade8044' : '#444'}`,
                color: '#f0f0f0',
                width: 180,
              }}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-1 text-text-muted hover:text-text-primary text-xs"
              title={showKey ? 'Hide' : 'Show'}
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
          <button
            onClick={saveKey}
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{
              background: apiKey === draft.trim() ? '#1e1e2e' : '#7c3aed',
              color: apiKey === draft.trim() ? '#606060' : '#fff',
              border: '1px solid transparent',
            }}
          >
            {apiKey === draft.trim() ? '✓ Saved' : 'Save'}
          </button>
        </div>

        {/* Model selector */}
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="text-xs rounded px-2 py-1 outline-none cursor-pointer"
          style={{ background: '#1a1a24', border: '1px solid #333', color: '#a0a0a0', maxWidth: 180 }}
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        {/* Options */}
        <div className="relative">
          <button
            onClick={() => { setShowOptions((v) => !v); setShowHelp(false) }}
            className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface3"
            title="Options"
          >
            ⚙
          </button>
          {showOptions && (
            <div
              className="absolute right-0 top-full mt-1 rounded-lg shadow-popup p-3 z-50 text-xs"
              style={{ background: '#131320', border: '1px solid #333', minWidth: 200 }}
            >
              <p className="text-text-muted font-semibold mb-2 text-2xs uppercase tracking-wide">Options</p>
              <label className="flex items-center gap-2 text-text-secondary py-1 cursor-pointer">
                <span>Theme</span>
                <span className="ml-auto text-text-muted">Dark</span>
              </label>
              <label className="flex items-center gap-2 text-text-secondary py-1 cursor-pointer">
                <span>Auto-extract params</span>
                <span className="ml-auto text-accent">✓</span>
              </label>
            </div>
          )}
        </div>

        {/* Help */}
        <button
          onClick={() => { setShowHelp((v) => !v); setShowOptions(false) }}
          className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface3"
          title="Help"
        >
          ?
        </button>
      </header>

      {/* Help panel */}
      {showHelp && (
        <div
          className="absolute right-4 z-50 rounded-lg shadow-popup p-4 text-xs"
          style={{ background: '#131320', border: '1px solid #333', top: 56, minWidth: 300, maxWidth: 380 }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-text-primary font-semibold">Quick Help</p>
            <button onClick={() => setShowHelp(false)} className="text-text-muted hover:text-text-primary">✕</button>
          </div>
          <div className="space-y-2 text-text-secondary">
            <p><span className="text-accent">✦ Modify</span> : type a natural language prompt to transform a sketch</p>
            <p><span className="text-blue-400">⊕ Merge</span> : click Merge, then click another sketch to combine them</p>
            <p><span className="text-green-400">⊟ Diff</span> : compare two sketches and get a description</p>
            <p><span className="text-yellow-600">⊆ Extract</span> : isolate a visual property as a new sketch</p>
            <p><span className="text-gray-400">⎘ Duplicate</span> : create an exact copy to branch from</p>
            <hr className="border-border my-2" />
            <p>Double-click a node title to rename it.</p>
            <p>Click <strong className="text-text-primary">&lt;/&gt; Show Code</strong> to edit the source directly.</p>
            <p>Sliders below each sketch control global variables live.</p>
            <p className="text-text-muted">Ctrl+Enter applies code changes in the editor.</p>
          </div>
        </div>
      )}
    </>
  )
}
