<#
start-prod.ps1

Usage: Run this PowerShell script from the repository root as a developer.
It will:
 - build the frontend
 - stop existing node processes (optional behavior configurable)
 - start the backend bound to PORT 3000 so it serves the built frontend
 - optionally add a Windows Firewall rule to allow inbound TCP 3000 (requires admin)

Examples:
  # Basic: build + start (foreground)
  powershell -ExecutionPolicy Bypass -File start-prod.ps1

  # Background start (no firewall change)
  powershell -ExecutionPolicy Bypass -File start-prod.ps1 -Background

  # Add firewall rule (requires admin privileges)
  powershell -ExecutionPolicy Bypass -File start-prod.ps1 -AddFirewallRule
#>

param(
  [switch]$Background,
  [switch]$AddFirewallRule,
  [int]$Port = 3000
)

function Write-Log($msg) { Write-Host "[start-prod] $msg" }

try {
  # Build frontend
  Write-Log "Building frontend..."
  Push-Location "./leetflix-frontend"
  npm run build
  Pop-Location

  # Stop node processes (best-effort)
  Write-Log "Stopping existing node processes (if any)..."
  Stop-Process -Name node -Force -ErrorAction SilentlyContinue

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
    Write-Log "Backend started in background."
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
