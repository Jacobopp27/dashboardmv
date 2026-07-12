$startupPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Monteverdi Dashboard.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($startupPath)
$Shortcut.TargetPath = "D:\DASHBOARD 2026\start_silent.bat"
$Shortcut.WorkingDirectory = "D:\DASHBOARD 2026"
$Shortcut.WindowStyle = 7  # Minimizado
$Shortcut.Description = "Inicia el dashboard de Monteverdi al arrancar Windows"
$Shortcut.Save()
Write-Host "OK Shortcut creado en: $startupPath"
