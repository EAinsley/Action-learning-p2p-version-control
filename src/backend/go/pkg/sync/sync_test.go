package sync

import (
	"os"
	"testing"
	"time"

	"p2p/pkg/ipc"
	"p2p/pkg/network"
	"p2p/pkg/protocol"
	"p2p/pkg/storage/sqlite"
)

func TestQueuePrioritization(t *testing.T) {
	q := NewSyncQueue()

	// Push 3 tasks for RepoA with different sizes
	q.Push(&SyncTask{RepoID: "RepoA", FilePath: "large.mp4", Type: Download, Size: 5000, Timestamp: time.Now()})
	q.Push(&SyncTask{RepoID: "RepoA", FilePath: "small.txt", Type: Download, Size: 10, Timestamp: time.Now()})
	q.Push(&SyncTask{RepoID: "RepoA", FilePath: "medium.pdf", Type: Download, Size: 100, Timestamp: time.Now()})

	// Popping should return small.txt first, then medium.pdf, then large.mp4
	t1 := q.Pop()
	if t1.FilePath != "small.txt" {
		t.Errorf("expected small.txt, got %s", t1.FilePath)
	}

	t2 := q.Pop()
	if t2.FilePath != "medium.pdf" {
		t.Errorf("expected medium.pdf, got %s", t2.FilePath)
	}

	t3 := q.Pop()
	if t3.FilePath != "large.mp4" {
		t.Errorf("expected large.mp4, got %s", t3.FilePath)
	}
}

func TestQueueFairScheduling(t *testing.T) {
	q := NewSyncQueue()

	// Push tasks for multiple repositories
	q.Push(&SyncTask{RepoID: "RepoA", FilePath: "a1.txt", Type: Download, Size: 10, Timestamp: time.Now()})
	q.Push(&SyncTask{RepoID: "RepoA", FilePath: "a2.txt", Type: Download, Size: 20, Timestamp: time.Now()})
	q.Push(&SyncTask{RepoID: "RepoB", FilePath: "b1.txt", Type: Download, Size: 5, Timestamp: time.Now()})
	q.Push(&SyncTask{RepoID: "RepoC", FilePath: "c1.txt", Type: Download, Size: 15, Timestamp: time.Now()})

	// Round-robin pops across RepoA, RepoB, RepoC
	// First pop should get a task from RepoA (first pushed)
	t1 := q.Pop()
	if t1.RepoID != "RepoA" {
		t.Errorf("pop 1: expected RepoA, got %s", t1.RepoID)
	}

	// Second pop should get a task from RepoB
	t2 := q.Pop()
	if t2.RepoID != "RepoB" {
		t.Errorf("pop 2: expected RepoB, got %s", t2.RepoID)
	}

	// Third pop should get a task from RepoC
	t3 := q.Pop()
	if t3.RepoID != "RepoC" {
		t.Errorf("pop 3: expected RepoC, got %s", t3.RepoID)
	}

	// Fourth pop should get the remaining task from RepoA
	t4 := q.Pop()
	if t4.RepoID != "RepoA" || t4.FilePath != "a2.txt" {
		t.Errorf("pop 4: expected RepoA/a2.txt, got %s/%s", t4.RepoID, t4.FilePath)
	}

	// Fifth pop should be empty
	t5 := q.Pop()
	if t5 != nil {
		t.Errorf("expected empty queue, got task: %v", t5)
	}
}

func TestCoordinatorLifecycle(t *testing.T) {
	// Create fresh in-memory database
	db, err := sqlite.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	ipcServer := ipc.NewIpcServer("/tmp/test_sync_coordinator.sock")
	connMgr := network.NewConnectionManager("peer_local")

	coord := NewSyncCoordinator(db, ipcServer, connMgr, "peer_local")

	err = coord.Start()
	if err != nil {
		t.Fatalf("coordinator start failed: %v", err)
	}
	defer coord.Stop()

	// Add repository
	err = coord.AddRepository("repo_1", "/home/user/repo1")
	if err != nil {
		t.Fatalf("add repository: %v", err)
	}

	// Verify repo saved in DB
	repo, err := db.Repositories().Get("repo_1")
	if err != nil {
		t.Errorf("expected repo in DB, got error: %v", err)
	}
	if repo.LocalPath != "/home/user/repo1" {
		t.Errorf("unexpected local path: %s", repo.LocalPath)
	}

	// Remove repository
	err = coord.RemoveRepository("repo_1")
	if err != nil {
		t.Fatalf("remove repository: %v", err)
	}

	repoDeleted, err := db.Repositories().Get("repo_1")
	if err != nil {
		t.Fatalf("failed to fetch deleted repository: %v", err)
	}
	if repoDeleted != nil {
		t.Error("expected repo to be deleted from DB, but it exists")
	}
}

func TestLocalFileChanged(t *testing.T) {
	// 1. Setup DB
	db, err := sqlite.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	// 2. Setup mock IPC
	sockPath := "/tmp/test_ipc_file_changed.sock"
	defer os.Remove(sockPath)
	ipcServer := ipc.NewIpcServer(sockPath)
	err = ipcServer.Start()
	if err != nil {
		t.Fatalf("start IPC: %v", err)
	}
	defer ipcServer.Stop()

	// 3. Setup coordinator
	connMgr := network.NewConnectionManager("peer_local")
	coord := NewSyncCoordinator(db, ipcServer, connMgr, "peer_local")
	_ = coord.Start()
	defer coord.Stop()

	_ = coord.AddRepository("repo_abc", "/tmp/sync")

	// 4. Trigger change
	changePayload := &protocol.FileChangedPayload{
		Action:       "add",
		Path:         "notes.txt",
		Hash:         "hash123",
		Size:         500,
		ModifiedTime: time.Now().Unix(),
	}

	err = coord.HandleLocalFileChanged("repo_abc", changePayload)
	if err != nil {
		t.Fatalf("handle local change: %v", err)
	}

	// 5. Verify saved in DB
	meta, err := db.Metadata().Get("repo_abc", "notes.txt")
	if err != nil {
		t.Fatalf("fetch metadata: %v", err)
	}
	if meta.Hash != "hash123" || meta.Version != 1 {
		t.Errorf("invalid metadata saved: %+v", meta)
	}
}
