#include "ipc_client.h"

#include <iostream>
#include <cstring>
#include <cerrno>
#include <cstdlib>
#include <mutex>

namespace {
// If IPC_TCP_PORT is set, both Windows and Unix clients connect to
// 127.0.0.1:<port> instead of using the socket path. This enables
// Windows native E2E tests and containerized orchestrators.
int getIpcTcpPort() {
    const char* env = std::getenv("IPC_TCP_PORT");
    if (env && *env) {
        try {
            int port = std::stoi(env);
            if (port > 0 && port <= 65535) return port;
        } catch (...) {
            std::cerr << "[IPC] Ignoring invalid IPC_TCP_PORT: " << env << "\n";
        }
    }
    return -1;
}
}  // namespace

#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")

class WindowsIpcClient : public IpcClient {
public:
    WindowsIpcClient() : socket_(-1) {}
    ~WindowsIpcClient() override { disconnect(); }

    bool connect(const std::string& socketPath) override {
        std::lock_guard<std::mutex> lockSend(sendMutex_);
        std::lock_guard<std::mutex> lockRecv(recvMutex_);
        std::lock_guard<std::mutex> lockState(stateMutex_);
        disconnectLocked();
        
        WSADATA wsaData;
        if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
            return false;
        }

        socket_ = ::socket(AF_INET, SOCK_STREAM, 0);
        if (socket_ == INVALID_SOCKET) {
            WSACleanup();
            return false;
        }

        int port = getIpcTcpPort();
        if (port < 0) {
            // Derive port from socketPath (FNV-1a hash) for legacy mode
            unsigned int h = 2166136261;
            for (char c : socketPath) {
                h = (h ^ static_cast<unsigned char>(c)) * 16777619;
            }
            port = 10000 + (h % 20000);
        }

        struct sockaddr_in addr;
        std::memset(&addr, 0, sizeof(addr));
        addr.sin_family = AF_INET;
        addr.sin_port = htons(port);
        ::inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);

        if (::connect(socket_, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
            closesocket(socket_);
            socket_ = -1;
            WSACleanup();
            return false;
        }

        // Set receive timeout so blocking recv() can be interrupted on shutdown.
        // Timeouts do NOT disconnect — the caller retries and checks g_shutdown.
        DWORD timeout = 3000;
        setsockopt(socket_, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout, sizeof(timeout));
        return true;
    }

    bool send(const std::string& message) override {
        std::lock_guard<std::mutex> lockSend(sendMutex_);
        SOCKET sock = INVALID_SOCKET;
        {
            std::lock_guard<std::mutex> lockState(stateMutex_);
            sock = socket_;
        }
        if (sock == INVALID_SOCKET) return false;
        uint32_t len = static_cast<uint32_t>(message.size());
        uint32_t netLen = htonl(len);
        uint32_t totalWritten = 0;
        while (totalWritten < sizeof(netLen)) {
            int n = ::send(sock, reinterpret_cast<const char*>(&netLen) + totalWritten, sizeof(netLen) - totalWritten, 0);
            if (n <= 0) return false;
            totalWritten += n;
        }
        totalWritten = 0;
        while (totalWritten < len) {
            int n = ::send(sock, message.data() + totalWritten, len - totalWritten, 0);
            if (n <= 0) return false;
            totalWritten += n;
        }
        return true;
    }

    bool receive(std::string& message) override {
        std::lock_guard<std::mutex> lockRecv(recvMutex_);
        SOCKET sock = INVALID_SOCKET;
        {
            std::lock_guard<std::mutex> lockState(stateMutex_);
            sock = socket_;
        }
        if (sock == INVALID_SOCKET) return false;
        uint32_t netLen = 0;
        uint32_t totalRead = 0;
        while (totalRead < sizeof(netLen)) {
            int n = ::recv(sock, reinterpret_cast<char*>(&netLen) + totalRead, sizeof(netLen) - totalRead, 0);
            if (n <= 0) {
                int err = WSAGetLastError();
                if (err == WSAETIMEDOUT) {
                    return false; // timeout only — keep connection alive
                }
                disconnectOnError(); // real error
                return false;
            }
            totalRead += n;
        }
        uint32_t len = ntohl(netLen);
        if (len == 0 || len > 1 * 1024 * 1024) return false;
        message.resize(len);
        totalRead = 0;
        while (totalRead < len) {
            int n = ::recv(sock, &message[totalRead], len - totalRead, 0);
            if (n <= 0) {
                disconnectOnError();
                return false;
            }
            totalRead += n;
        }
        return true;
    }

    void disconnect() override {
        std::lock_guard<std::mutex> lockSend(sendMutex_);
        std::lock_guard<std::mutex> lockRecv(recvMutex_);
        std::lock_guard<std::mutex> lockState(stateMutex_);
        disconnectLocked();
    }

    bool isConnected() override {
        std::lock_guard<std::mutex> lockState(stateMutex_);
        return socket_ != INVALID_SOCKET && socket_ != -1;
    }

private:
    void disconnectLocked() {
        if (socket_ != INVALID_SOCKET && socket_ != -1) {
            closesocket(socket_);
            socket_ = INVALID_SOCKET;
            WSACleanup();
        }
    }

    void disconnectOnError() {
        std::lock_guard<std::mutex> lockSend(sendMutex_);
        std::lock_guard<std::mutex> lockState(stateMutex_);
        disconnectLocked();
    }

    SOCKET socket_;
    mutable std::mutex sendMutex_;
    mutable std::mutex recvMutex_;
    mutable std::mutex stateMutex_;
};

#else
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <arpa/inet.h>

class UnixIpcClient : public IpcClient {
public:
    UnixIpcClient() : socketFd_(-1) {}
    ~UnixIpcClient() override { disconnect(); }

    bool connect(const std::string& path) override {
        std::lock_guard<std::mutex> lockSend(sendMutex_);
        std::lock_guard<std::mutex> lockRecv(recvMutex_);
        std::lock_guard<std::mutex> lockState(stateMutex_);
        disconnectLocked();

        int tcpPort = getIpcTcpPort();
        if (tcpPort > 0) {
            // TCP mode: connect to 127.0.0.1:<IPC_TCP_PORT>
            socketFd_ = ::socket(AF_INET, SOCK_STREAM, 0);
            if (socketFd_ < 0) return false;

            struct sockaddr_in addr;
            std::memset(&addr, 0, sizeof(addr));
            addr.sin_family = AF_INET;
            addr.sin_port = htons(tcpPort);
            ::inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);

            if (::connect(socketFd_, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
                ::close(socketFd_);
                socketFd_ = -1;
                return false;
            }

            struct timeval tv;
            tv.tv_sec = 3;
            tv.tv_usec = 0;
            setsockopt(socketFd_, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
            return true;
        }

        socketFd_ = ::socket(AF_UNIX, SOCK_STREAM, 0);
        if (socketFd_ < 0) return false;

        struct sockaddr_un addr;
        std::memset(&addr, 0, sizeof(addr));
        addr.sun_family = AF_UNIX;
        std::strncpy(addr.sun_path, path.c_str(), sizeof(addr.sun_path) - 1);

        if (::connect(socketFd_, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
            ::close(socketFd_);
            socketFd_ = -1;
            return false;
        }

        struct timeval tv;
        tv.tv_sec = 3;
        tv.tv_usec = 0;
        setsockopt(socketFd_, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
        return true;
    }

    bool send(const std::string& message) override {
        std::lock_guard<std::mutex> lockSend(sendMutex_);
        int fd = -1;
        {
            std::lock_guard<std::mutex> lockState(stateMutex_);
            fd = socketFd_;
        }
        if (fd < 0) return false;

        uint32_t len = static_cast<uint32_t>(message.size());
        uint32_t netLen = htonl(len);
        size_t totalWritten = 0;
        while (totalWritten < sizeof(netLen)) {
            ssize_t n = ::write(fd, reinterpret_cast<const char*>(&netLen) + totalWritten, sizeof(netLen) - totalWritten);
            if (n <= 0) return false;
            totalWritten += n;
        }
        totalWritten = 0;
        while (totalWritten < len) {
            ssize_t n = ::write(fd, message.data() + totalWritten, len - totalWritten);
            if (n <= 0) return false;
            totalWritten += n;
        }
        return true;
    }

    bool receive(std::string& message) override {
        std::lock_guard<std::mutex> lockRecv(recvMutex_);
        int fd = -1;
        {
            std::lock_guard<std::mutex> lockState(stateMutex_);
            fd = socketFd_;
        }
        if (fd < 0) return false;

        uint32_t netLen = 0;
        size_t totalRead = 0;
        while (totalRead < sizeof(netLen)) {
            ssize_t n = ::read(fd, reinterpret_cast<char*>(&netLen) + totalRead, sizeof(netLen) - totalRead);
            if (n < 0) {
                if (errno == EAGAIN || errno == EWOULDBLOCK) {
                    return false; // timeout only — keep connection alive
                }
                disconnectOnError(); // real error
                return false;
            }
            if (n == 0) { // EOF — peer disconnected
                disconnectOnError();
                return false;
            }
            totalRead += n;
        }
        uint32_t len = ntohl(netLen);
        if (len == 0 || len > 1 * 1024 * 1024) return false;
        message.resize(len);
        totalRead = 0;
        while (totalRead < len) {
            ssize_t n = ::read(fd, &message[totalRead], len - totalRead);
            if (n < 0) {
                disconnectOnError();
                return false;
            }
            if (n == 0) {
                disconnectOnError();
                return false;
            }
            totalRead += n;
        }
        return true;
    }

    void disconnect() override {
        std::lock_guard<std::mutex> lockSend(sendMutex_);
        std::lock_guard<std::mutex> lockRecv(recvMutex_);
        std::lock_guard<std::mutex> lockState(stateMutex_);
        disconnectLocked();
    }

    bool isConnected() override {
        std::lock_guard<std::mutex> lockState(stateMutex_);
        return socketFd_ >= 0;
    }

private:
    void disconnectLocked() {
        if (socketFd_ >= 0) {
            ::close(socketFd_);
            socketFd_ = -1;
        }
    }

    void disconnectOnError() {
        std::lock_guard<std::mutex> lockSend(sendMutex_);
        std::lock_guard<std::mutex> lockState(stateMutex_);
        disconnectLocked();
    }

    int socketFd_;
    mutable std::mutex sendMutex_;
    mutable std::mutex recvMutex_;
    mutable std::mutex stateMutex_;
};
#endif

std::unique_ptr<IpcClient> IpcClient::create() {
#if defined(_WIN32)
    return std::make_unique<WindowsIpcClient>();
#else
    return std::make_unique<UnixIpcClient>();
#endif
}
