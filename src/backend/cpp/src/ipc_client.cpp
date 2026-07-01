#include "ipc_client.h"

#include <iostream>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <cstring>

namespace ipc {

IpcClient::IpcClient() : socket_fd_(-1) {}

IpcClient::~IpcClient() {
    disconnect();
}

bool IpcClient::connect(const std::string &socket_path) {
    disconnect();

    socket_fd_ = ::socket(AF_UNIX, SOCK_STREAM, 0);
    if (socket_fd_ < 0) {
        std::cerr << "[IpcClient] Error: Failed to create socket\n";
        return false;
    }

    struct sockaddr_un addr;
    std::memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    std::strncpy(addr.sun_path, socket_path.c_str(), sizeof(addr.sun_path) - 1);

    if (::connect(socket_fd_, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        std::cerr << "[IpcClient] Error: Connection to " << socket_path << " failed\n";
        ::close(socket_fd_);
        socket_fd_ = -1;
        return false;
    }

    std::cout << "[IpcClient] Connected to IPC socket at " << socket_path << "\n";
    return true;
}

void IpcClient::disconnect() {
    if (socket_fd_ >= 0) {
        ::close(socket_fd_);
        socket_fd_ = -1;
        std::cout << "[IpcClient] Disconnected\n";
    }
}

bool IpcClient::send_message(const nlohmann::json &message) {
    if (socket_fd_ < 0) {
        std::cerr << "[IpcClient] Error: Not connected\n";
        return false;
    }

    std::string data = message.dump();
    uint32_t len = data.size();
    uint32_t net_len = htonl(len); // convert to big-endian

    // Write length prefix
    if (::write(socket_fd_, &net_len, 4) != 4) {
        std::cerr << "[IpcClient] Error: Failed to write length prefix\n";
        disconnect();
        return false;
    }

    // Write JSON payload
    ssize_t written = ::write(socket_fd_, data.data(), data.size());
    if (written != static_cast<ssize_t>(data.size())) {
        std::cerr << "[IpcClient] Error: Failed to write complete payload\n";
        disconnect();
        return false;
    }

    return true;
}

} // namespace ipc
