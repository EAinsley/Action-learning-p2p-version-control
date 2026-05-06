#include <atomic>
#include <csignal>
#include <filesystem>
#include <format>
#include <functional>
#include <iostream>
#include <nlohmann/json.hpp>
#include <string>
#include <sys/inotify.h>
#include <thread>
#include <unistd.h>

// Global shutdown flag
std::atomic<bool> g_shutdown(false);

// Signal handler
void signal_handler(int signal) {
  std::cout << std::format("Received signal: {}\n", signal);
  g_shutdown = true;
}

// Linux-only file system watcher using inotify
class FileSystemWatcher {
public:
  using FileChangeCallback =
      std::function<void(const std::string &, const std::string &)>;

  FileSystemWatcher(const std::string &watch_path)
      : watch_path_(watch_path), inotify_fd_(-1), watch_descriptor_(-1) {}

  ~FileSystemWatcher() { stop(); }

  bool start(FileChangeCallback callback) {
    callback_ = callback;

    // Create inotify instance
    inotify_fd_ = inotify_init1(IN_NONBLOCK);
    if (inotify_fd_ < 0) {
      std::cerr << std::format("Error: Failed to create inotify instance\n");
      return false;
    }

    // Add watch for directory
    watch_descriptor_ =
        inotify_add_watch(inotify_fd_, watch_path_.c_str(),
                          IN_CREATE | IN_MOVED_TO | IN_MODIFY | IN_DELETE);
    if (watch_descriptor_ < 0) {
      std::cerr << std::format("Error: Failed to add watch descriptor\n");
      close(inotify_fd_);
      inotify_fd_ = -1;
      return false;
    }

    std::cerr << std::format("[inotify] Watching: {}\n", watch_path_);

    // Start watch thread
    watch_thread_ = std::thread(&FileSystemWatcher::watch_loop, this);
    return true;
  }

  void stop() {
    g_shutdown = true;

    if (watch_thread_.joinable()) {
      watch_thread_.join();
    }

    if (watch_descriptor_ >= 0 && inotify_fd_ >= 0) {
      inotify_rm_watch(inotify_fd_, watch_descriptor_);
      watch_descriptor_ = -1;
    }

    if (inotify_fd_ >= 0) {
      close(inotify_fd_);
      inotify_fd_ = -1;
    }

    std::cerr << std::format("[inotify] Stopped watching\n");
  }

private:
  std::string watch_path_;
  int inotify_fd_;
  int watch_descriptor_;
  std::thread watch_thread_;
  FileChangeCallback callback_;

  void watch_loop() {
    const size_t BUF_LEN = 4096;
    char buf[BUF_LEN]
        __attribute__((aligned(__alignof__(struct inotify_event))));

    std::cerr << std::format("[inotify] Watch loop started\n");

    while (!g_shutdown) {
      ssize_t len = read(inotify_fd_, buf, BUF_LEN);

      if (len <= 0) {
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
        continue;
      }

      // Process events
      for (char *p = buf; p < buf + len;) {
        struct inotify_event *event = (struct inotify_event *)p;

        if (event->len > 0) {
          std::string filename = event->name;
          std::string action;

          if (event->mask & IN_CREATE) {
            action = "created";
          } else if (event->mask & IN_MOVED_TO) {
            action = "moved_to";
          } else if (event->mask & IN_DELETE) {
            action = "deleted";
          } else if (event->mask & IN_MODIFY) {
            action = "modified";
          }

          if (!action.empty() && callback_) {
            callback_(filename, action);
          }
        }

        p += sizeof(struct inotify_event) + event->len;
      }
    }

    std::cout << "[inotify] Watch loop ended\n";
  }
};

void print_usage(const char *program_name) {
  std::cout << std::format("Usage: {} <path>\n", program_name);
  std::cout << std::format("Example: {} /home/user/sync\n", program_name);
}

int main(int argc, char *argv[]) {
  try {
    // Parse command line arguments
    if (argc < 2) {
      print_usage(argv[0]);
      return 1;
    }

    std::string watch_path = argv[1];

    // Validate path exists
    if (!std::filesystem::exists(watch_path)) {
      std::cerr << std::format("Error: Path does not exist: {}\n", watch_path);
      return 1;
    }

    if (!std::filesystem::is_directory(watch_path)) {
      std::cerr << std::format("Error: Path is not a directory: {}\n",
                               watch_path);
      return 1;
    }

    std::cout << "P2P File Sync - C++ Daemon (Linux)\n";
    std::cout << std::format("Watching directory: {}\n", watch_path);
    std::cout << "Press Ctrl+C to stop\n\n";

    // Setup signal handlers
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    // Create file watcher
    FileSystemWatcher watcher(watch_path);

    // Callback for file changes
    auto on_file_change = [](const std::string &filename,
                             const std::string &action) {
      nlohmann::json event;
      event["timestamp"] =
          std::chrono::system_clock::now().time_since_epoch().count();
      event["action"] = action;
      event["filename"] = filename;
      event["type"] = "file_changed";

      std::cout << std::format("[EVENT] File {}: {}\n", action, filename);
      std::cout << std::format("[JSON] {}\n", event.dump());
    };

    // Start watching
    if (!watcher.start(on_file_change)) {
      std::cerr << std::format("Error: Failed to start file watcher\n");
      return 1;
    }

    // Main loop - keep running until shutdown signal
    while (!g_shutdown) {
      std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    // Cleanup
    watcher.stop();
    std::cout << "\nDone\n";

    return 0;
  } catch (const std::exception &e) {
    std::cerr << std::format("Error: {}\n", e.what());
    return 1;
  }
}
