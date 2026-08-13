param(
  [switch]$Build,
  [switch]$Install
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Alleen browserveilige Supabase-configuratie. Zet nooit de sb_secret-key in dit bestand.
$envFile = Join-Path $root '.env.local'
@"
VITE_SUPABASE_URL=https://zwirsurarahtisrhrfbr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_SCWvl9tr3aPq1-gh4YSbfw_6Ne2bMKr
VITE_MEMBER_EMAIL=hockeylid@houtenheren1.local
VITE_ADMIN_EMAIL=admin@houtenheren1.local
"@ | Set-Content -Path $envFile -Encoding UTF8

if ($Install -or -not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host 'Dependencies installeren...' -ForegroundColor Cyan
  npm.cmd install
}

if ($Build) {
  Write-Host 'Productie-build maken...' -ForegroundColor Cyan
  npm.cmd run build
  Write-Host ''
  Write-Host 'Klaar. Upload alleen de inhoud van dist/ naar Neocities.' -ForegroundColor Green
  exit 0
}

Write-Host 'Dashboard starten op http://localhost:5173' -ForegroundColor Green
Write-Host 'Stoppen: Ctrl+C' -ForegroundColor DarkGray
npm.cmd run dev -- --host 127.0.0.1
