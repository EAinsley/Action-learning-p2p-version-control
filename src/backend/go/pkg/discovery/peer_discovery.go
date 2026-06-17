package discovery

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/grandcat/zeroconf"
)

type Peer struct {
	ID        string
	Name      string
	Address   string
	Port      int
	LastSeen  time.Time
	Connected bool
}

type PeerRegistry struct {
	peers map[string]*Peer
	mu    sync.RWMutex

	// Callbacks
	OnPeerDiscovered func(*Peer)
	OnPeerLost       func(*Peer)
}

func NewPeerRegistry() *PeerRegistry {
	return &PeerRegistry{
		peers: make(map[string]*Peer),
	}
}

func (pr *PeerRegistry) StartDiscovery() (*zeroconf.Server, error) {
	// Register this peer via mDNS
	hostname, _ := os.Hostname()

	server, err := zeroconf.Register(hostname, "_p2psync._tcp", "local.", 9876, []string{"version=1.0"}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to register service: %v", err)
	}

	// Browse for other peers
	go pr.browsePeers()

	return server, nil
}

func (pr *PeerRegistry) browsePeers() {
	resolver, err := zeroconf.NewResolver(nil)
	if err != nil {
		log.Printf("Failed to create mDNS resolver: %v", err)
		return
	}

	entries := make(chan *zeroconf.ServiceEntry)
	go func(results <-chan *zeroconf.ServiceEntry) {
		for entry := range results {
			pr.handlePeerDiscovered(entry)
		}
	}(entries)

	// Browse indefinitely
	err = resolver.Browse(context.Background(), "_p2psync._tcp", "local.", entries)
	if err != nil {
		log.Printf("Browse failed: %v", err)
	}
}

func (pr *PeerRegistry) handlePeerDiscovered(entry *zeroconf.ServiceEntry) {
	if len(entry.AddrIPv4) == 0 {
		return
	}

	peer := &Peer{
		ID:       entry.Instance,
		Name:     entry.Instance,
		Address:  entry.AddrIPv4[0].String(),
		Port:     entry.Port,
		LastSeen: time.Now(),
	}

	pr.mu.Lock()
	defer pr.mu.Unlock()

	if _, exists := pr.peers[peer.ID]; !exists {
		pr.peers[peer.ID] = peer
		if pr.OnPeerDiscovered != nil {
			go pr.OnPeerDiscovered(peer)
		}
		log.Printf("Peer discovered: %s (%s:%d)\n", peer.Name, peer.Address, peer.Port)
	}
}

func (pr *PeerRegistry) GetPeers() []*Peer {
	pr.mu.RLock()
	defer pr.mu.RUnlock()

	peers := make([]*Peer, 0, len(pr.peers))
	for _, p := range pr.peers {
		peers = append(peers, p)
	}
	return peers
}

func (pr *PeerRegistry) GetPeer(id string) *Peer {
	pr.mu.RLock()
	defer pr.mu.RUnlock()

	return pr.peers[id]
}
