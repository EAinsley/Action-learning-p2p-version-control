# TALKING SCRIPT — Arihant

---

## PART 1: NETWORKING IMPLEMENTATION (~95 sec)

**[Slide: Networking Architecture Diagram]**

**0:00-0:20 — Discovery Phase** (point to mDNS arrows):
> "Our networking has three phases. First: **peer discovery**. When you launch the app on any machine, the Go coordinator broadcasts its presence via **mDNS** — multicast DNS. Other peers on the same LAN automatically discover it. No configuration, no server, no setup. Zero-conf, just like AirDrop or Chromecast."

**0:20-0:45 — Connection Phase** (point to TCP arrows):
> "Once discovered, peers establish a **TCP connection** on port 9876. The Go connection manager handles the full lifecycle: a handshake protocol exchanges peer IDs, periodic **heartbeats** detect failures within seconds, and if a peer drops, **exponential-backoff reconnect** brings it back automatically."

**0:45-1:10 — Sync Phase** (point to File Transfer + C++):
> "When a file changes, the C++ daemon detects it, computes a SHA-256 hash, and sends the event to Go via IPC. Go then broadcasts metadata to peers, resolves conflicts using **vector clocks** and **Last-Write-Wins**, and initiates the transfer. Here's the key pattern: Go creates a TCP socket, tells C++ to connect to it, then **streams data directly** from the network socket to C++ — which writes it to disk. Zero intermediate buffering."

**1:10-1:35 — Why Go** (point to the Go box):
> "We chose Go for all of this because its **goroutines** let us handle **10,000+ concurrent peers** with minimal resources. The same TCP server takes **50 lines** in Go versus **300+ in C++**. And Go's channels eliminate deadlock risks when coordinating multiple repositories simultaneously. The IPC overhead between Go and C++? Less than **1% of total transfer time** — the network is the real bottleneck."

**[Transition: "Now let me walk through the networking pieces and what we got right and what we'd improve."]**

---

## PART 1.5: DISCUSSION — NETWORKING (~1 min)

**[Slide: Networking Discussion — What Works / What Doesn't]**

**0:00-0:30 — What works in networking** (point to green column):
> "On networking specifically, three things work well. **Peer discovery** via mDNS is zero-config — peers find each other automatically on any LAN, just like AirDrop. The **TCP connection manager** handles the full lifecycle: handshake, heartbeats every few seconds, and exponential-backoff reconnect if a peer drops. And the **goroutine model** means we handle thousands of concurrent peers without thread explosion — each goroutine costs under 1KB of memory."

**0:30-0:45 — The Go vs C++ decision for networking**:
> "We put all networking in Go because the numbers speak for themselves: a TCP server takes 50 lines in Go versus 300+ in C++. Channels eliminate deadlock risk when routing messages across multiple repositories. And the **IPC overhead between Go and C++ is under 1%** of total transfer time — the network itself is 97.5% of the bottleneck."

**0:45-1:00 — What doesn't work / trade-offs** (point to orange column):
> "The honest gaps: our **P2P traffic is plaintext** — anyone on the LAN can read file data. There's **no rate limiting on broadcasts**, so a flood of file changes could exhaust goroutines. And we're **LAN-only** with no NAT traversal — you can't sync across the internet. These are deliberate trade-offs: we optimized for LAN simplicity over WAN security. The architecture supports adding TLS and NAT hole-punching without a rewrite."

**[Transition to next — Huizhe for Filesystem or another member for their discussion]**

---

## PART 2: FUTURE WORK (~55 sec)

**[Slide: Future Work — 4 cards in 2x2 grid]**

**0:00-0:15 — WAN Sync** (point to top-left):
> "For future work, the first priority is extending beyond local networks. Our architecture supports NAT traversal through relay or hole-punching — we want this to work anywhere, not just the same LAN."

**0:15-0:28 — Delta Sync** (point to top-right):
> "Second, **delta sync**. Currently we transfer entire files every time. Adding an rsync-style algorithm would send only changed portions — critical for bandwidth efficiency."

**0:28-0:42 — Windows App** (point to bottom-left):
> "Third, **Windows support**. Our build system currently targets macOS and Linux. Porting to Windows means replacing Unix sockets with named pipes for IPC. The architecture is designed for this — the IPC abstraction already has a TCP fallback path."

**0:42-0:55 — Security** (point to bottom-right):
> "And finally, **end-to-end encryption** and peer authentication. The socket handover pattern was designed for this — we can add encryption on the data channel without changing the architecture."

---

## PART 3: CONCLUSION (~30 sec)

**[Slide: Thank You / Conclusion]**

**0:00-0:10 — Return to thesis**:
> "To summarize: we set out to build a **decentralized version control system** — one that works without any central server, on any local network."

**0:10-0:20 — Name contribution**:
> "We delivered a fully working system with automatic peer discovery, real-time file sync, vector clock conflict resolution, and a cross-platform desktop UI — all in under **5,000 lines of Go** and **1,200 lines of C++**."

**0:20-0:30 — Handoff to demo**:
> "The system compiles and runs on macOS and Linux today. Now let's show you exactly how it works."

**[Step back, gesture toward screen → Demo team takes over]**
