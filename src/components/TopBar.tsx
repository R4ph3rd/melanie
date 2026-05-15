import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlug,
  faGear,
  faCircleQuestion,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useStore } from '../store/store'
import { PROVIDERS } from '../api/providers'
import ModelConnectModal from './ModelConnectModal'

export default function TopBar() {
  const providerId  = useStore((s) => s.providerId)
  const modelId     = useStore((s) => s.modelId)
  const apiKeys     = useStore((s) => s.apiKeys)
  const setProvider = useStore((s) => s.setProvider)
  const setModel    = useStore((s) => s.setModel)

  const [showModal,   setShowModal]   = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showHelp,    setShowHelp]    = useState(false)

  // Only show providers for which the user has entered a key
  const unlockedProviders = PROVIDERS.filter((p) => !!apiKeys[p.id])
  const hasKey            = !!(apiKeys[providerId])
  const activeProvider    = PROVIDERS.find((p) => p.id === providerId)
  const activeModel       = activeProvider?.models.find((m) => m.id === modelId)

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
        {/* Logo / avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#1e1e2e', border: '1px solid #333' }}
        >
          <span className="text-xs" style={{ color: '#7c3aed' }}>✦</span>
        </div>

        <span className="text-sm font-semibold text-text-primary tracking-tight select-none">
          melanie
        </span>
        <span className="text-xs text-text-muted hidden sm:block">
          node-based assisted creative coding
        </span>

        <div className="flex-1" />

        {/* Model selector — only shows providers with saved keys */}
        {unlockedProviders.length > 0 && (
          <div className="flex items-center gap-1.5">
            {activeProvider && (
              <img
                src={activeProvider.logoUrl}
                alt=""
                style={{ width: 16, height: 16, objectFit: 'contain', background: '#fff', borderRadius: 2, padding: 1, flexShrink: 0 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <select
              value={`${providerId}::${modelId}`}
              onChange={(e) => {
                const [pid, mid] = e.target.value.split('::')
                setProvider(pid)
                setModel(mid)
              }}
              className="text-xs rounded px-2 py-1 outline-none cursor-pointer"
              style={{
                background: '#131825',
                border: '1px solid #252535',
                color: '#c0c0d0',
                maxWidth: 180,
              }}
            >
              {unlockedProviders.map((p) => (
                <optgroup key={p.id} label={p.name}>
                  {p.models.map((m) => (
                    <option key={m.id} value={`${p.id}::${m.id}`}>{m.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: hasKey ? '#4ade80' : '#f87171' }}
              title={hasKey ? 'API key set' : 'No API key'}
            />
          </div>
        )}

        {/* Connect Models button */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            background: hasKey ? 'transparent' : 'rgba(124,58,237,0.15)',
            border: hasKey ? '1px solid #2a2a3a' : '1px solid rgba(124,58,237,0.5)',
            color: hasKey ? '#888' : '#a78bfa',
          }}
        >
          <FontAwesomeIcon icon={faPlug} />
          Connect Models
        </button>

        {/* Options */}
        <div className="relative">
          <button
            onClick={() => { setShowOptions((v) => !v); setShowHelp(false) }}
            className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface3"
            title="Options"
          >
            <FontAwesomeIcon icon={faGear} />
          </button>
          {showOptions && (
            <div
              className="absolute right-0 top-full mt-1 rounded-lg shadow-popup p-3 z-50 text-xs"
              style={{ background: '#131320', border: '1px solid #333', minWidth: 200 }}
              onMouseLeave={() => setShowOptions(false)}
            >
              <p className="text-text-muted font-semibold mb-2 text-2xs uppercase tracking-wide">Options</p>
              <label className="flex items-center gap-2 text-text-secondary py-1">
                <span>Theme</span>
                <span className="ml-auto text-text-muted">Dark</span>
              </label>
              <label className="flex items-center gap-2 text-text-secondary py-1">
                <span>Auto-extract params</span>
                <span className="ml-auto text-accent">✓</span>
              </label>
              <label className="flex items-center gap-2 text-text-secondary py-1">
                <span>Semantic labels</span>
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
          <FontAwesomeIcon icon={faCircleQuestion} />
        </button>
      </header>

      {/* Help panel */}
      {showHelp && (
        <div
          className="absolute right-4 z-[150] rounded-lg shadow-popup p-4 text-xs"
          style={{ background: '#131320', border: '1px solid #333', top: 56, minWidth: 320, maxWidth: 400 }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-text-primary font-semibold">Quick Help</p>
            <button onClick={() => setShowHelp(false)} className="text-text-muted hover:text-text-primary">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          <div className="space-y-2 text-text-secondary leading-relaxed">
            <p><span className="text-purple-400">Drag a connector</span> from a sketch handle to empty space → choose an operation</p>
            <p><span className="text-blue-400">Drag connector</span> from sketch A to sketch B → Merge or Diff</p>
            <p><span className="text-purple-300">Ops toolbar</span> (top-left) → click op then click a sketch to apply it</p>
            <p><span className="text-yellow-400">Click a parameter label</span> to pick it up, then click another sketch to transfer it</p>
            <hr className="border-border my-2" />
            <p>Double-click a node title to rename it.</p>
            <p>Click <strong className="text-text-primary">&lt;/&gt;</strong> to open the code editor.</p>
            <p className="text-text-muted">Delete key removes selected nodes.</p>
          </div>
        </div>
      )}

      {/* Model connect modal */}
      {showModal && <ModelConnectModal onClose={() => setShowModal(false)} />}
    </>
  )
}
