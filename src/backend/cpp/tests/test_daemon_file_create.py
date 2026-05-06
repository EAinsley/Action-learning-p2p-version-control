#!/usr/bin/env python3

import subprocess
import tempfile
import time
import sys
import json
from pathlib import Path


print(sys.argv, flush=True)

daemon_path = sys.argv[1]

with tempfile.TemporaryDirectory() as tmp:
    watch_dir = Path(tmp)
    print("watch_dir:", watch_dir, flush=True)

    proc = subprocess.Popen(
        [daemon_path, str(watch_dir)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        # Give daemon time to start and register inotify/watch
        time.sleep(0.5)

        test_file = watch_dir / "hello.txt"
        test_file.write_text("hello")

        print("Created file:", test_file, flush=True)

        # Give daemon time to observe and print the event
        time.sleep(2)

        # Stop daemon so stdout reaches EOF
        proc.terminate()

        try:
            output, _ = proc.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            output, _ = proc.communicate(timeout=3)

        print("Daemon output:")
        print(output, flush=True)

        events = []

        for line in output.splitlines():
            if "[JSON]" not in line:
                continue

            json_part = line.split("[JSON]", 1)[1].strip()

            try:
                event = json.loads(json_part)
                events.append(event)
            except json.JSONDecodeError:
                print("Invalid JSON line:", line, flush=True)
                sys.exit(1)

        expected = {
            "filename": "hello.txt",
            "action": "created",
        }

        found = any(
            event.get("filename") == expected["filename"]
            and event.get("action") == expected["action"]
            for event in events
        )

        if not found:
            print("Expected event not found:", expected, flush=True)
            print("Parsed events:", events, flush=True)
            sys.exit(1)

        print("Test passed", flush=True)
        sys.exit(0)

    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
