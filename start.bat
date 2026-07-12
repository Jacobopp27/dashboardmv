@echo off
REM ========================================================================
REM   Monteverdi Dashboard — Inicio rapido
REM   Doble click sobre este archivo para levantar backend + frontend
REM ========================================================================
title Monteverdi Dashboard - Inicio

REM Backend FastAPI en una ventana nueva
start "Monteverdi Backend (FastAPI)" cmd /k ^
    "cd /d D:\DASHBOARD 2026 && ^
     C:\Users\tania\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn backend.api:app --host 0.0.0.0 --port 8000"

REM Esperar 4 segundos para que el backend arranque primero
timeout /t 4 /nobreak >nul

REM Frontend Vite en otra ventana nueva
start "Monteverdi Frontend (Vite)" cmd /k ^
    "cd /d D:\DASHBOARD 2026\frontend && ^
     ""C:\Program Files\nodejs\npm.cmd"" run dev -- --host 0.0.0.0"

REM Esperar a que ambos estén arriba antes de abrir el navegador
timeout /t 6 /nobreak >nul

REM Abrir el dashboard en el navegador predeterminado
start "" http://localhost:5173

echo.
echo ========================================================================
echo  Dashboard Monteverdi levantado en http://localhost:5173
echo.
echo  - Backend (FastAPI):  http://localhost:8000
echo  - Frontend (React):   http://localhost:5173
echo.
echo  Para detener: cierra las dos ventanas que se abrieron.
echo ========================================================================
echo.

pause
