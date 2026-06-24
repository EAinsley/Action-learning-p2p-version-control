package transfer

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"testing"
	"time"

	"p2p/pkg/ipc"
)

func TestFileTransferSessionCreation(t *testing.T) {
	sockPath := "/tmp/test_transfer_session.sock"
	defer os.Remove(sockPath)

	ipcServer := ipc.NewIpcServer(sockPath)
	err := ipcServer.Start()
	if err != nil {
		t.Fatalf("start ipc server: %v", err)
	}
	defer ipcServer.Stop()

	ft := NewFileTransferManager(ipcServer)

	// Mock peer connection
	netListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer netListener.Close()
	netPort := netListener.Addr().(*net.TCPAddr).Port

	// Start P2P listener in bg
	go func() {
		conn, err := netListener.Accept()
		if err == nil {
			conn.Close()
		}
	}()

	err = ft.StartDownload("trans_123", "docs/file.txt", "peer_bob", "hash123", 100, "127.0.0.1", netPort)
	if err != nil {
		t.Fatalf("start download failed: %v", err)
	}

	session, exists := ft.GetSession("trans_123")
	if !exists {
		t.Fatal("session not found")
	}
	if session.Status != "preparing" && session.Status != "streaming" {
		t.Errorf("unexpected session status: %s", session.Status)
	}
	if session.FilePath != "docs/file.txt" {
		t.Errorf("unexpected filepath: %s", session.FilePath)
	}
}

func TestFileTransferStreaming(t *testing.T) {
	sockPath := "/tmp/test_transfer_streaming.sock"
	defer os.Remove(sockPath)

	ipcServer := ipc.NewIpcServer(sockPath)
	err := ipcServer.Start()
	if err != nil {
		t.Fatalf("start ipc: %v", err)
	}
	defer ipcServer.Stop()

	// Connect mock C++ client to receive prepare messages
	var prepareMsgReceived chan *ipc.Message = make(chan *ipc.Message, 5)
	ipcServer.OnMessage = func(msg *ipc.Message) error {
		return nil
	}

	// We need a dummy client to connect to the Unix/TCP socket so messages are consumed.
	var client net.Conn
	if ipcServer.ToC != nil {
		// Connect client
		client, err = net.Dial("unix", sockPath)
		if err != nil {
			client, err = net.Dial("tcp", "127.0.0.1:9999")
		}
		if err == nil {
			defer client.Close()
			go func() {
				for {
					msg, err := ipc.ReadMessage(client)
					if err != nil {
						return
					}
					if msg.Type == "prepare_file_transfer" {
						prepareMsgReceived <- msg
					}
				}
			}()
		}
	}

	ft := NewFileTransferManager(ipcServer)

	// Start P2P server that uploads mock content
	p2pListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer p2pListener.Close()
	p2pPort := p2pListener.Addr().(*net.TCPAddr).Port

	mockData := "Hello action learning peer-to-peer!"
	go func() {
		conn, err := p2pListener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_, _ = io.WriteString(conn, mockData)
	}()

	err = ft.StartDownload("dl_session_1", "notes.txt", "peer_alice", "hashxyz", int64(len(mockData)), "127.0.0.1", p2pPort)
	if err != nil {
		t.Fatalf("start download: %v", err)
	}

	// Wait for prepare message to get local port
	var prepareMsg *ipc.Message
	select {
	case prepareMsg = <-prepareMsgReceived:
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for prepare message")
	}

	var payload map[string]interface{}
	_ = json.Unmarshal(prepareMsg.Payload, &payload)
	localPort := int(payload["transfer_port"].(float64))

	// Connect to localPort as C++ mock and read
	localConn, err := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", localPort))
	if err != nil {
		t.Fatalf("C++ failed to connect to local port %d: %v", localPort, err)
	}
	defer localConn.Close()

	buf := make([]byte, 100)
	n, err := localConn.Read(buf)
	if err != nil && err != io.EOF {
		t.Fatalf("read failed: %v", err)
	}

	got := string(buf[:n])
	if got != mockData {
		t.Errorf("got %q, want %q", got, mockData)
	}

	// Verify session status is completed
	time.Sleep(100 * time.Millisecond)
	session, _ := ft.GetSession("dl_session_1")
	if session.Status != "completed" {
		t.Errorf("expected session completed, got %s", session.Status)
	}
}
