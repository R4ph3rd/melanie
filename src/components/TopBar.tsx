import { useState } from 'react'
import * as SelectPrimitive      from '@radix-ui/react-select'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as PopoverPrimitive     from '@radix-ui/react-popover'
import Icon from './ui/Icon'
import { ChevronDown, Check } from 'lucide-react'
import { useStore } from '../store/store'
import { PROVIDERS } from '../api/providers'
import ModelConnectModal from './ModelConnectModal'

// ── Shared Tailwind strings ────────────────────────────────────────────────────
const dropdownContentCls =
  'z-50 min-w-[8rem] overflow-hidden rounded border border-border bg-popover p-1 text-foreground shadow-popup ' +
  'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'

const menuItemCls =
  'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs ' +
  'outline-none transition-colors focus:bg-secondary focus:text-foreground'

export default function TopBar() {
  const providerId  = useStore((s) => s.providerId)
  const modelId     = useStore((s) => s.modelId)
  const apiKeys     = useStore((s) => s.apiKeys)
  const setProvider = useStore((s) => s.setProvider)
  const setModel    = useStore((s) => s.setModel)

  const [showModal, setShowModal] = useState(false)
  const [helpOpen,  setHelpOpen]  = useState(false)

  const unlockedProviders = PROVIDERS.filter((p) => !!apiKeys[p.id])
  const hasKey            = !!(apiKeys[providerId])
  const activeProvider    = PROVIDERS.find((p) => p.id === providerId)

  return (
    <>
      <header
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ height: 44, background: '#0c0c0c', borderBottom: '1px solid #1e1e1e', zIndex: 100 }}
      >
        {/* Logo — square glitch badge */}
        <div style={{
          width: 28, height: 28, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: '#111', border: '2px solid #8C49DF', borderRadius: 2,
        }}>
          <span style={{ color: '#8C49DF', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>✦</span>
        </div>

        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em', userSelect: 'none', color: '#e0e0e0' }}>melanie</span>
        <span style={{ fontSize: 11, color: '#404040' }} className="hidden sm:block">node-based creative coding</span>

        <div className="flex-1" />

        {/* Model selector */}
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
            <SelectPrimitive.Root
              value={`${providerId}::${modelId}`}
              onValueChange={(val) => {
                const [pid, mid] = val.split('::')
                setProvider(pid)
                setModel(mid)
              }}
            >
              <SelectPrimitive.Trigger
                className="flex h-7 w-[180px] items-center justify-between whitespace-nowrap rounded border border-border bg-input px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <SelectPrimitive.Value />
                <SelectPrimitive.Icon asChild>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </SelectPrimitive.Icon>
              </SelectPrimitive.Trigger>

              <SelectPrimitive.Portal>
                <SelectPrimitive.Content
                  className={
                    'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded border border-border ' +
                    'bg-popover text-foreground shadow-popup ' +
                    'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
                    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
                    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
                    'data-[side=bottom]:translate-y-1'
                  }
                  position="popper"
                >
                  <SelectPrimitive.Viewport className="p-1 w-full min-w-[var(--radix-select-trigger-width)]">
                    {unlockedProviders.map((p) => (
                      <SelectPrimitive.Group key={p.id}>
                        <SelectPrimitive.Label className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {p.name}
                        </SelectPrimitive.Label>
                        {p.models.map((m) => (
                          <SelectPrimitive.Item
                            key={m.id}
                            value={`${p.id}::${m.id}`}
                            className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-xs outline-none focus:bg-secondary focus:text-foreground data-[disabled]:opacity-50"
                          >
                            <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                              <SelectPrimitive.ItemIndicator>
                                <Check className="h-3.5 w-3.5" />
                              </SelectPrimitive.ItemIndicator>
                            </span>
                            <SelectPrimitive.ItemText>{m.label}</SelectPrimitive.ItemText>
                          </SelectPrimitive.Item>
                        ))}
                      </SelectPrimitive.Group>
                    ))}
                  </SelectPrimitive.Viewport>
                </SelectPrimitive.Content>
              </SelectPrimitive.Portal>
            </SelectPrimitive.Root>

            <span
              className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
              style={{ background: hasKey ? '#4ade80' : '#f87171' }}
              title={hasKey ? 'API key set' : 'No API key'}
            />
          </div>
        )}

        {/* Connect Models */}
        <button
          onClick={() => setShowModal(true)}
          title="Connect AI models"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            border: hasKey ? '1px solid #333' : '1px solid #8C49DF',
            borderRadius: 2,
            background: hasKey ? 'transparent' : 'rgba(140,73,223,0.15)',
            color: hasKey ? '#606060' : '#8C49DF',
            fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.1s', whiteSpace: 'nowrap',
          }}
        >
          <Icon name="connect" size={12} />
          {hasKey ? 'Models' : 'Connect'}
        </button>

        {/* Options dropdown */}
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <button title="Options" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, border: '2px solid #333', borderRadius: 2,
              background: 'transparent', color: '#555', cursor: 'pointer',
              transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8C49DF'; e.currentTarget.style.color = '#8C49DF' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#555' }}
            >
              <Icon name="settings" size={14} />
            </button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              align="end"
              sideOffset={4}
              className={`${dropdownContentCls} min-w-[180px]`}
            >
              <DropdownMenuPrimitive.Label className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Options
              </DropdownMenuPrimitive.Label>
              {(['Auto-extract params', 'Semantic labels'] as const).map((label) => (
                <DropdownMenuPrimitive.CheckboxItem
                  key={label}
                  className={menuItemCls}
                  checked={true}
                  onCheckedChange={() => {}}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <DropdownMenuPrimitive.ItemIndicator>
                      <Check className="h-3.5 w-3.5" />
                    </DropdownMenuPrimitive.ItemIndicator>
                  </span>
                  {label}
                </DropdownMenuPrimitive.CheckboxItem>
              ))}
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>

        {/* Help popover */}
        <PopoverPrimitive.Root open={helpOpen} onOpenChange={setHelpOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button title="Help" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, border: '2px solid #333', borderRadius: 2,
              background: 'transparent', color: '#555', cursor: 'pointer',
              transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8C49DF'; e.currentTarget.style.color = '#8C49DF' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#555' }}
            >
              <Icon name="help" size={14} />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="end"
              sideOffset={4}
              className={
                'z-50 w-[360px] rounded border border-border bg-popover p-4 text-foreground shadow-popup outline-none text-xs ' +
                'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
                'data-[side=bottom]:slide-in-from-top-2'
              }
            >
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
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </header>

      {showModal && <ModelConnectModal onClose={() => setShowModal(false)} />}
    </>
  )
}
