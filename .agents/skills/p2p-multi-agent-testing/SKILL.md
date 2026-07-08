---
name: p2p-multi-agent-testing
description: Guidelines and scripts for orchestrating multi-agent integration testing of the Go/C++/Java P2P version control system.
---

# P2P Multi-Agent Integration Testing

This skill guides the orchestration of multiple autonomous agents to run, test, and verify the Go coordinator, C++ daemon, and Java frontend integration.

## Multi-Agent Topography

When performing integration testing, you should coordinate three specialized worker agents using `invoke_subagent`:

1. **Go Coordinator Agent**: Spins up and monitors the Go coordinator binary, managing SQLite and P2P connections.
2. **C++ Watcher Agent**: Spins up the C++ watcher daemon pointing to the watch directory.
3. **Java Frontend Simulator**: Simulates GUI interactions by sending socket IPC requests.
4. **Orchestrator Agent (You)**: Drives the test scenarios, triggers file changes, and asserts success.

## Local Test Harness

A python-based integration test script is located in this skill's `scripts/` directory:
- [integration_harness.py](file://./scripts/integration_harness.py)

Run this harness to perform end-to-end local synchronization checks.
