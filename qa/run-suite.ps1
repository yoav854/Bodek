<#
  בודק התלוש - חבילת בדיקות עם תלושים פיקטיביים (הסקיל fake-payslips, הסוכן site-qa).
  מריצה את qa/cases.js ו-qa/runner.js מול index.html בכרום שקוף, ומדפיסה שורה לכל ממצא.
  עובדת ב-Windows (PowerShell 5.1) וב-Linux (pwsh, בבדיקה האוטומטית של GitHub).
    run-suite.ps1                      הקוד המקומי (התיקייה שמעל qa)
    run-suite.ps1 -Target live         האתר החי
    run-suite.ps1 -ExtraCases <js>     מקרים נוספים (window.QA_CASES.push(...))
    run-suite.ps1 -Repo <תיקייה>       index.html מתיקייה אחרת (למשל עותק עם באג מכוון)
  קוד יציאה: 0 תקין, 1 נמצאו בעיות, 2 ההרצה נכשלה.
#>
param(
  [ValidateSet('local', 'live')] [string]$Target = 'local',
  [string]$Repo = '',
  [string]$LiveUrl = 'https://bodek-eight.vercel.app/',
  [string]$ExtraCases = ''
)
$ErrorActionPreference = 'Stop'
$qa = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Repo) { $Repo = Split-Path -Parent $qa }
$work = Join-Path ([IO.Path]::GetTempPath()) ('bodek-qa-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $work | Out-Null
$utf8 = New-Object Text.UTF8Encoding($false)
$read = { param($p) [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }
try {
  if ($Target -eq 'live') { $page = (Invoke-WebRequest $LiveUrl -UseBasicParsing).Content }
  else { $page = & $read (Join-Path $Repo 'index.html') }
  $inject = '<script>' + (& $read (Join-Path $qa 'cases.js')) + '</script>'
  if ($ExtraCases) { $inject += '<script>' + (& $read $ExtraCases) + '</script>' }
  $inject += '<script>' + (& $read (Join-Path $qa 'runner.js')) + '</script>'
  $harness = if ($page.Contains('</body>')) { $page.Replace('</body>', $inject + '</body>') } else { $page + $inject }
  $html = Join-Path $work 'qa.html'
  [IO.File]::WriteAllText($html, $harness, $utf8)

  $cands = @()
  if ($env:LOCALAPPDATA) { $cands += Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe' }
  $cands += 'C:\Program Files\Google\Chrome\Application\chrome.exe'
  foreach ($n in 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser') { $c = Get-Command $n -ErrorAction SilentlyContinue; if ($c) { $cands += $c.Source } }
  $chrome = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $chrome) { Write-Output '🔴 קריטי | לא נמצא Chrome | להתקין Google Chrome'; exit 2 }

  $url = ([Uri]$html).AbsoluteUri
  $chromeArgs = @('--headless=new', '--disable-gpu', '--no-first-run', '--no-sandbox', "--user-data-dir=$(Join-Path $work 'profile')", '--virtual-time-budget=15000', '--dump-dom', $url)
  $domFile = Join-Path $work 'dom.html'; $errFile = Join-Path $work 'err.txt'
  Start-Process $chrome -ArgumentList $chromeArgs -RedirectStandardOutput $domFile -RedirectStandardError $errFile -Wait -NoNewWindow
  $dom = & $read $domFile
  $ms = [regex]::Matches($dom, '<pre id="qa-out">(.*?)</pre>', 'Singleline')
  if (-not $ms.Count) { $e = (& $read $errFile); $msg = '🔴 קריטי | חבילת הבדיקות לא הסתיימה (הדף קרס או לא נטען) | ' + ($e -split "
" | Select-Object -Last 3) -join ' / '; Write-Output $msg; if ($env:GITHUB_ACTIONS) { Write-Output "::error::$msg" }; exit 2 }
  $res = [Net.WebUtility]::HtmlDecode($ms[$ms.Count - 1].Groups[1].Value) | ConvertFrom-Json
  $icon = @{ 'קריטי' = '🔴'; 'גבוה' = '🟠'; 'בינוני' = '🟡' }
  $failed = @($res | Where-Object { -not $_.pass })
  foreach ($f in $failed) { $line = "{0} {1} | [{2}] {3}: {4} | {5}" -f $icon[$f.sev], $f.sev, $f.area, $f.name, $f.problem, $f.fix; Write-Output $line; if ($env:GITHUB_ACTIONS) { Write-Output "::error::$line" } }
  Write-Output ("🟢 תקין | {0} מתוך {1} בדיקות עברו ({2}) | —" -f @($res | Where-Object { $_.pass }).Count, $res.Count, $Target)
  if ($failed.Count) { exit 1 } else { exit 0 }
}
catch { $msg = "🔴 קריטי | ההרצה נכשלה: $($_.Exception.Message) | לבדוק את run-suite.ps1"; Write-Output $msg; if ($env:GITHUB_ACTIONS) { Write-Output "::error::$msg" }; exit 2 }
finally { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
