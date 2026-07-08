# SLIDES CONTENT — Arihant's Parts

---

## SLIDE 0: Methodology — How We Built It (~45 sec, any member)

### Slide title: METHODOLOGY

**Visual**: Simple timeline or 4-phase horizontal flow

**On-slide text**:
```
4 phases — each informed by research:

Phase 1 (Apr-May): Research
  Studied distributed systems algorithms: Lamport clocks, CAP theorem, conflict resolution
  Tested mDNS/DNS-SD for peer discovery

Phase 2 (May): Core Prototyping
  Standalone Go networking module + C++ file-watcher daemon
  Independently tested before integration

Phase 3 (Jun): Integration & MVP
  End-to-end sync over Unix sockets
  JavaFX frontend connected via IPC bridge
  Thesis & Gen AI documentation submitted Jun 22

Phase 4 (Jul — now): Live Evaluation
  Latency & consistency testing on WLAN
  Final MVP, poster, 360 evaluation
```

**Design**: Clean horizontal timeline with 4 boxes. Each box has phase name, dates, 1-2 bullet points. Flat, monochrome.

---

## SLIDE 1: Networking Implementation (~90 sec speaking)

### Slide title: NETWORKING ARCHITECTURE

**Visual**: `networking_architecture.svg` (import to Canva, resize to fit)

**On-slide bullets** (bottom-left or right panel):

```
Three-phase P2P protocol:
  ① Discovery — mDNS broadcasts, zero-config, automatic
  ② Connection — TCP handshake, heartbeats, auto-reconnect
  ③ Sync — socket handover, Go streams data C++ writes to disk

Why Go for networking:
  • 10K+ concurrent peers via goroutines (not threads)
  • TCP server: 50 lines (vs 300+ in C++)
  • Channels eliminate deadlock risk
  • IPC overhead <1% of total transfer time
```

**Design note**: Keep the SVG as the hero visual (takes 70% of slide). Bullets on the side or bottom overlay. Dark theme background matches the SVG.

---

## SLIDE 2: Future Work (~55 sec speaking)

### Slide title: FUTURE WORK

**Visual**: 4 SVG icons arranged side-by-side or 2x2 grid
- `future_wan.svg` — WAN Sync
- `future_delta.svg` — Delta Sync
- `future_windows.svg` — Windows App
- `future_security.svg` — Encryption

**On-slide text below each icon**:

**WAN Sync**:
```
NAT Traversal / Internet Sync
  • Extend beyond LAN
  • Relay / hole-punching
  • Architecture supports it
```

**Delta Sync**:
```
Bandwidth Optimization
  • Send only file diffs
  • rsync-style algorithm
  • Critical for large files
```

**Windows App**:
```
Cross-Platform Support
  • Windows desktop build
  • Named pipes for IPC
  • macOS + Linux today
```

**Encryption**:
```
End-to-End Security
  • Authenticate peers
  • Encrypt data in transit
  • Foundation designed
```

**Design**: 2x2 grid of the 4 SVGs + text below each. Clean white background. Simple layout.

---

## SLIDE 3: Conclusion (~30 sec speaking)

### Slide title: THANK YOU

**Visual**: Project logo centered, team member names below

**On-slide text**:
```
PEER-TO-PEER FILE SYNC
A decentralized version control system

Built with Go · C++ · JavaFX
→ Automatic peer discovery
→ Real-time file sync
→ Conflict resolution (LWW + Vector Clocks)
→ Cross-platform desktop app

Team: Arihant · Huizhe · Shenkang · Nizar

>>> DEMO TIME <<<
```

**Design**: Clean, minimal. Project logo/name big. Names below. "DEMO" call-to-action prominent. Matches your Canva theme.

---

## SLIDE 4: Discussion — Networking (Arihant, ~1 min)

### Slide title: NETWORKING — WHAT WORKS & WHAT DOESN'T

**Visual**: Two-column layout — green header left, orange header right

**Left — What Works**:
```
✓ mDNS peer discovery — zero-config, automatic
✓ TCP connection lifecycle — handshake, heartbeats, reconnect
✓ 10K+ concurrent peers — goroutines scale cheaply
✓ IPC overhead <1% — Unix socket framing is efficient
```

**Right — Trade-offs / What Doesn't**:
```
✗ No encryption — P2P traffic is plaintext (LAN assumption)
✗ No rate limiting — broadcast creates unbounded goroutines
✗ LAN-only — no NAT traversal for WAN sync
✗ No peer identity verification — mDNS accepts anyone
```

**Bottom takeaway**:
```
Go handles networking because goroutines scale better than threads.
Trade-off: we optimized for LAN simplicity over WAN security.
```

**Design**: Simple two-column. Green/orange headers. Shows after network architecture diagram.

---

## SLIDE 5: Discussion — Overall Assessment (~1 min, any member)

### Slide title: OVERALL ASSESSMENT

**On-slide text**:
```
Architecture: Sound. Separation of concerns works correctly.

Trade-offs are deliberate:
  → Go for coordination (82%) — goroutines, channels, JSON
  → C++ for file I/O (18%) — direct OS access, atomic ops

What's next:
  → Fix the 5 critical audit gaps
  → Ship Windows support
  → Add encryption
```

**Design**: Clean, minimal. Three clear blocks.
