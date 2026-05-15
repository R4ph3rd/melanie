import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faCheck, faEye, faEyeSlash, faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { PROVIDERS } from '../api/providers'
import { useStore } from '../store/store'

interface Props {
  onClose: () => void
}

export default function ModelConnectModal({ onClose }: Props) {
  const apiKeys    = useStore((s) => s.apiKeys)
  const providerId = useStore((s) => s.providerId)
  const modelId    = useStore((s) => s.modelId)
  const setApiKey  = useStore((s) => s.setApiKey)

  // Local draft state per provider
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(PROVIDERS.map((p) => [p.id, apiKeys[p.id] ?? '']))
  )
  const [show, setShow] = useState<Record<string, boolean>>({})

  function saveDraft(pid: string) {
    setApiKey(pid, drafts[pid].trim())
  }

  function toggleShow(pid: string) {
    setShow((s) => ({ ...s, [pid]: !s[pid] }))
  }

  const activeProvider = PROVIDERS.find((p) => p.id === providerId)

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative rounded-xl shadow-popup overflow-hidden"
        style={{
          background: '#0e0e1a',
          border: '1px solid #2a2a3a',
          width: 560,
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e2e' }}>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Connect Models</h2>
            <p className="text-xs text-text-muted mt-0.5">Add API keys for the providers you want to use</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface3"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Provider cards */}
        <div className="p-5 space-y-3">
          {PROVIDERS.map((provider) => {
            const saved   = apiKeys[provider.id] ?? ''
            const draft   = drafts[provider.id] ?? ''
            const isActive = provider.id === providerId
            const isDirty = draft.trim() !== saved

            return (
              <div
                key={provider.id}
                className="rounded-lg p-4"
                style={{
                  background: isActive ? 'rgba(124,58,237,0.08)' : '#131825',
                  border: isActive ? '1px solid rgba(124,58,237,0.4)' : '1px solid #252535',
                }}
              >
                {/* Provider identity row */}
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={provider.logoUrl}
                    alt={provider.name}
                    className="rounded"
                    style={{ width: 28, height: 28, objectFit: 'contain', background: '#fff', padding: 2 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-text-primary">{provider.name}</span>
                    {isActive && (
                      <span
                        className="ml-2 text-2xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
                      >
                        active
                      </span>
                    )}
                  </div>
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-text-muted hover:text-accent text-xs flex items-center gap-1"
                  >
                    Get key <FontAwesomeIcon icon={faExternalLink} className="text-2xs" />
                  </a>
                </div>

                {/* API key input */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <input
                      type={show[provider.id] ? 'text' : 'password'}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [provider.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && saveDraft(provider.id)}
                      placeholder={provider.keyPrefix ? `${provider.keyPrefix}…` : 'API key…'}
                      className="w-full text-xs px-2.5 py-1.5 rounded outline-none pr-8"
                      style={{
                        background: '#0d0d1a',
                        border: `1px solid ${saved ? '#4ade8044' : '#333'}`,
                        color: '#f0f0f0',
                      }}
                    />
                    <button
                      onClick={() => toggleShow(provider.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
                    >
                      <FontAwesomeIcon icon={show[provider.id] ? faEyeSlash : faEye} />
                    </button>
                  </div>
                  <button
                    onClick={() => saveDraft(provider.id)}
                    className="px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                    style={{
                      background: isDirty ? '#7c3aed' : saved ? 'rgba(74,222,128,0.1)' : '#1e1e2e',
                      color: isDirty ? '#fff' : saved ? '#4ade80' : '#555',
                      border: '1px solid transparent',
                    }}
                  >
                    {!isDirty && saved
                      ? <><FontAwesomeIcon icon={faCheck} /> Saved</>
                      : 'Save'}
                  </button>
                </div>

              </div>
            )
          })}
        </div>

        {/* Footer: active model summary */}
        {activeProvider && (
          <div
            className="px-6 py-3 text-xs text-text-muted flex items-center gap-2"
            style={{ borderTop: '1px solid #1e1e2e' }}
          >
            <span>Active:</span>
            <img
              src={activeProvider.logoUrl}
              alt=""
              style={{ width: 14, height: 14, objectFit: 'contain', background: '#fff', borderRadius: 2, padding: 1 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className="text-text-secondary">
              {activeProvider.name} / {activeProvider.models.find((m) => m.id === modelId)?.label ?? modelId}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
