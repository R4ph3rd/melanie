import { useState } from 'react'
import * as SelectPrimitive      from '@radix-ui/react-select'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as PopoverPrimitive     from '@radix-ui/react-popover'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlug, faGear, faCircleQuestion } from '@fortawesome/free-solid-svg-icons'
import { ChevronDown, Check } from 'lucide-react'
import { useStore } from '../store/store'
import { PROVIDERS } from '../api/providers'
import ModelConnectModal from './ModelConnectModal'
import { Button } from './ui/button'

// ── Shared Tailwind strings ────────────────────────────────────────────────────
const dropdownContentCls =
  'z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-foreground shadow-popup ' +
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
        style={{ height: 48, background: '#0c0c14', borderBottom: '1px solid #222', zIndex: 100 }}
      >
        {/* Logo */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#1e1e2e', border: '1px solid #333' }}
        >
          <span className="text-xs" style={{ color: '#7c3aed' }}>✦</span>
        </div>

        <span className="text-sm font-semibold text-text-primary tracking-tight select-none">melanie</span>
        <span className="text-xs text-text-muted hidden sm:block">node-based assisted creative coding</span>

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
                className="flex h-7 w-[180px] items-center justify-between whitespace-nowrap rounded-md border border-border bg-input px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <SelectPrimitive.Value />
                <SelectPrimitive.Icon asChild>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </SelectPrimitive.Icon>
              </SelectPrimitive.Trigger>

              <SelectPrimitive.Portal>
                <SelectPrimitive.Content
                  className={
                    'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border ' +
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
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: hasKey ? '#4ade80' : '#f87171' }}
              title={hasKey ? 'API key set' : 'No API key'}
            />
          </div>
        )}

        {/* Connect Models */}
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
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <Button variant="ghost" size="icon" title="Options" className="text-text-muted hover:text-text-primary">
              <FontAwesomeIcon icon={faGear} />
            </Button>
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
            <Button variant="ghost" size="icon" title="Help" className="text-text-muted hover:text-text-primary">
              <FontAwesomeIcon icon={faCircleQuestion} />
            </Button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="end"
              sideOffset={4}
              className={
                'z-50 w-[360px] rounded-md border border-border bg-popover p-4 text-foreground shadow-popup outline-none text-xs ' +
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
