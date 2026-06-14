# melanie

> Node-based interface for AI-assisted creative coding

melanie is a browser-only creative coding environment where sketches live as nodes on an infinite canvas. Write natural-language prompts; an LLM generates or transforms p5.js / three.js code; the result plays live inside the node. Nodes connect to form a non-linear authoring graph: branch, merge, compare, feedback, and wire live data between sketches.

Inspired by [Spellburst (UIST 2023)](https://dl.acm.org/doi/10.1145/3586183.3606719).

---

## Features

### Canvas & Node types

| Node | Description |
|------|-------------|
| **Sketch** | Live p5.js or three.js preview with parameter sliders, semantic axes, and code editor |
| **Operator** | Sits between sketches; holds a prompt and drives LLM-powered transformations |
| **Signal source** | Emits continuous numeric values (LFO, audio, mouse, MIDI, video…) into sketch parameters |
| **Feedback** | Routes a sketch's canvas as `window.feedbackFrame` (ImageBitmap) to another sketch at ~30 fps |

### Creating nodes — the Add-node menu

Press **Tab** anywhere on the canvas (or click the **＋ Add node** button, top-left) to open a tabbed palette at the cursor:

| Tab | What's inside |
|-----|--------------|
| **Operators** | Modify, Merge, Diff, Extract, Clone |
| **Sketches** | Blank p5.js sketch, blank three.js sketch |
| **Generators** | LFO · Clock · Noise · Pattern · Random · Constant |
| **Inputs** | Mic Level · Audio FFT · Audio Beat · Mouse · Keyboard · Scroll · MIDI · Webcam · Video In |
| **Effects** | Feedback loop · Threshold · Edge |

Every node type has one accent colour derived from its category tab.
Operator nodes are the exception — the tab is neutral but each op keeps its own colour.

### Connecting sketches (operators)

- **Drag** from the square **data-out** handle (right side, upper dot) of a sketch to empty space → operator picker appears (Modify / Extract / Duplicate)
- **Drag** directly to **another sketch's data-in** handle → Merge / Diff chooser
- After picking an operator from the Add-node menu → click the target sketch on the canvas

### Sketch → Sketch signal passthrough

Every sketch node has **two pairs of handles**:

| Handle | Symbol | Purpose |
|--------|--------|---------|
| data-in / data-out | coloured square, upper | Operator graph flow |
| sig-in / sig-out | white square, lower | Live numeric signals |

Connect a sketch's **sig-out** to another sketch's **sig-in** to wire live data:

1. The source sketch calls `output('channelName', value)` anywhere in its draw loop.
2. melanie detects the channel name statically (from code) and starts forwarding the live value each frame, excluding one-time setup calls.
3. The **code panel** of the receiving sketch shows a tray at the top listing all incoming channels with their live values. Click any channel box to insert a declaration (`let channelName = 0;`) so the sketch can use it.
4. When the source sketch's code or axes change and new `output()` channels appear, they propagate automatically — no reconnection needed.

### Signal sources → Sketch parameters

Connect any signal source node's output handle to a sketch to wire a live source to a parameter:

- **LFO**: sine/square/saw/triangle shape; rate, amplitude, offset controls
- **Clock**: BPM-based phase (0–1 saw) and beat (pulse) outputs
- **Noise**: smooth Perlin-style noise at a configurable frequency
- **Pattern**: step sequencer with clickable pads
- **Random**: white-noise or smoothed random at configurable rate
- **Constant**: fixed scalar value
- **Mic Level**: RMS amplitude from the microphone (`level`)
- **Audio FFT**: frequency bands (`sub · bass · mid · treble · presence`)
- **Audio Beat**: onset detection (`beat · energy`)
- **Mouse**: normalised position and velocity (`x · y · click · speed`)
- **Keyboard**: key-held and key-press impulse (`held · press`)
- **Scroll**: page scroll position and velocity (`y · velocity`)
- **MIDI**: note, velocity, active, CC from any connected device
- **Webcam**: colour averages and frame-diff motion (`brightness · r · g · b · motion`)
- **Video In**: load a local video file; same outputs as webcam
- **Threshold**: webcam → binary threshold; `ratio` (white pixel fraction) and `level`
- **Edge**: webcam → edge detection; `density` output; adjustable sensitivity

A binding menu appears when you drop a source handle onto a sketch: choose which parameter to drive. A dashed edge and a wire indicator appear next to that slider. Parameters driven by signals can no longer be scrubbed manually.

Signal values are stored in a plain ES Map (not React state) so they flow at 60 fps without triggering any re-renders.

### Feedback loops

Drop a **Feedback** node from the Effects tab, connect:

```
[Sketch A] ──→ [Feedback] ──→ [Sketch B]
```

Sketch A's canvas is captured at ~30 fps and delivered to Sketch B as `window.feedbackFrame` (an `ImageBitmap`). Use it in draw:

```js
if (window.feedbackFrame) {
  drawingContext.globalAlpha = 0.9;
  drawingContext.drawImage(window.feedbackFrame, 0, 0, width, height);
}
```

A self-feedback loop (A → feedback → A) creates persistence / echo effects.
The **Echo Trail** example in the panel demonstrates this end-to-end.

### Parameters

- **Auto-extraction**: top-level numeric (`let x = 5`) and colour (`let col = '#ff0000'`) declarations become sliders and swatches automatically.
- **Semantic labels**: after generation, a second LLM call maps variable names to human-readable descriptions from the prompt context.
- **Live patching**: slider and swatch changes are injected directly into the running iframe as `live-var` messages — the sketch never reloads. Only a full code edit bumps the generation key and remounts.
- **Signal binding indicators**: a wire icon appears next to parameters driven by a signal source.

### Operator transformations

| Operation | Result |
|-----------|--------|
| **Modify** | Rewrite a sketch based on a natural-language prompt |
| **Clone** | Exact copy to branch from |
| **Extract** | Isolate one visual element as a standalone sketch |
| **Merge** | Blend two sketches into one |
| **Diff** | Text summary of how two sketches differ; "Apply as modify" turns the delta into a Modify op |

Operators default to **manual** re-run. Toggle **● LIVE** on an operator to make it re-run automatically whenever its source sketch changes (debounced 2 s).

Cycle detection blocks any edge that would create a data-flow loop. Feedback edges are tagged separately and bypass the check intentionally.

### Regional edit

Click the **modify** (wand) button on a sketch to enter regional-edit mode:

1. Drag a rectangle over any part of the live preview.
2. Type a description of what to change in that area.
3. Hit **Apply edit** — only that region's behaviour is rewritten.

The edit is aborted automatically if another generation starts before it finishes.

### Semantic axes

Click the **axes** button to let the LLM decompose a sketch into bipolar semantic dimensions (e.g. "sparse ↔ dense", "fast ↔ slow"). Drag sliders to explore the space; melanie regenerates the sketch toward each pole. Scrubbing aborts any in-flight generation.

### Compare / Contact sheet

Click the **compare** button on any sketch to open a side-by-side contact sheet of all sibling sketches sharing the same upstream parent. Hover a tile to focus it; click **open code** to jump to that sketch's editor.

### Graph persistence

Use the buttons in the top bar:

| Button | Action |
|--------|--------|
| **Save** | Downloads the full graph as a `.json` file |
| **Open** | Loads a previously saved graph (replaces current canvas) |
| **Export** (per sketch) | Downloads a self-contained HTML file that runs the sketch with no dependencies |

### Code editor

Click **</>** on any sketch to open it in the sidebar:

- Edits apply on `Ctrl+Enter`; parameters are re-extracted automatically.
- If upstream sketches are connected via signal edges, a tray at the top of the panel lists all live incoming variables with their current numeric values. Click a variable box to insert a declaration.
- The editor **closes automatically** when the node is deselected.

### Parameter transfer

1. Click a parameter label — it highlights with a **⇄** icon.
2. Click any other sketch on the canvas.
3. melanie creates a new sketch that incorporates the parameter concept, with a dashed origin edge from the source.

### Multi-provider LLM

| Provider | Example models |
|----------|---------------|
| Anthropic | Claude Haiku 4.5, Sonnet 4.6, Opus 4.5 |
| OpenAI | GPT-4o mini, GPT-4o, o4-mini |
| Google Gemini | 2.0 Flash, 2.5 Flash Preview, 2.5 Pro Preview |
| Mistral | Small, Medium, Large |
| Groq | Multiple models |

API keys are stored in **sessionStorage** by default (cleared when the tab closes). Check **"Remember keys"** in the Connect Models dialog to persist them to `localStorage` — a notice explains the trade-off.

### Other
- **Streaming**: code appears token-by-token as the model generates
- **Autocomplete**: pause while typing a prompt to get 3 AI-generated completions
- **Background sketch**: set any sketch as a full-canvas background layer
- **Abort**: starting a new generation on the same operator or axis scrub aborts the previous one

---

## Getting Started

### Prerequisites
- Node.js 18+
- An API key from at least one supported provider

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

Output in `dist/`. Fully static — drop on any web host.

---

## Quick-start walkthroughs

### Generate a sketch
The canvas opens with a starter sketch. Press **Tab** → **Operators** → **Modify**, then click the sketch and write a prompt.

### Wire a signal to a parameter
1. Press **Tab** → **Generators** → **LFO** to drop an LFO node.
2. Drag its output handle to a sketch's input area.
3. A binding menu lists the sketch's parameters — pick one.
4. Watch the parameter animate continuously.

### Create a feedback trail
1. Press **Tab** → **Sketches** → **p5.js sketch**.
2. Press **Tab** → **Effects** → **Feedback loop**.
3. Connect: sketch **data-out** → feedback **in**, feedback **out** → sketch **data-in**.
4. In the sketch code, read `window.feedbackFrame` as shown in the Echo Trail example.

### Pass data between sketches
1. Drop two sketches.
2. In Sketch A's code, call `output('speed', someValue)` in the `draw` loop.
3. Connect Sketch A **sig-out** → Sketch B **sig-in**.
4. Open Sketch B's code editor — the `speed` variable appears in the tray. Click it to declare it.
5. Use `speed` in Sketch B's code normally.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| **Tab** | Open / close the Add-node menu at the cursor |
| **Delete** | Delete selected node(s) |
| **Ctrl+Enter** | Apply code changes in the editor |
| **Escape** | Close Add-node menu or cancel pending operation |
| Double-click node title | Rename sketch |

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
| Icons | @carbon/icons-react |
| Sketch runtimes | p5.js 1.11 · three.js r134 (CDN, sandboxed iframes) |
| Build | Vite 6 |

---

## License

MIT
