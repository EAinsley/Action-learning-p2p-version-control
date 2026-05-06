# P2P File Sync - C++ Daemon

Cross-platform file system monitoring daemon written in C++.

## Project Structure

```
src/backend/cpp/
├── CMakeLists.txt                 # CMake build configuration
├── README.md                       # This file
├── include/                        # include file
├── tests/                          # tests
└── src/
    └── main.cpp                    # Main entry point with file watcher interface
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

### Testing

```bash
ctest --test-dir build --output-on-failure
```

### Running

```bash
./build/bin/cpp_daemon
```

for seeing the usage.

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
