# P2P Version Control — Knowledge Graph

## Project Identity
- **Name**: P2P Version Control
- **Goal**: Decentralized peer-to-peer file synchronization with version tracking
- **Architecture**: Three-language polyglot system (Go + C++ + Java)
- **License**: Not specified (academic/research project)

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     JavaFX Frontend (Java 21)                 │
│  Launcher.java → HelloApplication.java → IpcBridge.java      │
│  Controllers: HelloController, RepositoryListController,     │
│               RepoStatusController                            │
│  Views: hello-view.fxml, repositoryList.fxml,                │
│         RepoStatusView.fxml, styles.css                       │
│  IPC: Unix socket /tmp/p2p_sync.sock, TCP fallback :9999    │
├──────────────────────────────────────────────────────────────┤
│                    Go Coordinator (Go 1.22)                   │
│  main.go — entry point, signal handling, PID file            │
│  pkg/ipc/       — Unix socket IPC server + framed JSON       │
│  pkg/network/   — TCP P2P connection manager, handshake,     │
│                   heartbeats, auto-reconnect                  │
│  pkg/discovery/ — mDNS peer discovery (zeroconf)             │
│  pkg/sync/      — SyncCoordinator, SyncQueue (priority),     │
│                   repo workers, C++ daemon lifecycle          │
│  pkg/transfer/  — FileTransferManager, TCP proxy streaming   │
│  pkg/versioning/— LamportClock, VectorClock, ConflictDetector│
│  pkg/storage/   — SQLite DB (repositories, file_metadata,    │
│                   sync_history tables)                        │
├──────────────────────────────────────────────────────────────┤
│                   C++ Watcher Daemon (C++20)                  │
│  main.cpp           — entry, IPC client, watcher orchestration│
│  ipc_client.cpp     — Unix socket IPC client                 │
│  filesystem_watcher — Polling-based directory watcher        │
│  sha256.cpp         — SHA-256 file hashing                   │
│  file_transfer.cpp  — Socket-based file upload/download      │
└──────────────────────────────────────────────────────────────┘
```

### Process Hierarchy
```
Java (IpcBridge) 
  └── Go Coordinator (main.go, PID file: /tmp/p2p_sync.pid)
       ├── C++ Daemon (repo_1, process group)
       ├── C++ Daemon (repo_2, process group)
       └── ... (one per tracked repository)
```

---

## Data Flow

### File Sync (Local Change → Remote Peers)
```
1. User creates/modifies file in watch directory
2. C++ Daemon detects change (polling every 1s)
3. C++ computes SHA-256 hash, packages file_changed IPC message
4. C++ → [Unix socket] → Go IPC server
5. Go SyncCoordinator.HandleLocalFileChanged():
   a. Looks up existing metadata in SQLite
   b. Increments Lamport version (currentVersion + 1)
   c. Saves new metadata to file_metadata table
   d. Logs sync_event to sync_history table
   e. Broadcasts file_metadata_update to all P2P peers
6. Remote peer receives via TCP → connection_manager.readLoop()
7. Remote OnMessage handler → coord.HandleP2PMessage("file_metadata_update")
8. HandlePeerMetadataUpdate():
   a. Compares local vs remote FileVersion via ConflictDetector
   b. If AcceptRemote → saves metadata, pushes Download task to SyncQueue
   c. If KeepLocal → sends own metadata back to peer
   d. If Skip → no-op (identical hashes)
   e. If Conflict → flags IsConflict, logs to DB, notifies C++
9. queueProcessorLoop → pops task (smallest file first, round-robin across repos)
10. executeSyncTask → sends file_request P2P message to source peer
11. Source peer's HandleP2PMessage("file_request"):
    a. Looks up file in SQLite
    b. transferMgr.StartUpload() → creates 2 TCP listeners:
       - Network port (for remote peer)
       - Local port (for local C++ daemon)
    c. Sends file_response P2P message with network port
    d. C++ connects to local port, starts reading file
12. Downloader receives file_response:
    a. transferMgr.StartDownload() → connects to remote network port
    b. Creates local TCP listener for C++ daemon
    c. Streams data: remote peer → Go proxy → local C++ daemon
    d. C++ writes to .tmp file, verifies SHA-256 hash
    e. Atomic rename .tmp → target file
    f. Applies file permissions
```

### IPC Protocol (All layers)
```
[4-byte big-endian length prefix][JSON payload UTF-8]
Length prefix: uint32 (big-endian, max 1MB)
JSON structure:
{
  "version": "1.0",
  "type": "<message_type>",
  "id": "msg_<timestamp>",
  "timestamp": 1704067200000,
  "source": "go" | "cpp" | "java",
  "payload": { ... }
}
```

### Message Types
| Type                    | Direction         | Purpose                           |
|-------------------------|-------------------|-----------------------------------|
| `handshake`             | P2P               | TCP connection establishment      |
| `ping` / `pong`        | P2P               | Heartbeat keep-alive              |
| `file_metadata_update`  | P2P               | Broadcast file version change     |
| `file_request`          | P2P               | Request file content              |
| `file_response`         | P2P               | Respond with transfer port/error  |
| `file_changed`          | IPC C++ → Go      | Local filesystem change event     |
| `prepare_file_transfer` | IPC Go → C++      | Instruct C++ to connect to socket |
| `sync_from_peer`        | IPC Go → C++      | Tell C++ to write/delete synced   |
| `file_transfer_complete`| IPC Go → C++      | Notify C++ of transfer result     |
| `conflict_detected`     | IPC Go → C++      | Notify user of concurrent edit    |
| `add_repository`        | IPC Java/Go → Go  | Track new sync directory          |
| `remove_repository`     | IPC                | Stop tracking directory           |
| `repo_list_request`     | IPC                | List tracked repositories         |
| `repo_list_response`    | IPC                | Response with repo list           |
| `repo_status_request`   | IPC                | List file states in repo          |
| `repo_status_response`  | IPC                | Response with file list           |
| `peer_list_request`     | IPC Go → C++     | Request peer list                 |
| `peer_list_update`      | IPC Go → C++     | Update peer list                  |

---

## Versioning System

### Lamport Clock (`pkg/versioning/lamport.go`)
- Per-file monotonic counter
- `Tick()` → increment for local changes
- `Witness(remote)` → `max(local, remote) + 1`
- Thread-safe via `sync.Mutex`
- JSON-serializable for P2P exchange

### Vector Clock (`pkg/versioning/vector_clock.go`)
- `map[string]uint64` — tracks per-peer counters
- `Tick(peerID)`, `Merge(remote)`, `Compare(other)`
- Compare returns: `Before`, `After`, `Equal`, `Concurrent`
- Used for causal relationship detection

### Conflict Detector (`pkg/versioning/conflict.go`)
- **Priority chain**: Hash equality → Lamport version → Timestamp → PeerID
- **Hash equal**: `Skip`
- **Remote version > Local**: `AcceptRemote` (or `KeepLocal` if local is newer)
- **Same version, different hash** (concurrent edit): Last-Write-Wins via physical timestamp
- **Same timestamp**: lexicographic peer ID comparison
- All concurrent edits flagged as `IsConflict = true`

---

## SQLite Schema (`pkg/storage/sqlite/`)

### `repositories` table
| Column      | Type    | Description                     |
|-------------|---------|---------------------------------|
| id          | TEXT PK | Repository identifier           |
| local_path  | TEXT    | Absolute path on disk           |
| status      | TEXT    | active/inactive                 |
| sync_mode   | TEXT    | auto/manual                     |
| created_at  | INTEGER | Unix timestamp                  |
| updated_at  | INTEGER | Unix timestamp                  |

### `file_metadata` table
| Column             | Type    | Description                     |
|--------------------|---------|---------------------------------|
| repo_id            | TEXT FK | References repositories(id)     |
| filepath           | TEXT    | Relative path in repo           |
| hash               | TEXT    | SHA-256 hex digest              |
| size               | INTEGER | File size in bytes              |
| version            | INTEGER | Lamport version counter         |
| local_last_modified| INTEGER | mtime from filesystem           |
| is_deleted         | INTEGER | Tombstone for deleted files     |
| mode               | INTEGER | Unix file permissions           |
| updated_at         | INTEGER | Last update timestamp           |
| **PK**             |         | (repo_id, filepath)             |

### `sync_history` table
| Column        | Type    | Description                     |
|---------------|---------|---------------------------------|
| event_id      | TEXT PK | Unique event ID                 |
| repo_id       | TEXT FK | References repositories(id)     |
| file_path     | TEXT    | Affected file                   |
| peer_id       | TEXT    | Source/destination peer         |
| timestamp     | INTEGER | Event timestamp                 |
| event_type    | TEXT    | local_change / sync_download / conflict_detected |
| status        | TEXT    | pending / success / failed      |
| details       | TEXT    | Optional error/details          |

---

## File Transfer Protocol

### Data Plane (separate from control plane)
- **Control plane**: Framed JSON over TCP (port 9876 by default) — for metadata, handshake, heartbeat
- **Data plane**: Raw TCP stream on ephemeral ports — for file content
- Each file transfer opens **two** TCP connections:
  1. Go ↔ Remote Peer (network side)
  2. Go ↔ Local C++ Daemon (localhost side)
- Go acts as a proxy: `io.Copy` between the two sockets
- Transfers are single-stream (not chunked)
- Max 4 concurrent transfers (semaphore in SyncCoordinator)
- Priority queue: smallest files first, round-robin across repos

### C++ Transfer Details
- Read/write buffer: 4096 bytes
- Download: `.tmp` file → SHA-256 verify → atomic rename
- Upload: read file → write to socket
- File permissions applied via `chmod` after atomic rename

---

## Process Lifecycle

### Startup Sequence
1. Java `IpcBridge.getInstance().connect()` called
2. `ensureGoCoordinatorRunning()`:
   a. Builds Go binary if in dev mode
   b. Searches for Go binary (4 locations)
   c. Launches Go via `ProcessBuilder`
   d. Quick health check (500ms)
3. Go `main()`:
   a. `checkAndKillStaleProcess()` — reads `/tmp/p2p_sync.pid`, kills old instance
   b. Writes PID to `/tmp/p2p_sync.pid`
   c. Probes P2P port, falls back to next available if busy
   d. Removes stale `/tmp/p2p_sync.sock`
   e. Starts IPC server (Unix socket, TCP fallback)
   f. Starts mDNS discovery
   g. Starts TCP connection manager
   h. Opens SQLite DB
   i. Starts SyncCoordinator (loads repos, spawns C++ daemon per repo)
4. C++ daemon per repo:
   a. Connects to Go's IPC socket
   b. Starts FileSystemWatcher polling loop (every 1s)
   c. Sends initial scan events to Go

### Shutdown Sequence
1. Java: `IpcBridge.disconnect()` or shutdown hook
2. Closes IPC socket channel
3. `goProcess.destroy()` (SIGTERM) → waits 5s → `destroyForcibly()` (SIGKILL) if needed
4. Cleanup `/tmp/p2p_sync.sock` and `/tmp/p2p_sync.pid`
5. Go receives SIGTERM:
   a. `coord.Stop()` — closes repo worker channels → sends SIGTERM to C++ process groups
   b. Waits 3s for C++ exit, then SIGKILL
   c. `connMgr.Stop()` — closes all P2P connections
   d. `ipcServer.Stop()` — closes IPC listener
   e. `db.Close()` — closes SQLite
   f. `removePIDFile()`

### Cleanup Resources
| Resource | Path | Cleared By |
|----------|------|------------|
| PID file | `/tmp/p2p_sync.pid` | Go (startup + shutdown), Java (shutdown) |
| IPC socket| `/tmp/p2p_sync.sock` | Go (startup), Java (shutdown) |
| Go log   | `/tmp/p2p_go.log` | Append-only |
| Java log | `/tmp/p2p_java.log` | Append-only |
| SQLite DB| `p2p_sync.db` | Persistent |

---

## Build Systems

### Three Independent Build Systems
| Component     | Build Tool   | Config File                    |
|---------------|-------------|--------------------------------|
| Java Frontend | Maven 3.8.5  | `pom.xml` (JDK 21, JavaFX 21)  |
| Go Coordinator| Go toolchain | `src/backend/go/go.mod` (Go 1.22) |
| C++ Daemon    | CMake 3.10+  | `src/backend/cpp/CMakeLists.txt` (C++20) |

### Build Scripts
| Script              | Target        | Method                                |
|---------------------|---------------|---------------------------------------|
| `build_linux.sh`    | Linux (native)| Go build → cmake → mvn jlink → jpackage |
| `build_linux_docker.sh` | Linux (Docker) | Docker build → same steps inside container |
| `build_linux_in_docker.sh` | (inner) | Steps executed inside container   |
| `Dockerfile.linux`  | Linux amd64   | Ubuntu 22.04 + JDK 21 + Go 1.24.4 + CMake |

### Multi-Platform Status
| Platform | Go Coord | C++ Daemon | JavaFX | Build Script |
|----------|----------|------------|--------|-------------|
| Linux x86_64 | ✅ | ✅ (inotify/poll) | ✅ | `build_linux.sh`, Docker |
| macOS (arm64/x86_64) | ✅ | ✅ (FSEvents/poll) | ✅ | ❌ Missing (`build_macos.sh`) |
| Windows | ✅ (TCP fallback) | ❌ (Unix socket + POSIX) | ✅ | ❌ Missing |
| Linux arm64 | ✅ | ✅ | ✅ | Via Docker buildx |

### C++ Platform Porting Required
- `ipc_client.cpp`: Uses `AF_UNIX`, `<sys/socket.h>`, `<sys/un.h>`, `<unistd.h>` — POSIX only
- `file_transfer.cpp`: Uses `<sys/socket.h>`, `<netinet/in.h>`, `<arpa/inet.h>`, `<unistd.h>` — POSIX only
- `CMakeLists.txt`: Links `pthread` — needs platform-conditional linking
- Windows fix: Replace Unix sockets with named pipes, POSIX sockets with Winsock2

---

## Testing Infrastructure

### Test Frameworks
| Layer    | Framework          | Config/Location                   |
|----------|-------------------|-----------------------------------|
| Go       | `testing` (stdlib) | `src/backend/go/pkg/*/*_test.go`  |
| C++      | CTest + Python3    | `src/backend/cpp/tests/`          |
| Java     | JUnit 5.12.1       | Declared in `pom.xml`, no tests yet |
| Integration | Python3         | `.agents/skills/p2p-multi-agent-testing/scripts/integration_harness.py` |

### Go Test Files (8 files, ~2216 lines)
| Package     | Tests | Coverage                    |
|-------------|-------|-----------------------------|
| versioning  | 20+   | Lamport, VectorClock, ConflictDetector (all edge cases) |
| sync        | 7     | Queue, Lifecycle, FileChanged, MetadataUpdate, E2E (2-peer) |
| network     | 4     | Handshake, Broadcast, Heartbeat, AutoReconnect |
| transfer    | 6     | Sessions, Streaming, IPv6, SizeMismatch, Upload |
| storage/sqlite | 13 | Schema, CRUD, ForeignKeys, Cascade Delete, History |
| protocol    | 4     | Payload validation, JSON round-trip |
| ipc         | 2     | Framing, Size limit |
| discovery   | 1     | Peer registry |

### CI (GitHub Actions)
- File: `.github/workflows/testing.yml`
- Runs on: push to `master` or `test/go-cpp-java-coordination`
- Jobs:
  1. `cmake-testing` (ubuntu-latest): cmake build + ctest
  2. `go-testing` (ubuntu-latest): go build + go test ./...
- **Missing**: macOS, Windows runners; Java tests; integration harness

---

## P2P Networking Details

### Peer Discovery (mDNS)
- Library: `github.com/grandcat/zeroconf`
- Service type: `_p2psync._tcp`
- Domain: `local.`
- Background goroutine continuously browses for peers
- Manual peers via `PEER_ADDRESSES` env var (format: `id@host:port,id2@host2:port2`)

### TCP Connection Manager
- Max concurrent: 10,000+ (goroutine per peer)
- Handshake: bidirectional JSON exchange on connect
- Heartbeat: ping/pong every 5s, timeout after 15s
- Auto-reconnect: exponential backoff (1s → 2s → 4s → max 60s)
- Thread-safe writes: `sync.Mutex` per peer connection

### Configuration (Environment Variables)
| Variable        | Default              | Description                    |
|-----------------|----------------------|--------------------------------|
| `PEER_ID`       | hostname             | Unique peer identifier         |
| `P2P_PORT`      | 9876                 | TCP port for P2P connections   |
| `IPC_SOCKET`    | `/tmp/p2p_sync.sock` | Unix domain socket path        |
| `DB_PATH`       | `p2p_sync.db`        | SQLite database file path      |
| `PEER_ADDRESSES`| (none)               | Manual peer list (fallback)    |

---

## Key File Index

### Go Source (coordinator + networking)
| File | Lines | Purpose |
|------|-------|---------|
| `src/backend/go/main.go` | ~300 | Entry point, signal handling, PID, wiring |
| `src/backend/go/pkg/ipc/ipc_server.go` | ~220 | IPC server + read/write helpers |
| `src/backend/go/pkg/network/connection_manager.go` | ~540 | TCP P2P connections |
| `src/backend/go/pkg/discovery/peer_discovery.go` | ~200 | mDNS peer discovery |
| `src/backend/go/pkg/sync/coordinator.go` | ~790 | Sync orchestration, C++ lifecycle |
| `src/backend/go/pkg/sync/queue.go` | ~120 | Priority sync queue |
| `src/backend/go/pkg/transfer/file_transfer.go` | ~340 | File transfer proxy |
| `src/backend/go/pkg/versioning/lamport.go` | ~80 | Lamport clock |
| `src/backend/go/pkg/versioning/vector_clock.go` | ~120 | Vector clock |
| `src/backend/go/pkg/versioning/conflict.go` | ~100 | Conflict resolution |
| `src/backend/go/pkg/protocol/messages.go` | ~100 | Message type definitions |
| `src/backend/go/pkg/storage/sqlite/db.go` | ~100 | DB connection + schema |
| `src/backend/go/pkg/storage/sqlite/repository.go` | ~120 | Repo CRUD |
| `src/backend/go/pkg/storage/sqlite/metadata.go` | ~150 | File metadata CRUD |
| `src/backend/go/pkg/storage/sqlite/history.go` | ~100 | Sync history CRUD |

### C++ Source (daemon)
| File | Lines | Purpose |
|------|-------|---------|
| `src/backend/cpp/src/main.cpp` | ~250 | Entry, IPC, watcher orchestration |
| `src/backend/cpp/src/ipc_client.cpp` | ~120 | Unix socket IPC client |
| `src/backend/cpp/src/filesystem_watcher.cpp` | ~140 | Polling directory watcher |
| `src/backend/cpp/src/sha256.cpp` | ~120 | SHA-256 hashing |
| `src/backend/cpp/src/file_transfer.cpp` | ~180 | File upload/download |

### Java Source (frontend)
| File | Lines | Purpose |
|------|-------|---------|
| `src/frontend/main/java/.../Launcher.java` | ~10 | Entry point |
| `src/frontend/main/java/.../HelloApplication.java` | ~30 | JavaFX app, lifecycle |
| `src/frontend/main/java/.../IpcBridge.java` | ~350 | IPC client, process mgmt |
| `src/frontend/main/java/.../HelloController.java` | ~80 | Main controller |
| `src/frontend/main/java/.../RepositoryListController.java` | ~120 | Repo list controller |
| `src/frontend/main/java/.../RepoStatusController.java` | ~60 | Repo status controller |
| `src/frontend/main/java/.../module-info.java` | ~12 | Java module descriptor |

### Build & Config
| File | Purpose |
|------|---------|
| `pom.xml` | Maven project (JavaFX 21, JDK 21, JUnit 5) |
| `src/backend/go/go.mod` | Go module (Go 1.22, zeroconf, go-sqlite3) |
| `src/backend/cpp/CMakeLists.txt` | CMake build (C++20, pthread) |
| `Dockerfile.linux` | Linux build environment |
| `build_linux.sh` | Native Linux build script |
| `build_linux_docker.sh` | Docker Linux build script |
| `build_linux_in_docker.sh` | Inner Docker build steps |
| `.github/workflows/testing.yml` | CI pipeline |

### Test Files
| File | Lines | Type |
|------|-------|------|
| `src/backend/go/pkg/versioning/versioning_test.go` | 280 | Go unit |
| `src/backend/go/pkg/sync/sync_test.go` | 485 | Go unit + E2E |
| `src/backend/go/pkg/network/connection_manager_test.go` | 284 | Go unit |
| `src/backend/go/pkg/transfer/transfer_test.go` | 414 | Go unit |
| `src/backend/go/pkg/storage/sqlite/db_test.go` | 409 | Go unit |
| `src/backend/go/pkg/ipc/ipc_server_test.go` | 77 | Go unit |
| `src/backend/go/pkg/protocol/messages_test.go` | 216 | Go unit |
| `src/backend/go/pkg/discovery/peer_discovery_test.go` | 50 | Go unit |
| `src/backend/cpp/tests/test_daemon_file_create.py` | 90 | C++ integration |
| `.agents/skills/p2p-multi-agent-testing/scripts/integration_harness.py` | 163 | E2E multi-peer |

---

## Known Issues & Technical Debt

### Critical
- [ ] **Windows C++ port**: `ipc_client.cpp` and `file_transfer.cpp` use POSIX-only APIs (Unix sockets, `unistd.h`, `arpa/inet.h`)
- [ ] **No macOS build script**: `build_macos.sh` needs to be created
- [ ] **No Java tests**: JUnit 5 declared in `pom.xml` but zero test classes exist

### Medium
- [ ] **CI limited to Linux**: No macOS/Windows runners in GitHub Actions
- [ ] **No Docker cross-compile for arm64**: Only linux/amd64 supported
- [ ] **C++ daemon uses polling only**: Despite mentions of inotify/FSEvents/ReadDirectoryChangesW, the watcher only polls every 1s
- [ ] **No health endpoint**: No way to query Go coordinator status from external tools

### Low
- [ ] **Hardcoded paths**: `/tmp/p2p_sync.sock`, `/tmp/p2p_sync.pid`, `/tmp/p2p_go.log`, `/tmp/p2p_java.log`
- [ ] **Java module name**: `org.codehaus.mojo.frontendtest` (legacy naming from starter template)
- [ ] **SQLite WAL mode not configured**: No `PRAGMA journal_mode=WAL` for concurrent access
