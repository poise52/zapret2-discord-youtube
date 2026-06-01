# ===== ОБХОД ПОЛИТИКИ ВЫПОЛНЕНИЯ =====
if ($MyInvocation.Line -notmatch 'Bypass' -and $ExecutionContext.SessionState.LanguageMode -eq 'FullLanguage') {
    $currentPolicy = Get-ExecutionPolicy -Scope Process
    if ($currentPolicy -eq 'Restricted' -or $currentPolicy -eq 'AllSigned') {
        $scriptPath = $MyInvocation.MyCommand.Path
        if ($scriptPath) {
            Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
            exit
        }
    }
}

$rootDir = Split-Path $PSScriptRoot
$listsDir = Join-Path $rootDir "lists"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Обновление списков доменов Zapret2" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$urls = @{
    "russia-youtube.txt" = "https://raw.githubusercontent.com/bol-van/rulist/main/reestr_hostname.txt" # Для примера берем из rulist, но обычно ютуб отдельно
    # "discord.txt" = "..."
}

# В качестве примера скачиваем reestr_smart4.txt как russia-blacklist
$blacklistUrl = "https://raw.githubusercontent.com/bol-van/rulist/main/reestr_smart4.txt"
$blacklistFile = Join-Path $listsDir "russia-blacklist.txt"

Write-Host "[*] Скачивание базового листа блокировок (reestr_smart4)..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $blacklistUrl -OutFile $blacklistFile -UseBasicParsing
    Write-Host "[+] Успешно обновлено: russia-blacklist.txt" -ForegroundColor Green
} catch {
    Write-Host "[-] Ошибка при скачивании russia-blacklist.txt: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Обновление завершено." -ForegroundColor Cyan
Write-Host "Нажмите любую клавишу для выхода..." -ForegroundColor Yellow
[void][System.Console]::ReadKey($true)
