# PACKSHIFT — Blender MCP Local Setup

This is the protected local setup step for the first Blender MCP benchmark.

Official provider candidate:
`teamipc/blender-mcp`

## Prerequisites

- Blender 3.0+
- Python 3.10+
- `uv` / `uvx`
- one MCP client only at a time

The preferred benchmark client for PACKSHIFT is **Cursor**, because the project repository and the Blender master contract live together.

## 1. Install uv

### macOS

```bash
brew install uv
```

### Windows PowerShell

```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

If Cursor cannot find `uvx`, run:

```powershell
where uvx
```

and use the absolute executable path in the MCP configuration.

### Linux

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Open a new shell afterwards.

## 2. Install the Blender addon

```bash
uvx --python 3.11 blender-mcp install-addon
```

Optional diagnostic:

```bash
uvx --python 3.11 blender-mcp addon-paths
```

## 3. Enable the Blender addon

In Blender:

`Edit → Preferences → Add-ons`

Search:

`Blender MCP`

Enable:

`Interface: Blender MCP`

Then in the 3D viewport:

- press `N`
- open the `BlenderMCP` tab
- click **Start MCP Server**

Default socket:
- host: `localhost`
- port: `9876`

## 4. Configure Cursor

Use one of the config examples in this directory:

- `cursor.macos-linux.json`
- `cursor.windows.json`

For a project-specific connection, copy the appropriate content into:

`.cursor/mcp.json`

in the repository root.

Fully restart Cursor after changing MCP configuration.

## 5. Security / telemetry

The PACKSHIFT examples set:

`DISABLE_TELEMETRY=true`

Blender MCP can execute arbitrary Blender Python. Save the scene before consequential mutations.

Do not store API keys inside:
- .blend custom properties
- committed MCP config
- exported GLB metadata
- repository files

## 6. Connection test

With Blender open and **Start MCP Server** active, ask the MCP client:

> Inspect the current Blender scene. Do not modify anything. Return the current objects, active scene, Blender version, and whether PACKSHIFT_ROOT exists.

Expected first result:
- Blender connection succeeds
- scene can be inspected
- no mutation occurs

Only after that should the PACKSHIFT build benchmark begin.

## Truth boundary

A connected MCP server proves connectivity only.

It does **not** prove:
- scene correctness
- Blender master quality
- GLB export
- Three.js integration
- provider promotion
