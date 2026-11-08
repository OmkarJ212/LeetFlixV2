<#
start-prod.ps1

Usage: Run this PowerShell script from the repository root as a developer.
It will:
 - build the frontend (unless -SkipBuild is specified)
 - stop existing processes on the target port
 - start the backend bound to PORT 3000 so it serves the built frontend
 - optionally add a Windows Firewall rule to allow inbound TCP 3000 (requires admin)

Examples:
  # Basic: build + start (foreground)
  powershell -ExecutionPolicy Bypass -File start-prod.ps1

  # Fast start skipping rebuild:
  powershell -ExecutionPolicy Bypass -File start-prod.ps1 -SkipBuild

  # Background start (no firewall change)
  powershell -ExecutionPolicy Bypass -File start-prod.ps1 -Background

  # Add firewall rule (requires admin privileges)
  powershell -ExecutionPolicy Bypass -File start-prod.ps1 -AddFirewallRule
#>

param(
  [switch]$Background,
  [switch]$SkipBuild,
  [switch]$AddFirewallRule,
  [int]$Port = 3000
)

function Write-Log($msg) { Write-Host "[start-prod] $msg" }

try {
  $frontendBuild = Join-Path (Get-Location) "leetflix-frontend\build"
  $buildExists = Test-Path $frontendBuild

  # Build frontend if not skipping or if build doesn't exist
  if ($SkipBuild -and $buildExists) {
    Write-Log "Skipping frontend build (-SkipBuild specified and build/ exists)..."
  } else {
    Write-Log "Building frontend with optimizations..."
    Push-Location "./leetflix-frontend"
    npm run build
    Pop-Location
  }

  # Stop any existing process bound to $Port
  Write-Log "Checking for existing process on port $Port..."
  try {
    $portConn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($portConn) {
      $pids = $portConn | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($p in $pids) {
        if ($p -and $p -ne 0) {
          Write-Log "Stopping process $p on port $Port..."
          Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
      }
    }
  } catch {
    # Ignore if NetTCPConnection fails or access denied
  }

  # Optional firewall rule
  if ($AddFirewallRule) {
    Write-Log "Adding inbound firewall rule for TCP port $Port (requires admin)..."
    $ruleName = "LeetFlix Port $Port"
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -ErrorAction Stop
    Write-Log "Firewall rule added: $ruleName"
  }

  # Start backend
  Write-Log "Starting backend on port $Port..."
  Push-Location "./leetflix-backend"
  $env:PORT = [string]$Port

  if ($Background) {
    Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory (Get-Location) -NoNewWindow
    Write-Log "Backend started in background on http://localhost:$Port."
  }
  else {
    Write-Log "Starting backend in foreground. Press Ctrl+C to stop."
    node server.js
  }

} catch {
  Write-Error "start-prod failed: $_"
} finally {
  Pop-Location -ErrorAction SilentlyContinue
}
