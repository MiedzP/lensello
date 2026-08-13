@echo off
rem Double-click launcher for apply-migrations.ps1.
rem -ExecutionPolicy Bypass so an unsigned local script runs without changing
rem the machine-wide policy.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-migrations.ps1"
