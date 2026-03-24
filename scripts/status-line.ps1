# scripts/status-line.ps1
#
# Stable PowerShell launcher for the claude-status statusLine command.
#
# CALL CHAIN CONTRACT
# ===================
# Claude Code calls this script as the statusLine.command. The call chain is:
#
#   ~/.claude/settings.json
#     statusLine.command = <CLAUDE_PLUGIN_DATA>/bin/status-line.ps1
#         |
#         v
#   status-line.ps1  (this file, copied to CLAUDE_PLUGIN_DATA/bin/ by SessionStart hook)
#         |
#         v  stdin piped through
#   node <CLAUDE_PLUGIN_DATA>/runtime/dist/render.js
#         |
#         v
#   stdout: one-line status string
#
# STDIN CONTRACT
# ==============
# Claude Code passes a JSON object via stdin. Known fields:
#   rate_limits.five_hour.used_percentage   (week usage %)
#   rate_limits.seven_day.used_percentage   (session usage %)
#   model                                   (current model name)
#   session_id                              (current session id)
#
# STDOUT CONTRACT
# ===============
# Output must be a single line of text. Example:
#   week 42% session 18% | gmail 7 | tasks 3 | jira 5 | github 4
#
# EXIT CODES
# ==========
#   0  - ALWAYS. On any error a fallback string is written to stdout so that
#        Claude Code never receives an empty status line.  render.js mirrors
#        this contract: it catches all exceptions and exits 0.
#
# FALLBACK BEHAVIOR
# =================
# On any error (node not found, render.js missing, runtime exception),
# this script outputs a minimal fallback string and exits 0 so Claude Code
# does not log spurious errors.

param()

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------
$pluginData = $env:CLAUDE_PLUGIN_DATA
if (-not $pluginData) {
    # Derive from this script's location: CLAUDE_PLUGIN_DATA/bin/status-line.ps1
    $pluginData = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
}

$renderScript = Join-Path $pluginData 'runtime' 'dist' 'render.js'
$logFile      = Join-Path $pluginData 'logs' 'launcher.log'

function Write-Log {
    param([string]$Message)
    $ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    $line = "[$ts] [launcher] $Message"
    try {
        $logDir = Split-Path $logFile
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
        Add-Content -Path $logFile -Value $line -Encoding UTF8
    } catch {
        # Logging must never crash the launcher
    }
}

# ---------------------------------------------------------------------------
# Read stdin (Claude Code passes JSON via stdin)
# ---------------------------------------------------------------------------
$stdinData = $null
try {
    if ([Console]::IsInputRedirected) {
        $stdinData = [Console]::In.ReadToEnd()
    }
} catch {
    Write-Log "WARNING: Failed to read stdin: $_"
}

# ---------------------------------------------------------------------------
# Validate prerequisites
# ---------------------------------------------------------------------------
$nodePath = $null
try {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) { $nodePath = $nodeCmd.Source }
} catch {}

if (-not $nodePath) {
    Write-Log "ERROR: node not found in PATH"
    Write-Output 'status: node missing'
    exit 0
}

if (-not (Test-Path $renderScript)) {
    Write-Log "ERROR: render.js not found at $renderScript"
    Write-Output 'status: build missing'
    exit 0
}

# ---------------------------------------------------------------------------
# Invoke node render.js, piping stdin through
# ---------------------------------------------------------------------------
try {
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName               = $nodePath
    $psi.Arguments              = "`"$renderScript`""
    $psi.UseShellExecute        = $false
    $psi.RedirectStandardInput  = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding  = [System.Text.Encoding]::UTF8

    $proc = [System.Diagnostics.Process]::new()
    $proc.StartInfo = $psi
    [void]$proc.Start()

    # Write stdin to node process
    if ($stdinData) {
        $proc.StandardInput.Write($stdinData)
    }
    $proc.StandardInput.Close()

    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    if ($proc.ExitCode -ne 0) {
        Write-Log "render.js exited $($proc.ExitCode): $stderr"
        Write-Output 'status: render error'
        exit 0
    }

    if ($stderr) {
        Write-Log "render.js stderr: $stderr"
    }

    # Output the status line (trim trailing newline)
    Write-Output $stdout.TrimEnd()
    exit 0

} catch {
    Write-Log "ERROR: Launcher exception: $_"
    Write-Output 'status: launcher error'
    exit 0
}
