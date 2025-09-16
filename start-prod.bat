@echo off
REM start-prod.bat - single-file launcher (double-click to run)
REM Minimal, reliable sequence using cmd built-ins

SET SCRIPT_DIR=%~dp0
echo [start-prod] Building frontend...
cd /d "%SCRIPT_DIR%leetflix-frontend"
npm run build || (
	echo [start-prod] Frontend build failed. See npm output above.
	pause
	exit /b 1
)

echo [start-prod] Stopping existing LeetFlix backend if running (using backend.pid)...
cd /d "%SCRIPT_DIR%leetflix-backend"
if exist backend.pid (
	set /p PID=<backend.pid
	if defined PID (
		echo [start-prod] Found PID %PID%, attempting to stop it...
		taskkill /PID %PID% /F >nul 2>&1 || echo [start-prod] Failed to stop PID %PID% (maybe already stopped)
	) else (
		echo [start-prod] backend.pid exists but empty. Falling back to killing node.exe
		taskkill /IM node.exe /F >nul 2>&1
	)
) else (
	echo [start-prod] No backend.pid found; killing any node.exe processes (fallback)
	taskkill /IM node.exe /F >nul 2>&1
)

REM return to script root
cd /d "%SCRIPT_DIR%"

echo [start-prod] Starting backend on port 3000 in a new window...
cd /d "%SCRIPT_DIR%leetflix-backend"
REM Start backend in a new cmd window and set PORT for that process
start "LeetFlix Backend" cmd /k "set PORT=3000 && node server.js"

echo [start-prod] Waiting for server to become ready...
REM Wait up to ~15 seconds for localhost:3000 to respond
setlocal enabledelayedexpansion
set /a counter=0
:waitloop
	powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/' -TimeoutSec 2).StatusCode } catch { Write-Output 'ERR' }" > "%TEMP%\startprod_status.txt" 2>&1
	set /p status=<"%TEMP%\startprod_status.txt"
	del "%TEMP%\startprod_status.txt" >nul 2>&1
	if /I "%status%"=="ERR" (
		set /a counter+=1
		if %counter% GEQ 15 goto timeout
		ping -n 2 127.0.0.1 >nul
		goto waitloop
	)

echo [start-prod] Server is responding. Opening browser...
start "" "http://localhost:3000/"
endlocal

echo [start-prod] Done. Press any key to close this window...
pause >nul

:timeout
echo [start-prod] Timeout waiting for server to start. You can check logs in the backend window.
pause >nul