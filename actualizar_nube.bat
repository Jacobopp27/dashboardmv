@echo off
REM ============================================================
REM  ACTUALIZAR DASHBOARD EN LA NUBE (Vercel + Railway)
REM  1. Copia los Excel nuevos de D:\2026 Monteverdi a .\data
REM  2. Sube los cambios a GitHub
REM  3. Railway y Vercel se redespliegan automaticamente (~3 min)
REM ============================================================
cd /d "%~dp0"

echo.
echo [1/3] Sincronizando archivos Excel...
"C:\Users\tania\AppData\Local\Programs\Python\Python312\python.exe" sync_data.py
if errorlevel 1 goto :error

echo.
echo [2/3] Subiendo cambios a GitHub...
git add data/
git commit -m "Actualizacion de datos %date%"
if errorlevel 1 (
  echo No hay cambios nuevos para subir.
  goto :fin
)

echo.
echo [3/3] Enviando a la nube...
git push
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  LISTO. En ~3 minutos el dashboard en la nube estara
echo  actualizado. Revisa desde el celular.
echo ============================================================
goto :fin

:error
echo.
echo *** ERROR: revisa el mensaje de arriba. ***

:fin
pause
