import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import Icon from './ui/Icon'
import { PROVIDERS } from '../api/providers'
import { useStore } from '../store/store'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

interface Props {
  onClose: () => void
}

export default function ModelConnectModal({ onClose }: Props) {
  const apiKeys      = useStore((s) => s.apiKeys)
  const providerId   = useStore((s) => s.providerId)
  const modelId      = useStore((s) => s.modelId)
  const setApiKey    = useStore((s) => s.setApiKey)
  const rememberKeys = useStore((s) => s.rememberKeys)
  const setRemember  = useStore((s) => s.setRememberKeys)

  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(PROVIDERS.map((p) => [p.id, apiKeys[p.id] ?? '']))
  )
  const [show, setShow] = useState<Record<string, boolean>>({})

  function saveDraft(pid: string) {
    setApiKey(pid, drafts[pid].trim())
  }

  const activeProvider = PROVIDERS.find((p) => p.id === providerId)

  return (
    <DialogPrimitive.Root open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content */}
        <DialogPrimitive.Content
          className={
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 ' +
            'w-full max-w-lg max-h-[80vh] flex flex-col ' +
            'rounded border border-border bg-popover shadow-popup ' +
            'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          }
        >
          {/* Close button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-60 text-muted-foreground transition-opacity hover:opacity-100 focus:outline-none">
            <Icon name="close" size={16} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogPrimitive.Title className="text-base font-semibold text-foreground">
              Connect Models
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-xs text-muted-foreground mt-1">
              Add API keys for the providers you want to use
            </DialogPrimitive.Description>
          </div>

          {/* Storage choice + honest security note */}
          <div className="px-6 pb-3 flex-shrink-0">
            <label className="flex items-start gap-2 cursor-pointer rounded border p-3"
              style={{ borderColor: '#2a2a2a', background: '#0e0e0e' }}>
              <input type="checkbox" checked={rememberKeys}
                onChange={(e) => setRemember(e.target.checked)}
                className="mt-0.5 accent-[#8C49DF]" />
              <span className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">Remember keys on this device</span><br />
                Keys are kept only for this tab by default. Either way they live in the
                browser in plaintext — because this app runs LLM-authored code, any XSS
                could read them. Use scoped keys and revoke them when you're done.
              </span>
            </label>
          </div>

          {/* Provider list scrollable */}
          <div className="flex-1 overflow-y-auto px-6 min-h-0">
            <div className="space-y-3 pb-4">
              {PROVIDERS.map((provider) => {
                const saved    = apiKeys[provider.id] ?? ''
                const draft    = drafts[provider.id] ?? ''
                const isActive = provider.id === providerId
                const isDirty  = draft.trim() !== saved

                return (
                  <div
                    key={provider.id}
                    className="rounded border p-4"
                    style={{
                      borderColor: isActive ? 'rgba(140,73,223,0.4)' : '#2a2a2a',
                      background:  isActive ? 'rgba(140,73,223,0.05)' : '#111',
                    }}
                  >
                    {/* Provider header */}
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={provider.logoUrl}
                        alt={provider.name}
                        className="rounded w-7 h-7 object-contain bg-white p-0.5 flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <span className="text-sm font-semibold text-foreground">{provider.name}</span>
                      {isActive && <Badge variant="default" className="text-[10px]">active</Badge>}
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Get key <Icon name="open-new-tab" size={10} />
                      </a>
                    </div>

                    {/* Key input */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={show[provider.id] ? 'text' : 'password'}
                          value={draft}
                          onChange={(e) => setDrafts((d) => ({ ...d, [provider.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && saveDraft(provider.id)}
                          placeholder={provider.keyPrefix ? `${provider.keyPrefix}…` : 'API key…'}
                          className="flex h-8 w-full rounded border border-border bg-input px-3 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          style={saved ? { borderColor: 'rgba(74,222,128,0.3)' } : undefined}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => setShow((s) => ({ ...s, [provider.id]: !s[provider.id] }))}
                          className="absolute right-0 top-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Icon name={show[provider.id] ? 'view-off' : 'view'} size={14} />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant={isDirty ? 'default' : saved ? 'outline' : 'ghost'}
                        onClick={() => saveDraft(provider.id)}
                        className="flex items-center gap-1 flex-shrink-0"
                      >
                        {!isDirty && saved
                          ? <><Icon name="checkmark" size={12} /> Saved</>
                          : 'Save'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          {activeProvider && (
            <>
              <div className="h-px bg-border flex-shrink-0" />
              <div className="px-6 py-3 flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">Active:</span>
                <img
                  src={activeProvider.logoUrl}
                  alt=""
                  className="w-3.5 h-3.5 object-contain bg-white rounded p-px"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-xs text-foreground/70">
                  {activeProvider.name} / {activeProvider.models.find((m) => m.id === modelId)?.label ?? modelId}
                </span>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
