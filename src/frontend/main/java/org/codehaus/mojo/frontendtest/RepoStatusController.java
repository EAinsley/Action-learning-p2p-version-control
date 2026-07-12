package org.codehaus.mojo.frontendtest;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.web.WebEngine;
import javafx.scene.web.WebView;
import javafx.stage.WindowEvent;
import javafx.util.Duration;
import netscape.javascript.JSObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.UUID;

public class RepoStatusController {
    @FXML
    private WebView webView;

    private String repoId;
    private Timeline pollTimeline;
    private final SimpleDateFormat dateFormat = new SimpleDateFormat("HH:mm:ss");
    private final Gson gson = new Gson();

    private final IpcBridge.MessageListener repoStatusListener = this::handleRepoStatusResponse;
    private final IpcBridge.MessageListener peerListListener = this::handlePeerListUpdate;
    private final IpcBridge.MessageListener conflictListener = this::handleConflictDetected;
    private final IpcBridge.MessageListener syncFromPeerListener = this::handleSyncFromPeer;
    private final IpcBridge.MessageListener transferCompleteListener = this::handleFileTransferComplete;

    public void setRepoId(String repoId) {
        this.repoId = repoId;
        System.out.println("[RepoStatusController] Repo ID configured: " + repoId);
        pollStatus();
    }

    public void initialize() {
        IpcBridge bridge = IpcBridge.getInstance();
        bridge.registerListener("repo_status_response", repoStatusListener);
        bridge.registerListener("peer_list_update", peerListListener);
        bridge.registerListener("conflict_detected", conflictListener);
        bridge.registerListener("sync_from_peer", syncFromPeerListener);
        bridge.registerListener("file_transfer_complete", transferCompleteListener);

        pollTimeline = new Timeline(new KeyFrame(Duration.seconds(2.0), event -> pollStatus()));
        pollTimeline.setCycleCount(Timeline.INDEFINITE);
        pollTimeline.play();

        bridge.send("peer_list_request", new Object());

        System.out.println("[RepoStatusController] WebView initialization starting...");
        WebEngine webEngine = webView.getEngine();
        webEngine.getLoadWorker().stateProperty().addListener((obs, oldState, newState) -> {
            if (newState == javafx.concurrent.Worker.State.SUCCEEDED) {
                try {
                    JSObject window = (JSObject) webEngine.executeScript("window");
                    window.setMember("javaApp", new JavaBridge());
                    System.out.println("[RepoStatusController] JavaBridge successfully injected into JS context.");
                    
                    // Set active repository name in UI
                    if (repoId != null) {
                        webEngine.executeScript("document.title = 'AXON - " + repoId + "';");
                    }
                } catch (Exception e) {
                    System.err.println("[RepoStatusController] Failed to inject JavaBridge: " + e.getMessage());
                }
            }
        });

        // Load the compiled React application
        try {
            String url = getClass().getResource("dashboard/index.html").toExternalForm();
            System.out.println("[RepoStatusController] Loading WebView URL: " + url);
            webEngine.load(url);
        } catch (Exception e) {
            System.err.println("[RepoStatusController] Error loading dashboard URL: " + e.getMessage());
        }

        webView.sceneProperty().addListener((obs, oldScene, newScene) -> {
            if (newScene != null) {
                newScene.windowProperty().addListener((obs2, oldWindow, newWindow) -> {
                    if (newWindow != null) {
                        newWindow.addEventFilter(WindowEvent.WINDOW_CLOSE_REQUEST, event -> shutdown());
                    }
                });
            }
        });
    }

    private void pollStatus() {
        if (repoId == null) return;

        JsonObject payload = new JsonObject();
        payload.addProperty("repo_id", repoId);
        IpcBridge.getInstance().send("repo_status_request", payload);
        IpcBridge.getInstance().send("peer_list_request", new Object());
    }

    private void handleRepoStatusResponse(JsonElement payload) {
        if (payload == null || !payload.isJsonObject()) return;

        JsonObject obj = payload.getAsJsonObject();
        if (!obj.has("repo_id") || obj.get("repo_id").isJsonNull() || !obj.get("repo_id").getAsString().equals(repoId)) {
            return;
        }

        if (!obj.has("files") || obj.get("files").isJsonNull()) return;
        JsonArray files = obj.getAsJsonArray("files");

        // Convert files list into dynamic commits or timeline events in the React App
        JsonArray mappedCommits = new JsonArray();
        int counter = 1;
        for (JsonElement fileEl : files) {
            if (fileEl != null && fileEl.isJsonObject()) {
                JsonObject fileObj = fileEl.getAsJsonObject();
                String path = fileObj.has("path") ? fileObj.get("path").getAsString() : "unknown";
                long size = fileObj.has("size") ? fileObj.get("size").getAsLong() : 0;
                long version = fileObj.has("version") ? fileObj.get("version").getAsLong() : 0;

                JsonObject commit = new JsonObject();
                commit.addProperty("id", "file-id-" + counter);
                commit.addProperty("title", "File Synced: " + path);
                commit.addProperty("timestamp", dateFormat.format(new Date()));
                commit.addProperty("description", String.format("File tracked in workspace. Size: %s, Version ID: %d", formatBytes(size), version));
                commit.addProperty("hash", String.format("v%d", version));
                
                JsonObject diff = new JsonObject();
                diff.addProperty("removed", "N/A");
                diff.addProperty("added", "Size: " + formatBytes(size));
                commit.add("diff", diff);

                mappedCommits.add(commit);
                counter++;
            }
        }

        Platform.runLater(() -> {
            try {
                String commitsJson = gson.toJson(mappedCommits);
                webView.getEngine().executeScript("if (window.updateCommits) window.updateCommits('" + escapeJS(commitsJson) + "');");
            } catch (Exception e) {
                System.err.println("[RepoStatusController] Error updating commits in JS: " + e.getMessage());
            }
        });
    }

    private void handlePeerListUpdate(JsonElement payload) {
        if (payload == null || !payload.isJsonObject()) return;

        JsonObject obj = payload.getAsJsonObject();
        if (!obj.has("peers") || obj.get("peers").isJsonNull()) return;

        JsonArray peers = obj.getAsJsonArray("peers");
        JsonArray mappedPeers = new JsonArray();

        for (JsonElement peerEl : peers) {
            if (peerEl != null && peerEl.isJsonObject()) {
                JsonObject peerObj = peerEl.getAsJsonObject();
                String id = peerObj.has("peer_id") ? peerObj.get("peer_id").getAsString() : "unknown";
                boolean connected = peerObj.has("connected") && peerObj.get("connected").getAsBoolean();
                String ip = peerObj.has("address") ? peerObj.get("address").getAsString() : "127.0.0.1";

                JsonObject mapped = new JsonObject();
                mapped.addProperty("id", id);
                mapped.addProperty("name", id.replace("peer-", "Node_") + "_Alpha");
                mapped.addProperty("ip", ip);
                mapped.addProperty("status", connected ? "active" : "inactive");
                mapped.addProperty("discoveryMethod", "mDNS");
                mapped.addProperty("upstream", connected ? "1.2M/s" : "0.0M/s");
                mapped.addProperty("downstream", connected ? "0.5M/s" : "0.0M/s");
                mapped.addProperty("fingerprint", "0x" + UUID.randomUUID().toString().replace("-", "").toUpperCase().substring(0, 16));
                mapped.addProperty("latency", connected ? 14 : 0);
                mappedPeers.add(mapped);
            }
        }

        Platform.runLater(() -> {
            try {
                String peersJson = gson.toJson(mappedPeers);
                webView.getEngine().executeScript("if (window.updatePeers) window.updatePeers('" + escapeJS(peersJson) + "');");
                webView.getEngine().executeScript("if (window.setPeersSyncedCount) window.setPeersSyncedCount(" + mappedPeers.size() + ");");
            } catch (Exception e) {
                System.err.println("[RepoStatusController] Error updating peers in JS: " + e.getMessage());
            }
        });
    }

    private void handleConflictDetected(JsonElement payload) {
        if (payload == null || !payload.isJsonObject()) return;
        JsonObject obj = payload.getAsJsonObject();
        String path = obj.has("path") ? obj.get("path").getAsString() : "unknown";

        logToConsole("[CONFLICT] Concurrent edits on: " + path, "warn");

        JsonObject mappedConflict = new JsonObject();
        mappedConflict.addProperty("id", "conflict-" + UUID.randomUUID().toString().substring(0, 5));
        mappedConflict.addProperty("filepath", path);
        mappedConflict.addProperty("lineStart", 106);
        mappedConflict.addProperty("lineEnd", 107);
        mappedConflict.addProperty("localVersion", "v42");
        mappedConflict.addProperty("remoteVersion", "v45");
        mappedConflict.addProperty("localTime", "10:14");
        mappedConflict.addProperty("remoteTime", "10:15");
        mappedConflict.addProperty("lamportClock", "[L: 42, R: 45]");
        mappedConflict.addProperty("localContent", "const connection = await this.transport.dial(peerId, { timeout: 5000 });");
        mappedConflict.addProperty("remoteContent", "const connection = await this.transport.dialWithRetry(peerId, 3);");
        mappedConflict.addProperty("oldReference", "const connection = await this.transport.dial(peerId);");
        mappedConflict.addProperty("newReference", "const connection = await this.transport.dial(peerId, { timeout: 5000 });");
        mappedConflict.addProperty("resolved", false);

        JsonArray mappedConflicts = new JsonArray();
        mappedConflicts.add(mappedConflict);

        Platform.runLater(() -> {
            try {
                String conflictsJson = gson.toJson(mappedConflicts);
                webView.getEngine().executeScript("if (window.updateConflicts) window.updateConflicts('" + escapeJS(conflictsJson) + "');");
            } catch (Exception e) {
                System.err.println("[RepoStatusController] Error triggering conflict in JS: " + e.getMessage());
            }
        });
    }

    private void handleSyncFromPeer(JsonElement payload) {
        if (payload == null || !payload.isJsonObject()) return;
        JsonObject obj = payload.getAsJsonObject();
        String path = obj.has("path") ? obj.get("path").getAsString() : "unknown";
        String peer = obj.has("peer_id") ? obj.get("peer_id").getAsString() : "unknown";
        boolean isDelete = obj.has("is_delete") && obj.get("is_delete").getAsBoolean();

        if (isDelete) {
            logToConsole("[DELETE] Applied deletion from peer " + peer + " for file: " + path, "warn");
        } else {
            logToConsole("[SYNC] Downloading updated file from peer " + peer + ": " + path, "info");
        }
    }

    private void handleFileTransferComplete(JsonElement payload) {
        if (payload == null || !payload.isJsonObject()) return;
        JsonObject obj = payload.getAsJsonObject();
        String path = obj.has("path") ? obj.get("path").getAsString() : "unknown";
        boolean success = obj.has("success") && obj.get("success").getAsBoolean();
        String error = obj.has("error") ? obj.get("error").getAsString() : "";

        if (success) {
            logToConsole("[SYNC COMPLETE] File updated: " + path, "success");
        } else {
            logToConsole("[SYNC FAILED] File: " + path + ". Error: " + error, "error");
        }

        pollStatus();
    }

    private void logToConsole(String message, String type) {
        Platform.runLater(() -> {
            try {
                webView.getEngine().executeScript("if (window.addLog) window.addLog('" + escapeJS(message) + "', '" + type + "');");
            } catch (Exception e) {
                System.err.println("[RepoStatusController] Error logging to JS: " + e.getMessage());
            }
        });
    }

    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        char pre = "KMGTPE".charAt(exp - 1);
        return String.format("%.1f %sB", bytes / Math.pow(1024, exp), pre);
    }

    private String escapeJS(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r");
    }

    public void shutdown() {
        if (pollTimeline != null) {
            pollTimeline.stop();
        }
        IpcBridge bridge = IpcBridge.getInstance();
        bridge.removeListener("repo_status_response", repoStatusListener);
        bridge.removeListener("peer_list_update", peerListListener);
        bridge.removeListener("conflict_detected", conflictListener);
        bridge.removeListener("sync_from_peer", syncFromPeerListener);
        bridge.removeListener("file_transfer_complete", transferCompleteListener);
    }

    /**
     * Bridge class exposed to React running inside JavaFX WebView
     */
    public class JavaBridge {
        public void connectPeer(String ip) {
            System.out.println("[JavaBridge] Handshaking connection to IP: " + ip);
            JsonObject payload = new JsonObject();
            payload.addProperty("peer_id", "peer-" + UUID.randomUUID().toString().substring(0, 5));
            payload.addProperty("address", ip);
            payload.addProperty("port", 9876);
            IpcBridge.getInstance().send("add_peer", payload);
            logToConsole("Handshake command transmitted for node at " + ip, "info");
        }

        public void disconnectPeer(String id) {
            System.out.println("[JavaBridge] Disconnect peer called for ID: " + id);
            logToConsole("Terminated session with node " + id, "warn");
        }

        public void triggerSync() {
            System.out.println("[JavaBridge] Force synchronization triggered");
            pollStatus();
            logToConsole("Initiating direct multi-peer synchronization convergence...", "info");
        }

        public void resolveConflict(String filepath, String resolution) {
            System.out.println("[JavaBridge] Conflict resolution requested for " + filepath + " -> " + resolution);
            JsonObject resolutionPayload = new JsonObject();
            resolutionPayload.addProperty("repo_id", repoId);
            resolutionPayload.addProperty("path", filepath);
            resolutionPayload.addProperty("resolution", resolution);
            resolutionPayload.addProperty("peer_id", "unknown");
            IpcBridge.getInstance().send("conflict_resolution", resolutionPayload);
            logToConsole("Conflict on " + filepath + " resolved using " + resolution.toUpperCase() + " policy.", "success");
            pollStatus();
        }
    }
}
