#!/usr/bin/env bash
set -euo pipefail

# Example only. Replace REMOTE_USER and REMOTE_HOST.
# Blender MCP addon should be running on the remote machine and listening on its localhost:9876.
#
# This forwards local port 9876 to the remote machine's localhost:9876.
# It does NOT expose Blender's socket publicly.

ssh -N   -L 9876:127.0.0.1:9876   REMOTE_USER@REMOTE_HOST
