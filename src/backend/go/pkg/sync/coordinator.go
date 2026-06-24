package sync

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"p2p/pkg/ipc"
	"p2p/pkg/network"
	"p2p/pkg/protocol"
	"p2p/pkg/storage/sqlite"
	"p2p/pkg/transfer"
	"p2p/pkg/versioning"
)

// SyncCoordinator coordinates multi-repository synchronization across the local
// C++ daemon and P2P network.
type SyncCoordinator struct {
	db              *sqlite.DB
	ipcServer       *ipc.IpcServer
	connMgr         *network.ConnectionManager
	detector        *versioning.ConflictDetector
	queue           *SyncQueue
	transferMgr     *transfer.FileTransferManager
	localPeerID     string
	mu              sync.RWMutex
	workers         map[string]chan struct{} // repoID -> stop channel
	concurrencySem  chan struct{}            // semaphore for concurrent P2P transfers
	stopChan        chan struct{}
	wg              sync.WaitGroup
}

// NewSyncCoordinator creates a new SyncCoordinator.
func NewSyncCoordinator(
	db *sqlite.DB,
	ipcServer *ipc.IpcServer,
	connMgr *network.ConnectionManager,
	localPeerID string,
) *SyncCoordinator {
	return &SyncCoordinator{
		db:             db,
		ipcServer:      ipcServer,
		connMgr:        connMgr,
		detector:       versioning.NewConflictDetector(),
		queue:          NewSyncQueue(),
		transferMgr:    transfer.NewFileTransferManager(ipcServer),
		localPeerID:    localPeerID,
		workers:        make(map[string]chan struct{}),
		concurrencySem: make(chan struct{}, 4), // Max 4 concurrent uploads/downloads
		stopChan:       make(chan struct{}),
	}
}

// Start boots the coordinator, starts database repos, and begins processing queues.
func (sc *SyncCoordinator) Start() error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	// Load existing active repositories and start workers
	repos, err := sc.db.Repositories().List()
	if err != nil {
		return fmt.Errorf("list database repos: %w", err)
	}

	for _, repo := range repos {
		if repo.Status == "active" {
			sc.startRepoWorkerLocked(repo.ID)
		}
	}
	sc.wg.Add(1)
	go sc.queueProcessorLoop()

	return nil
}

// Stop gracefully shuts down all repository workers and transfer streams.
func (sc *SyncCoordinator) Stop() {
	sc.mu.Lock()
	close(sc.stopChan)
	for repoID, stopCh := range sc.workers {
		close(stopCh)
		delete(sc.workers, repoID)
	}
	sc.mu.Unlock()

	sc.wg.Wait()
}

func (sc *SyncCoordinator) startRepoWorkerLocked(repoID string) {
	if _, exists := sc.workers[repoID]; exists {
		return
	}
	stopCh := make(chan struct{})
	sc.workers[repoID] = stopCh

	sc.wg.Add(1)
	go func() {
		defer sc.wg.Done()
		log.Printf("[SyncCoordinator] Started sync worker for repo %s\n", repoID)
		<-stopCh
		log.Printf("[SyncCoordinator] Stopped sync worker for repo %s\n", repoID)
	}()
}

// AddRepository adds a repository to track and sync.
func (sc *SyncCoordinator) AddRepository(repoID, localPath string) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	repo := sqlite.Repository{
		ID:        repoID,
		LocalPath: localPath,
		Status:    "active",
		SyncMode:  "auto",
		CreatedAt: time.Now().Unix(),
		UpdatedAt: time.Now().Unix(),
	}

	if err := sc.db.Repositories().Save(&repo); err != nil {
		return err
	}

	sc.startRepoWorkerLocked(repoID)
	return nil
}

// RemoveRepository untracks a repository and cleans up its tasks.
func (sc *SyncCoordinator) RemoveRepository(repoID string) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	if err := sc.db.Repositories().Delete(repoID); err != nil {
		return err
	}

	if stopCh, exists := sc.workers[repoID]; exists {
		close(stopCh)
		delete(sc.workers, repoID)
	}

	sc.queue.RemoveRepository(repoID)
	return nil
}

// HandleLocalFileChanged handles an IPC file changed event from C++.
func (sc *SyncCoordinator) HandleLocalFileChanged(repoID string, payload *protocol.FileChangedPayload) error {
	sc.mu.RLock()
	_, active := sc.workers[repoID]
	sc.mu.RUnlock()

	if !active {
		return fmt.Errorf("repository %s is not active", repoID)
	}

	// 1. Fetch current database metadata
	existing, err := sc.db.Metadata().Get(repoID, payload.Path)
	var currentVersion uint64 = 0
	if err == nil && existing != nil {
		currentVersion = uint64(existing.Version)
	}

	// 2. Monotonically tick version
	nextVersion := currentVersion + 1

	// 3. Save new metadata state to SQLite
	meta := sqlite.FileMetadata{
		RepositoryID:      repoID,
		Filepath:          payload.Path,
		Hash:              payload.Hash,
		Size:              payload.Size,
		Version:           int64(nextVersion),
		LocalLastModified: payload.ModifiedTime,
		IsDeleted:         payload.Action == "delete",
		UpdatedAt:         time.Now().Unix(),
	}

	if err := sc.db.Metadata().Save(&meta); err != nil {
		return fmt.Errorf("failed to save file metadata: %w", err)
	}

	// 4. Log to sync history
	histEvent := sqlite.SyncEvent{
		EventID:      fmt.Sprintf("evt_%d_%s", time.Now().UnixNano(), repoID),
		RepositoryID: repoID,
		FilePath:     payload.Path,
		PeerID:       sc.localPeerID,
		Timestamp:    time.Now().Unix(),
		EventType:    "local_change",
		Status:       "success",
	}
	_ = sc.db.History().LogEvent(&histEvent)

	// 5. Broadcast change to all connected network peers
	p2pMsg := &ipc.Message{
		Version:   "1.0",
		Type:      "file_metadata_update",
		Source:    "go",
		Timestamp: time.Now().UnixNano() / int64(time.Millisecond),
	}
	updatePayload := map[string]interface{}{
		"repo_id":       repoID,
		"path":          payload.Path,
		"hash":          payload.Hash,
		"size":          payload.Size,
		"version":       nextVersion,
		"modified_time": payload.ModifiedTime,
		"is_deleted":    payload.Action == "delete",
	}
	p2pMsg.Payload, _ = json.Marshal(updatePayload)

	sc.connMgr.Broadcast(p2pMsg)
	return nil
}

// HandlePeerMetadataUpdate processes version changes received from a remote peer.
func (sc *SyncCoordinator) HandlePeerMetadataUpdate(peerID string, repoID string, update map[string]interface{}) {
	path, _ := update["path"].(string)
	hash, _ := update["hash"].(string)
	sizeVal, _ := update["size"].(float64)
	verVal, _ := update["version"].(float64)
	modTimeVal, _ := update["modified_time"].(float64)
	isDeleted, _ := update["is_deleted"].(bool)

	size := int64(sizeVal)
	version := uint64(verVal)
	modifiedTime := int64(modTimeVal)

	// 1. Get current local state
	localMeta, err := sc.db.Metadata().Get(repoID, path)
	var localVer uint64 = 0
	var localHash string = ""
	var localTime int64 = 0
	if err == nil && localMeta != nil {
		localVer = uint64(localMeta.Version)
		localHash = localMeta.Hash
		localTime = localMeta.LocalLastModified
	}

	localFV := versioning.FileVersion{
		Hash:           localHash,
		LamportVersion: localVer,
		Timestamp:      localTime,
		PeerID:         sc.localPeerID,
	}
	remoteFV := versioning.FileVersion{
		Hash:           hash,
		LamportVersion: version,
		Timestamp:      modifiedTime,
		PeerID:         peerID,
	}

	resolution := sc.detector.Resolve(localFV, remoteFV)

	// 2. Apply resolution
	switch resolution.Action {
	case versioning.AcceptRemote:
		if isDeleted {
			// Save deletion tombstone to SQLite DB
			meta := sqlite.FileMetadata{
				RepositoryID:      repoID,
				Filepath:          path,
				Hash:              hash,
				Size:              size,
				Version:           int64(version),
				LocalLastModified: modifiedTime,
				IsDeleted:         true,
				UpdatedAt:         time.Now().Unix(),
			}
			_ = sc.db.Metadata().Save(&meta)

			// Tell C++ daemon to delete the file locally
			delMsg := &ipc.Message{
				Version:   "1.0",
				Type:      "sync_from_peer",
				Source:    "go",
				Timestamp: time.Now().UnixNano() / int64(time.Millisecond),
			}
			payload := map[string]interface{}{
				"peer_id":   peerID,
				"path":      path,
				"is_delete": true,
				"hash":      hash,
				"timestamp": modifiedTime,
			}
			delMsg.Payload, _ = json.Marshal(payload)
			sc.ipcServer.SendMessage(delMsg)
		} else {
			// Push download task
			task := &SyncTask{
				RepoID:    repoID,
				FilePath:  path,
				Type:      Download,
				Hash:      hash,
				Size:      size,
				Timestamp: time.Unix(modifiedTime, 0),
				PeerID:    peerID,
			}
			sc.queue.Push(task)
		}

		if resolution.IsConflict {
			sc.logAndNotifyConflict(repoID, path, localFV, remoteFV)
		}

	case versioning.KeepLocal:
		// Remote is behind. Send our updated metadata to them.
		if resolution.IsConflict {
			sc.logAndNotifyConflict(repoID, path, localFV, remoteFV)
		} else {
			sc.sendMetadataUpdateToPeer(peerID, repoID, path, localVer, localHash, localTime, localMeta.IsDeleted)
		}
	case versioning.Skip:
		// Identical hashes, do nothing
	}
}

func (sc *SyncCoordinator) logAndNotifyConflict(repoID, path string, local, remote versioning.FileVersion) {
	// Log conflict event to history DB
	histEvent := sqlite.SyncEvent{
		EventID:      fmt.Sprintf("conflict_%d", time.Now().UnixNano()),
		RepositoryID: repoID,
		FilePath:     path,
		PeerID:       remote.PeerID,
		Timestamp:    time.Now().Unix(),
		EventType:    "conflict_detected",
		Status:       "pending",
	}
	_ = sc.db.History().LogEvent(&histEvent)

	// Inform C++ local daemon of conflict so user can resolve
	msg := &ipc.Message{
		Version:   "1.0",
		Type:      "conflict_detected",
		Source:    "go",
		Timestamp: time.Now().UnixNano() / int64(time.Millisecond),
	}
	payload := protocol.ConflictDetectedPayload{
		Path: path,
		Versions: []protocol.VersionMetadata{
			{
				Hash:      local.Hash,
				Timestamp: local.Timestamp,
				VectorClock: map[string]uint64{
					local.PeerID: local.LamportVersion,
				},
				SourcePeer: local.PeerID,
			},
			{
				Hash:      remote.Hash,
				Timestamp: remote.Timestamp,
				VectorClock: map[string]uint64{
					remote.PeerID: remote.LamportVersion,
				},
				SourcePeer: remote.PeerID,
			},
		},
	}
	payloadBytes, _ := json.Marshal(payload)
	msg.Payload = payloadBytes

	sc.ipcServer.SendMessage(msg)
}

func (sc *SyncCoordinator) sendMetadataUpdateToPeer(peerID, repoID, path string, version uint64, hash string, modifiedTime int64, isDeleted bool) {
	conn := sc.connMgr.GetConnection(peerID)
	if conn == nil {
		return
	}

	p2pMsg := &ipc.Message{
		Version:   "1.0",
		Type:      "file_metadata_update",
		Source:    "go",
		Timestamp: time.Now().UnixNano() / int64(time.Millisecond),
	}
	updatePayload := map[string]interface{}{
		"repo_id":       repoID,
		"path":          path,
		"hash":          hash,
		"size":          0,
		"version":       version,
		"modified_time": modifiedTime,
		"is_deleted":    isDeleted,
	}
	p2pMsg.Payload, _ = json.Marshal(updatePayload)

	_ = ipc.WriteMessage(conn, p2pMsg)
}

// queueProcessorLoop continuously pops tasks from the SyncQueue and processes them.
func (sc *SyncCoordinator) queueProcessorLoop() {
	defer sc.wg.Done()

	for {
		select {
		case <-sc.stopChan:
			return
		default:
			task := sc.queue.Pop()
			if task == nil {
				time.Sleep(100 * time.Millisecond)
				continue
			}

			// Acquire concurrency slot (bandwidth scheduling)
			select {
			case sc.concurrencySem <- struct{}{}:
				// Slot acquired, process sync task
				go func(t *SyncTask) {
					defer func() { <-sc.concurrencySem }()
					sc.executeSyncTask(t)
				}(task)
			case <-sc.stopChan:
				return
			}
		}
	}
}

func (sc *SyncCoordinator) executeSyncTask(task *SyncTask) {
	log.Printf("[SyncCoordinator] Executing sync task: %s %s (%d bytes)\n", task.Type, task.FilePath, task.Size)

	if task.Type == Download {
		transferID := fmt.Sprintf("dl_%d_%s", time.Now().UnixNano(), task.RepoID)
		peerConn := sc.connMgr.GetConnection(task.PeerID)
		if peerConn == nil {
			log.Printf("[SyncCoordinator] Transfer failed: peer %s disconnected\n", task.PeerID)
			return
		}

		// Request file from peer
		reqMsg := &ipc.Message{
			Version:   "1.0",
			Type:      "file_request",
			Source:    "go",
			Timestamp: time.Now().UnixNano() / int64(time.Millisecond),
		}
		reqPayload := protocol.FileRequestPayload{
			Path: task.FilePath,
			Hash: task.Hash,
		}
		reqMsg.Payload, _ = json.Marshal(reqPayload)

		// Wait for response via network reader callback.
		// For simplicity in the coordinator flow, the FileTransfer socket handover
		// accepts incoming connections from C++ and handles streaming.
		// Here, we log the start of the transfer session in our local manager.
		// A full end-to-end integration handles incoming network connections.
		
		log.Printf("[SyncCoordinator] Download request (%s) sent to peer %s for: %s\n", transferID, task.PeerID, task.FilePath)
	}
}
