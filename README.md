# melanie

> Node-based interface for AI-assisted creative coding

melanie is a browser-only creative coding environment where sketches live as nodes on an infinite canvas. You write natural-language prompts; an LLM generates or transforms p5.js / three.js code; the result plays live inside the node. Nodes connect to form a non-linear authoring graph: branch, merge, compare, or extract ideas the way you would on a whiteboard.

Inspired by [Spellburst (UIST 2023)](https://dl.acm.org/doi/10.1145/3586183.3606719).

---

## Features

### Canvas & Nodes
- **Infinite canvas** powered by ReactFlow: pan, zoom, arrange freely
- **Sketch nodes** each holds a live p5.js or three.js preview, parameter sliders, and an inline code editor
- **Operator nodes**: sit between sketches and hold the prompt + generation state for a transformation

### Operations
| Operation | How to trigger | What it does |
|-----------|---------------|--------------|
| **Modify** | Drag connector → empty space, or OpsToolbar | Rewrite a sketch based on a natural-language prompt |
| **Duplicate** | Same | Exact copy of a sketch to branch from |
| **Extract** | Same | Isolate one visual element as a standalone sketch |
| **Merge** | Drag connector → another sketch, or OpsToolbar | Blend two sketches into one semantically |
| **Diff** | Drag connector → another sketch, or OpsToolbar | Text description of how two sketches differ |

### Parameters
- **Auto-extraction**: global numeric variables are detected with regex and turned into sliders
- **Semantic labels**: after generation, a second LLM call maps variable names to human-readable labels drawn from the original prompt (e.g. `circleSize` → *"ring diameter"*)
- **Drag to fix**: sliders work correctly inside ReactFlow nodes (pointer-event isolation)
- **Manual editing**: click the value badge beside any slider to type a number directly

### Parameter Transfer
Click a parameter label on sketch A to pick it up, then click sketch B. 
melanie creates a new sketch C that incorporates the concept of that parameter meaningfully, with two edges: a normal `B → C` edge and a dashed background `A → C` edge marking the parameter origin.

### Multi-Provider LLM
melanie works with five providers, bring your own key:

| Provider | Models |
|----------|--------|
| Anthropic | Claude Haiku 4.5, Sonnet 4.6, Opus 4.5 |
| OpenAI | GPT-4o mini, GPT-4o, o4-mini |
| Google Gemini | Gemini 2.0 Flash, 2.5 Flash Preview, 2.5 Pro Preview |
| Mistral | Mistral Small, Medium, Large |
| Groq | Multiple models |

Keys are stored in `localStorage`, never sent anywhere except the provider's own API. Everything runs in the browser, no backend.

### Other
- **Streaming**: code appears token by token as the model generates
- **Autocomplete**: pause while typing a prompt to get 3 AI-generated continuations
- **Live code editor** (CodeMirror 6): edit any sketch's source directly; `Ctrl+Enter` applies
- **Example sketches panel**: built-in starting points for p5.js and three.js

---

## Getting Started

### Prerequisites
- Node.js 18+
- An API key from at least one of the supported providers

### Install & run

```bash
git clone <repo-url>
cd melanie
npm install
npm run dev
```

Open `http://localhost:5173`, click **Connect Models**, add your key, and start prompting.

### Build

```bash
npm run build
```

Output goes to `dist/`. The app is fully static, drop it on any web host.

---

## How to use

### Creating your first sketch
The canvas opens with a starter sketch node. Open an operator node from the **OpsToolbar** (top-left) or drag a connector from the right handle of the sketch to empty space. Type a prompt and hit **Generate**.

### Connecting sketches
- **Drag** the right handle of any sketch node to empty space → a floating menu appears with Modify / Extract / Duplicate
- **Drag** directly onto another sketch → a Merge / Diff chooser appears
- **OpsToolbar** (aligned with the zoom controls, top-left) → click an operation, then click a sketch to apply it

### Editing parameters
Sliders appear below each sketch for every top-level numeric variable. The label shows the LLM-inferred semantic meaning rather than the raw variable name. Click the numeric badge to type a value directly.

### Transferring a parameter
1. Click a parameter label, it highlights with a `⇄` icon
2. Click any other sketch on the canvas
3. melanie creates a new sketch that incorporates the parameter concept, connected with a dashed origin edge

### Code editor
Click the `</>` button on any sketch to open it in the side panel. Changes apply on `Ctrl+Enter` and re-extract parameters automatically.

---

## Tech stack

| Concern | Library |
|---------|---------|
| Canvas / graph | [@xyflow/react](https://reactflow.dev) v12 |
| UI framework | React 18 + TypeScript |
| Styling | Tailwind CSS v3 (dark) |
| State | Zustand v5 |
| Code editor | CodeMirror 6 via @uiw/react-codemirror |
| LLM (Anthropic) | @anthropic-ai/sdk (browser mode) |
| LLM (others) | Fetch + SSE stream parsing |
| Icons | Font Awesome 6 (free-solid + free-brands) |
| Sketch runtimes | p5.js 1.11 · three.js r134 (CDN, inside sandboxed iframes) |
| Build | Vite 6 |

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Delete` | Delete selected node(s) |
| `Ctrl+Enter` | Apply code changes in the editor |
| `Escape` | Cancel pending operation mode |
| Double-click node title | Rename sketch |

---

## License

MIT
