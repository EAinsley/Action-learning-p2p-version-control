# P2P File Sync - C++ Daemon

Cross-platform file system monitoring daemon written in C++.

## Project Structure

```
src/backend/cpp/
├── CMakeLists.txt                 # CMake build configuration
├── README.md                       # This file
└── src/
    ├── main.cpp                    # Main entry point with file watcher interface
    └── fs/
        ├── file_system_watcher_linux.cpp   # Linux (inotify) implementation
        ├── file_system_watcher_macos.cpp   # macOS (FSEvents) implementation
        └── file_system_watcher_windows.cpp # Windows (ReadDirectoryChangesW) implementation
```

## Features

- **Cross-platform**: Supports Linux, macOS, and Windows
- **Command-line interface**: Monitor any directory via CLI argument
- **Event logging**: JSON-formatted output for file changes
- **Signal handling**: Graceful shutdown on SIGINT/SIGTERM

## Build Requirements

- **C++17 or later**
- **CMake 3.10+**
- **Internet connection** (to fetch dependencies via FetchContent)

### Linux
```bash
sudo apt-get install build-essential cmake
```

### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

### Windows
```
Visual Studio 2019+ with C++ development tools
```

## Building

### Configure and Build

```bash
cd src/backend/cpp
mkdir build
cd build
cmake ..
cmake --build .
```

### Output

The binary will be created at: `build/bin/cpp_daemon`

## Usage

### Basic Usage

```bash
./cpp_daemon /path/to/watch
```

### Example

```bash
./cpp_daemon ~/Documents/sync
```

Once running, the daemon will output events like:

```
P2P File Sync - C++ Daemon
Watching directory: /home/user/sync
Press Ctrl+C to stop

[Linux] Starting file watcher on: /home/user/sync
[Linux] Watch loop started
[EVENT] File added: document.txt
[JSON] {"timestamp":1715000000000,"action":"added","filename":"document.txt","type":"file_changed"}
```

## Dependencies

### Automatic (via FetchContent)

- **nlohmann/json** - JSON parsing for IPC messages
- **fmtlib** - Type-safe string formatting

### Platform-Specific

- **Linux**: inotify (kernel API, no external dependency)
- **macOS**: FSEvents (system framework)
- **Windows**: ReadDirectoryChangesW (Windows API)

## Implementation Status

### Current Status: Skeleton

The current implementation provides:
- ✓ Cross-platform compilation framework
- ✓ Command-line argument parsing
- ✓ Signal handling (Ctrl+C)
- ✓ Abstract interface for file watching
- ✓ Platform-specific class stubs
- ⏳ **TODO**: Platform-specific implementations

### Next Steps

1. **Linux**: Implement inotify-based event monitoring
2. **macOS**: Implement FSEvents-based event monitoring
3. **Windows**: Implement ReadDirectoryChangesW event monitoring
4. **Testing**: Add unit tests for each platform
5. **IPC Integration**: Connect to Go daemon via Unix socket

## Code Structure

### main.cpp

- `FileSystemWatcher`: Abstract base class defining watcher interface
- `FileSystemWatcherLinux`: Linux implementation (stub)
- `FileSystemWatcherMacOS`: macOS implementation (stub)
- `FileSystemWatcherWindows`: Windows implementation (stub)
- `create_watcher()`: Factory function for platform-specific watcher
- `main()`: Entry point with CLI argument parsing

### Platform-Specific Files

Each platform file contains:
- TODO comments with implementation steps
- API reference information
- Stub structure ready for implementation

## Building with Compiler Warnings

The build is configured to show all warnings:

```bash
# Linux/macOS
g++ -Wall -Wextra -Wpedantic ...

# Windows
cl /W4 ...
```

## Debugging

### Verbose Build Output

```bash
cd build
cmake --build . --verbose
```

### Run with Debug Information

```bash
# On Linux/macOS
./build/bin/cpp_daemon /tmp/test 2>&1 | grep -E "\[|ERROR|WARNING"

# On Windows
build\bin\cpp_daemon C:\Temp\test
```

## Next Implementation: File Watcher

### Linux (inotify)

```cpp
// Steps to implement:
// 1. Create inotify file descriptor: int fd = inotify_init();
// 2. Add directory watch: int wd = inotify_add_watch(fd, path, IN_CREATE | IN_MOVED_TO);
// 3. Read events in loop: while (read(fd, buffer, BUF_LEN) > 0)
// 4. Parse inotify_event structures
// 5. Call callback for new files
```

### macOS (FSEvents)

```cpp
// Steps to implement:
// 1. Create event stream: FSEventStreamRef stream = FSEventStreamCreate(...)
// 2. Define callback to handle path changes
// 3. Schedule in run loop: FSEventStreamScheduleWithRunLoop(...)
// 4. Start stream: FSEventStreamStart(stream)
// 5. Process events via run loop
```

### Windows (ReadDirectoryChangesW)

```cpp
// Steps to implement:
// 1. Open directory: HANDLE hDir = CreateFileA(path, FILE_LIST_DIRECTORY, ...)
// 2. Call ReadDirectoryChangesW in loop
// 3. Parse FILE_NOTIFY_INFORMATION structures
// 4. Filter for FILE_ACTION_ADDED events
// 5. Close handle when done
```

## License

Part of the P2P File Sync project.

## Support

See the main project architecture document at: `reports/architecture/p2p_architecture.md`
