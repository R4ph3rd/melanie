# melanie

> Node-based interface for AI-assisted creative coding

melanie is a browser-only creative coding environment where sketches live as nodes on an infinite canvas. Write natural-language prompts; an LLM generates or transforms p5.js / three.js code; the result plays live inside the node. Nodes connect to form a non-linear authoring graph: branch, merge, compare, feedback, and wire live data between sketches.

Inspired by [Spellburst (UIST 2023)](https://dl.acm.org/doi/10.1145/3586183.3606719).

<!-- SCREENSHOT: full canvas with several sketch nodes, an operator, signal source, and edges
     Replace the src below with your GitHub-hosted asset URL after uploading via an issue/PR drag-drop.
     Example format: https://github.com/r4ph3rd/melanie/assets/<id>/canvas-overview.png -->
![Canvas overview](docs/screenshots/canvas-overview.png)

---

## Features

### Canvas & node types

| Node | Accent | Description |
|------|--------|-------------|
| **Sketch** | purple / blue | Live p5.js or three.js preview with parameter sliders, semantic axes, code editor, and signal handles |
| **Operator** | per-op colour | Sits between sketches; holds a prompt and drives LLM-powered transformations |
| **Signal source** | teal / sky / orange | Emits continuous numeric values (LFO, audio, mouse, MIDI, video…) into sketch parameters |
| **Feedback** | orange | Routes a sketch's canvas as `window.feedbackFrame` to another sketch at ~30 fps |

---

### Add-node menu

Press **Tab** anywhere on the canvas (or click **＋ Add node**, top-left) to open a tabbed palette at the cursor position.

<!-- SCREENSHOT: Add-node menu open, showing the 5 tabs -->
![Add-node menu](docs/screenshots/add-node-menu.png)

| Tab | Contents | Accent colour |
|-----|----------|---------------|
| **Operators** | Modify · Merge · Diff · Extract · Clone | per-op |
| **Sketches** | Blank p5.js · Blank three.js | purple |
| **Generators** | LFO · Clock · Noise · Pattern · Random · Constant | sky blue |
| **Inputs** | Mic Level · Audio FFT · Audio Beat · Mouse · Keyboard · Scroll · MIDI · Webcam · Video In | teal |
| **Effects** | Feedback loop · Threshold · Edge | orange |

Each category has one accent colour carried through to the node's handles, border highlight, and menu entry. Operators are the exception — the tab is neutral grey but each op keeps its own colour in both the menu and on the canvas.

Tab again (or press **Escape**) to dismiss the menu without creating a node.

---

### Connecting sketches (operators)

<!-- VIDEO: drag data-out → empty canvas → operator picker appears → pick Modify → prompt appears
     Upload to GitHub via drag-drop in an issue, then paste the generated URL here.
     <video src="https://github.com/r4ph3rd/melanie/assets/<id>/connect-operator.mp4" autoplay loop muted></video> -->

- **Drag** from the coloured square **data-out** handle (right side, upper dot) of a sketch to empty space → operator picker appears (Modify / Extract / Clone)
- **Drag** directly to **another sketch's data-in** handle → Merge / Diff chooser
- After picking an operator from the Add-node menu → click the target sketch on the canvas to complete the wiring

Cycle detection blocks any edge that would create a data-flow loop. Feedback edges are tagged separately and bypass the check intentionally.

---

### Sketch → Sketch signal passthrough

Every sketch node exposes **two pairs of handles**, grouped at the vertical centre of the node:

<!-- SCREENSHOT: zoomed-in view of a sketch node's right-side handles — coloured square (data-out) and white square (sig-out) close together -->
![Sketch node handles](docs/screenshots/sketch-handles.png)

| Handle | Symbol | Side | Purpose |
|--------|--------|------|---------|
| data-in / data-out | coloured square (upper) | left / right | Operator graph flow |
| sig-in / sig-out | white square (lower) | left / right | Live numeric signals between sketches |

Connect a sketch's **sig-out** to another sketch's **sig-in** to wire live data:

<!-- SCREENSHOT: two sketches connected by a white dashed marching-dash edge (sig passthrough) -->
![Signal passthrough edge](docs/screenshots/signal-edge.png)

1. The source sketch calls `output('channelName', value)` inside its `draw` loop.
2. melanie detects channel names statically (scanning the code, excluding `setup`/`preload` bodies) and forwards the live value each frame to the target.
3. The **code panel** of the receiving sketch shows a collapsible tray — always visible when a sig edge is connected — listing all incoming channels with their live numeric values.
4. Click any channel pill to insert `let channelName = 0; // ← signal in` at the top of the code.
5. When the source sketch's code changes and new `output()` calls appear, they propagate automatically without reconnecting.

```js
// Source sketch — inside draw():
output('speed', frameCount * 0.01);
output('hue',   _h / 360);
```

**Edge colour key**

| Edge type | Colour | Style |
|-----------|--------|-------|
| Operator / data flow | `#4a4a6a` (indigo-grey) | solid |
| Sketch → sketch signal | `#c8c8c8` (light white) | marching dashes |
| Source → parameter binding | `#0ea5e9` (sky blue) | marching dashes |
| Feedback | `#f97316` (orange) | short dashes |
| Parameter transfer | `#555` (dim grey) | dashed, faint |

All edges render **behind** nodes so they never obscure the live previews.

---

### Edge reconnection

<!-- VIDEO: user grabs the endpoint of an existing edge, drags it to a different handle, releases
     <video src="https://github.com/r4ph3rd/melanie/assets/<id>/edge-reconnect.mp4" autoplay loop muted></video> -->

- **Drag an edge endpoint** to reconnect it to a different handle on any compatible node.
- **Drop on empty canvas** to delete the edge (and remove its signal binding, if any).

---

### Signal sources → Sketch parameters

Connect any signal source node's output handle to a sketch to wire a live source to one of its parameters:

<!-- SCREENSHOT: LFO node connected to a sketch's parameter; the binding edge (sky blue dashes) and the wire icon next to the slider -->
![LFO → parameter binding](docs/screenshots/signal-binding.png)

| Source | Outputs |
|--------|---------|
| **LFO** | Sine / square / saw / triangle — rate, amplitude, offset |
| **Clock** | BPM-based `phase` (0–1 saw) and `beat` (pulse) |
| **Noise** | Smooth Perlin-style noise at configurable frequency |
| **Pattern** | Step sequencer with clickable pads |
| **Random** | White-noise or smoothed random at configurable rate |
| **Constant** | Fixed scalar value |
| **Mic Level** | RMS amplitude from the microphone (`level`) |
| **Audio FFT** | Frequency bands (`sub · bass · mid · treble · presence`) |
| **Audio Beat** | Onset detection (`beat · energy`) |
| **Mouse** | Normalised position and velocity (`x · y · click · speed`) |
| **Keyboard** | Key-held and key-press impulse (`held · press`) |
| **Scroll** | Page scroll position and velocity (`y · velocity`) |
| **MIDI** | Note, velocity, active, CC from any connected device |
| **Webcam** | Colour averages and frame-diff motion (`brightness · r · g · b · motion`) |
| **Video In** | Load a local video file; same outputs as Webcam |
| **Threshold** | Webcam → binary threshold; `ratio` (white-pixel fraction) and `level` |
| **Edge** | Webcam → edge detection; `density` output; adjustable sensitivity |

A binding menu appears when you drop a source handle onto a sketch — choose which parameter to drive. A dashed edge and a wire icon appear next to that slider. Parameters driven by signals can no longer be scrubbed manually.

Signal values are stored in a plain ES Map (not React state) so they flow at 60 fps without triggering any re-renders.

---

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
  drawingContext.globalAlpha = 1;
}
```

A self-feedback loop (A → feedback → A) creates persistence / echo effects.
The **Echo Trail** example in the panel demonstrates this end-to-end.

---

### Code editor

Click **</>** on any sketch to open it in the sidebar:

<!-- SCREENSHOT: code panel open showing the signal-in tray at top with channel pills and live values -->
![Code panel with signal tray](docs/screenshots/code-panel-signal-tray.png)

- **Signal-in tray**: always shown when a sketch's sig-in is connected to another sketch. Displays `N dynamic variables from SketchName`. Click ▼/▶ to expand/collapse the list of channel pills — each pill shows the channel name and its current live value.
- Click a channel pill to insert `let channelName = 0; // ← signal in` at the top of the code so the sketch can reference it.
- Edits apply on `Ctrl+Enter`; parameters are re-extracted automatically.
- The editor **closes automatically** when the node is deselected.
- Clicking any sketch toolbar button (play, code, export…) on an **unselected node** automatically selects it first, then performs the action.

---

### Parameters

- **Auto-extraction**: top-level numeric (`let x = 5`) and colour (`let col = '#ff0000'`) declarations become sliders and swatches automatically.
- **Semantic labels**: after generation, a second LLM call maps variable names to human-readable descriptions from the prompt context.
- **Live patching**: slider and swatch changes are injected directly into the running iframe as `live-var` messages — the sketch never reloads. Only a full code edit bumps the generation key and remounts.
- **Signal binding indicators**: a wire icon appears next to parameters driven by a signal source.

---

### Operator transformations

<!-- SCREENSHOT: an Operator node between two sketches, showing the prompt field and Run / LIVE buttons -->
![Operator node](docs/screenshots/operator-node.png)

| Operation | Result |
|-----------|--------|
| **Modify** | Rewrite a sketch based on a natural-language prompt |
| **Clone** | Exact copy to branch from |
| **Extract** | Isolate one visual element as a standalone sketch |
| **Merge** | Blend two sketches into one |
| **Diff** | Text summary of how two sketches differ; "Apply as modify" turns the delta into a Modify op |

Operators default to **manual** re-run. Toggle **● LIVE** on an operator to make it re-run automatically whenever its source sketch changes (debounced 2 s).

---

### Regional edit

Click the **modify** (wand) button on a sketch to enter regional-edit mode:

<!-- VIDEO: drag rectangle over sketch preview → type description → Apply edit → region updates
     <video src="https://github.com/r4ph3rd/melanie/assets/<id>/regional-edit.mp4" autoplay loop muted></video> -->

1. Drag a rectangle over any part of the live preview.
2. Type a description of what to change in that region.
3. Hit **Apply edit** — only that region's behaviour is rewritten.

The edit is aborted automatically if another generation starts before it finishes.

---

### Semantic axes

Click the **axes** button to let the LLM decompose a sketch into bipolar semantic dimensions (e.g. "sparse ↔ dense", "fast ↔ slow").

<!-- VIDEO: axes panel opens → user drags an axis slider → sketch live-regenerates toward that pole
     <video src="https://github.com/r4ph3rd/melanie/assets/<id>/semantic-axes.mp4" autoplay loop muted></video> -->

Drag sliders to explore the space; melanie regenerates the sketch toward each pole. Scrubbing aborts any in-flight generation.

---

### Compare / Contact sheet

Click the **compare** button on any sketch to open a side-by-side contact sheet of all sibling sketches sharing the same upstream parent.

<!-- SCREENSHOT: contact sheet view with 4 sketch tiles side by side -->
![Contact sheet](docs/screenshots/contact-sheet.png)

Hover a tile to focus it; click **open code** to jump to that sketch's editor.

---

### Graph persistence

Use the buttons in the top bar:

| Button | Action |
|--------|--------|
| **Save** | Downloads the full graph as a `.json` file |
| **Open** | Loads a previously saved graph (replaces current canvas) |
| **Export** (per sketch) | Downloads a self-contained HTML file that runs the sketch with no dependencies |

---

### Parameter transfer

<!-- VIDEO: click a parameter label (⇄ icon appears) → click another sketch → new sketch is created with a dashed origin edge
     <video src="https://github.com/r4ph3rd/melanie/assets/<id>/param-transfer.mp4" autoplay loop muted></video> -->

1. Click a parameter label — it highlights with a **⇄** icon.
2. Click any other sketch on the canvas.
3. melanie creates a new sketch that incorporates the parameter concept, with a dashed origin edge from the source.

---

### Multi-provider LLM

| Provider | Example models |
|----------|---------------|
| Anthropic | Claude Haiku 4.5, Sonnet 4.6, Opus 4.5 |
| OpenAI | GPT-4o mini, GPT-4o, o4-mini |
| Google Gemini | 2.0 Flash, 2.5 Flash Preview, 2.5 Pro Preview |
| Mistral | Small, Medium, Large |
| Groq | Multiple models |

API keys are stored in **sessionStorage** by default (cleared when the tab closes). Check **"Remember keys"** in the Connect Models dialog to persist them to `localStorage` — a notice explains the trade-off.

---

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

<!-- VIDEO: Tab → Operators → Modify → click sketch → type prompt → code streams → preview updates
     <video src="https://github.com/r4ph3rd/melanie/assets/<id>/generate-sketch.mp4" autoplay loop muted></video> -->

### Wire a signal to a parameter

1. Press **Tab** → **Generators** → **LFO** to drop an LFO node.
2. Drag its output handle to a sketch's input area.
3. A binding menu lists the sketch's parameters — pick one.
4. Watch the parameter animate continuously.

<!-- VIDEO: drop LFO → drag handle → binding menu → pick parameter → slider animates
     <video src="https://github.com/r4ph3rd/melanie/assets/<id>/lfo-binding.mp4" autoplay loop muted></video> -->

### Create a feedback trail

1. Press **Tab** → **Sketches** → **p5.js sketch**.
2. Press **Tab** → **Effects** → **Feedback loop**.
3. Connect: sketch **data-out** → feedback **in**, feedback **out** → sketch **data-in**.
4. In the sketch code, read `window.feedbackFrame` as shown in the Echo Trail example.

### Pass data between sketches

1. Drop two sketches on the canvas.
2. In Sketch A's code, call `output('speed', someValue)` inside the `draw` loop.
3. Connect Sketch A **sig-out** → Sketch B **sig-in** (white handles, lower pair).
4. Open Sketch B's code editor — the signal tray appears at the top showing `1 dynamic variable from Sketch A`. Click the `speed` pill to declare it.
5. Use `speed` in Sketch B's draw loop normally.

<!-- VIDEO: sig-out drag → sig-in → code panel opens → signal tray expands → pill clicked → var declared
     <video src="https://github.com/r4ph3rd/melanie/assets/<id>/sketch-to-sketch.mp4" autoplay loop muted></video> -->

### Reconnect or delete an edge

- **Reconnect**: grab any edge endpoint and drag it to a different handle. The edge updates in place; signal bindings are cleaned up automatically.
- **Delete by drag**: grab an edge endpoint and release it on empty canvas — the edge is removed.

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

## Adding screenshot / video assets

All image and video links in this README use the path prefix `docs/screenshots/` or reference GitHub video asset URLs. To fill them in:

1. **Screenshots** — drag PNG/JPG files into a GitHub issue comment to get a CDN URL, then paste it into the `src` attribute, or add the files to `docs/screenshots/` in the repo.
2. **Videos** — drag an MP4 file into a GitHub issue comment; GitHub generates a URL like `https://github.com/r4ph3rd/melanie/assets/<id>/filename.mp4`. Replace the placeholder URL in each `<video>` comment with that URL and uncomment the tag.

Suggested captures:

| File | What to show |
|------|-------------|
| `canvas-overview.png` | Full canvas with sketches, an operator, a signal source, edges |
| `add-node-menu.png` | Tab menu open, Generators tab highlighted |
| `sketch-handles.png` | Right side of a sketch node: coloured data-out (upper) and white sig-out (lower) grouped together |
| `signal-edge.png` | Two sketches linked by a white marching-dash edge |
| `signal-binding.png` | LFO node connected to a sketch; sky-blue binding edge; wire icon on slider |
| `code-panel-signal-tray.png` | Code panel open, tray expanded showing channel pills with live values |
| `operator-node.png` | Operator between two sketches, prompt field visible |
| `contact-sheet.png` | Compare view with 4 sibling sketch tiles |
| `connect-operator.mp4` | Drag data-out → empty canvas → operator picker → Modify selected |
| `edge-reconnect.mp4` | Grab edge endpoint → drag to new handle → release |
| `regional-edit.mp4` | Draw region rectangle → type prompt → Apply edit |
| `semantic-axes.mp4` | Axes panel → scrub slider → sketch regenerates |
| `lfo-binding.mp4` | Drop LFO → drag handle → binding menu → slider animates |
| `sketch-to-sketch.mp4` | Connect sig-out → sig-in → signal tray appears → pill click |
| `generate-sketch.mp4` | Full generate flow: Tab → Modify → click → prompt → streaming |
| `param-transfer.mp4` | Click param label → click other sketch → new sketch created |

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
