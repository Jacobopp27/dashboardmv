@echo off
REM ========================================================================
REM   Monteverdi Dashboard — Inicio automatico (silencioso)
REM   Lanza backend + frontend al iniciar Windows, sin requerir clicks.
REM ========================================================================

REM Verificar si ya esta corriendo (evita doble arranque)
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    REM Ya esta corriendo, salir silenciosamente
    exit /b 0
)

REM Backend FastAPI - ventana minimizada
start /min "Monteverdi Backend" cmd /k ^
    "cd /d D:\DASHBOARD 2026 && ^
     C:\Users\tania\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn backend.api:app --host 0.0.0.0 --port 8000 --log-level warning"

REM Esperar a que backend arranque
timeout /t 5 /nobreak >nul

REM Frontend Vite - ventana minimizada
start /min "Monteverdi Frontend" cmd /k ^
    "cd /d D:\DASHBOARD 2026\frontend && ^
     ""C:\Program Files\nodejs\npm.cmd"" run dev -- --host 0.0.0.0"

exit /b 0
