import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlug,
  faGear,
  faCircleQuestion,
} from '@fortawesome/free-solid-svg-icons'
import { useStore } from '../store/store'
import { PROVIDERS } from '../api/providers'
import ModelConnectModal from './ModelConnectModal'
import { Button } from './ui/button'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectGroup,
  SelectValue,
} from './ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from './ui/dropdown-menu'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'

export default function TopBar() {
  const providerId  = useStore((s) => s.providerId)
  const modelId     = useStore((s) => s.modelId)
  const apiKeys     = useStore((s) => s.apiKeys)
  const setProvider = useStore((s) => s.setProvider)
  const setModel    = useStore((s) => s.setModel)

  const [showModal, setShowModal] = useState(false)
  const [helpOpen,  setHelpOpen]  = useState(false)

  // Only show providers for which the user has entered a key
  const unlockedProviders = PROVIDERS.filter((p) => !!apiKeys[p.id])
  const hasKey            = !!(apiKeys[providerId])
  const activeProvider    = PROVIDERS.find((p) => p.id === providerId)

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
            <Select
              value={`${providerId}::${modelId}`}
              onValueChange={(val) => {
                const [pid, mid] = val.split('::')
                setProvider(pid)
                setModel(mid)
              }}
            >
              <SelectTrigger className="w-[180px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unlockedProviders.map((p) => (
                  <SelectGroup key={p.id}>
                    <SelectLabel>{p.name}</SelectLabel>
                    {p.models.map((m) => (
                      <SelectItem key={m.id} value={`${p.id}::${m.id}`}>{m.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: hasKey ? '#4ade80' : '#f87171' }}
              title={hasKey ? 'API key set' : 'No API key'}
            />
          </div>
        )}

        {/* Connect Models button */}
        <Button
          onClick={() => setShowModal(true)}
          variant={hasKey ? 'outline' : 'default'}
          size="sm"
          className={hasKey
            ? 'text-muted-foreground border-border/50'
            : 'bg-primary/15 text-primary border border-primary/50 hover:bg-primary/25'
          }
        >
          <FontAwesomeIcon icon={faPlug} />
          Connect Models
        </Button>

        {/* Options dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="Options" className="text-text-muted hover:text-text-primary">
              <FontAwesomeIcon icon={faGear} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuLabel>Options</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={true} onCheckedChange={() => {}}>
              Auto-extract params
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={true} onCheckedChange={() => {}}>
              Semantic labels
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help popover */}
        <Popover open={helpOpen} onOpenChange={setHelpOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" title="Help" className="text-text-muted hover:text-text-primary">
              <FontAwesomeIcon icon={faCircleQuestion} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[360px] text-xs">
            <p className="text-foreground font-semibold mb-3">Quick Help</p>
            <div className="space-y-2 text-muted-foreground leading-relaxed">
              <p><span className="text-purple-400">Drag a connector</span> from a sketch handle to empty space → choose an operation</p>
              <p><span className="text-blue-400">Drag connector</span> from sketch A to sketch B → Merge or Diff</p>
              <p><span className="text-purple-300">Ops toolbar</span> (top-left) → click op then click a sketch to apply it</p>
              <p><span className="text-yellow-400">Click a parameter label</span> to pick it up, then click another sketch to transfer it</p>
              <hr className="border-border my-2" />
              <p>Double-click a node title to rename it.</p>
              <p>Click <strong className="text-foreground">&lt;/&gt;</strong> to open the code editor.</p>
              <p className="text-muted-foreground/60">Delete key removes selected nodes.</p>
            </div>
          </PopoverContent>
        </Popover>
      </header>

      {/* Model connect modal */}
      {showModal && <ModelConnectModal onClose={() => setShowModal(false)} />}
    </>
  )
}
