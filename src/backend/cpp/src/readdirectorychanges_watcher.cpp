#include "filesystem_watcher.h"

#ifdef _WIN32

#include <windows.h>
#include <iostream>
#include <thread>
#include <mutex>
#include <string>
#include <vector>
#include <filesystem>

namespace fs = std::filesystem;

class ReadDirectoryChangesWatcher : public FileSystemWatcher {
public:
    using FileSystemWatcher::FileSystemWatcher;
    ~ReadDirectoryChangesWatcher() override { stop(); }

    bool start() override {
        if (running_.exchange(true)) return false;
        thread_ = std::thread(&ReadDirectoryChangesWatcher::watchLoop, this);
        return true;
    }

    void stop() override {
        if (!running_.exchange(false)) return;
        {
            std::lock_guard<std::mutex> lock(handleMutex_);
            if (hDir_ != INVALID_HANDLE_VALUE) {
                CancelIoEx(hDir_, &overlapped_);
                CloseHandle(hDir_);
                hDir_ = INVALID_HANDLE_VALUE;
            }
        }
        if (overlapped_.hEvent) {
            SetEvent(overlapped_.hEvent);
        }
        if (thread_.joinable()) {
            thread_.join();
        }
        if (overlapped_.hEvent) {
            CloseHandle(overlapped_.hEvent);
            overlapped_.hEvent = nullptr;
        }
    }

private:
    HANDLE hDir_ = INVALID_HANDLE_VALUE;
    OVERLAPPED overlapped_{};
    std::thread thread_;
    std::mutex handleMutex_;

    static std::string wideToUtf8(const std::wstring& wstr) {
        if (wstr.empty()) return {};
        int len = WideCharToMultiByte(CP_UTF8, 0, wstr.data(), static_cast<int>(wstr.size()),
                                       nullptr, 0, nullptr, nullptr);
        if (len <= 0) return {};
        std::string result(static_cast<size_t>(len), '\0');
        WideCharToMultiByte(CP_UTF8, 0, wstr.data(), static_cast<int>(wstr.size()),
                            &result[0], len, nullptr, nullptr);
        return result;
    }

    void watchLoop() {
        HANDLE hDir = CreateFileW(
            std::wstring(watchPath_.begin(), watchPath_.end()).c_str(),
            FILE_LIST_DIRECTORY,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            nullptr,
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OVERLAPPED,
            nullptr);

        if (hDir == INVALID_HANDLE_VALUE) {
            std::cerr << "[ReadDirectoryChangesWatcher] Failed to open directory\n";
            running_ = false;
            return;
        }

        {
            std::lock_guard<std::mutex> lock(handleMutex_);
            if (!running_) {
                CloseHandle(hDir);
                return;
            }
            hDir_ = hDir;
        }

        std::vector<BYTE> buffer(65536);
        OVERLAPPED ov{};
        ov.hEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);
        if (!ov.hEvent) {
            std::cerr << "[ReadDirectoryChangesWatcher] Failed to create event\n";
            {
                std::lock_guard<std::mutex> lock(handleMutex_);
                hDir_ = INVALID_HANDLE_VALUE;
            }
            CloseHandle(hDir);
            running_ = false;
            return;
        }

        while (running_) {
            DWORD bytesReturned = 0;
            BOOL success = ReadDirectoryChangesW(
                hDir, buffer.data(), static_cast<DWORD>(buffer.size()),
                TRUE,
                FILE_NOTIFY_CHANGE_FILE_NAME |
                FILE_NOTIFY_CHANGE_DIR_NAME |
                FILE_NOTIFY_CHANGE_LAST_WRITE |
                FILE_NOTIFY_CHANGE_SIZE |
                FILE_NOTIFY_CHANGE_CREATION,
                &bytesReturned, &ov, nullptr);

            if (!success) {
                std::cerr << "[ReadDirectoryChangesWatcher] ReadDirectoryChangesW failed\n";
                break;
            }

            DWORD waitResult = WaitForSingleObject(ov.hEvent, 500);
            if (!running_) break;
            if (waitResult == WAIT_TIMEOUT) {
                // Cancel pending IO before retrying to avoid UB (re-issuing on same OVERLAPPED)
                CancelIoEx(hDir, &ov);
                continue;
            }
            if (waitResult != WAIT_OBJECT_0) break;

            DWORD dwBytes = 0;
            if (!GetOverlappedResult(hDir, &ov, &dwBytes, FALSE) || dwBytes == 0) {
                ResetEvent(ov.hEvent);
                continue;
            }

            auto* notify = reinterpret_cast<FILE_NOTIFY_INFORMATION*>(buffer.data());
            while (notify) {
                std::wstring wname(notify->FileName, notify->FileNameLength / sizeof(WCHAR));
                std::string name = wideToUtf8(wname);
                // Normalize to forward slashes for cross-platform portability
                for (auto& ch : name) {
                    if (ch == '\\') ch = '/';
                }

                switch (notify->Action) {
                    case FILE_ACTION_ADDED:
                        if (callback_) callback_({WatchEventType::Created, name, ""});
                        break;
                    case FILE_ACTION_MODIFIED:
                        if (callback_) callback_({WatchEventType::Modified, name, ""});
                        break;
                    case FILE_ACTION_REMOVED:
                        if (callback_) callback_({WatchEventType::Deleted, name, ""});
                        break;
                    case FILE_ACTION_RENAMED_OLD_NAME:
                        if (callback_) callback_({WatchEventType::Deleted, name, ""});
                        break;
                    case FILE_ACTION_RENAMED_NEW_NAME:
                        if (callback_) callback_({WatchEventType::Created, name, ""});
                        break;
                }

                if (notify->NextEntryOffset == 0) break;
                notify = reinterpret_cast<FILE_NOTIFY_INFORMATION*>(
                    reinterpret_cast<BYTE*>(notify) + notify->NextEntryOffset);
            }

            ResetEvent(ov.hEvent);
        }

        CloseHandle(ov.hEvent);
        {
            std::lock_guard<std::mutex> lock(handleMutex_);
            hDir_ = INVALID_HANDLE_VALUE;
        }
        CloseHandle(hDir);
    }
};

std::unique_ptr<FileSystemWatcher> createWatcher(
    const std::string& watchPath,
    FileSystemWatcher::Callback callback,
    std::chrono::milliseconds pollInterval)
{
    (void)pollInterval;
    return std::make_unique<ReadDirectoryChangesWatcher>(watchPath, std::move(callback));
}

#endif
