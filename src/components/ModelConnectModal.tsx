import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faEye, faEyeSlash, faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { PROVIDERS } from '../api/providers'
import { useStore } from '../store/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'

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
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg flex flex-col max-h-[80vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Connect Models</DialogTitle>
          <DialogDescription>Add API keys for the providers you want to use</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-3 pb-4">
            {PROVIDERS.map((provider) => {
              const saved    = apiKeys[provider.id] ?? ''
              const draft    = drafts[provider.id] ?? ''
              const isActive = provider.id === providerId
              const isDirty  = draft.trim() !== saved

              return (
                <Card
                  key={provider.id}
                  className={isActive ? 'border-primary/40 bg-primary/5' : ''}
                >
                  <CardHeader className="flex-row items-center gap-3 pb-3 space-y-0">
                    <img
                      src={provider.logoUrl}
                      alt={provider.name}
                      className="rounded w-7 h-7 object-contain bg-white p-0.5 flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <CardTitle>{provider.name}</CardTitle>
                    {isActive && <Badge variant="default" className="text-[10px]">active</Badge>}
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="ml-auto text-muted-foreground hover:text-foreground"
                    >
                      <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1">
                        Get key <FontAwesomeIcon icon={faExternalLink} className="text-[10px]" />
                      </a>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={show[provider.id] ? 'text' : 'password'}
                          value={draft}
                          onChange={(e) => setDrafts((d) => ({ ...d, [provider.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && saveDraft(provider.id)}
                          placeholder={provider.keyPrefix ? `${provider.keyPrefix}…` : 'API key…'}
                          className={saved ? 'border-emerald-500/30' : ''}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleShow(provider.id)}
                          className="absolute right-0 top-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <FontAwesomeIcon icon={show[provider.id] ? faEyeSlash : faEye} />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant={isDirty ? 'default' : saved ? 'outline' : 'ghost'}
                        onClick={() => saveDraft(provider.id)}
                        className="flex items-center gap-1"
                      >
                        {!isDirty && saved
                          ? <><FontAwesomeIcon icon={faCheck} /> Saved</>
                          : 'Save'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>

        {activeProvider && (
          <>
            <Separator />
            <DialogFooter className="px-6 py-3 sm:flex-row sm:items-center sm:justify-start">
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
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
