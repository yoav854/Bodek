<#
  בודק התלוש - חבילת בדיקות עם תלושים פיקטיביים (הסקיל fake-payslips, הסוכן site-qa).
  מריצה את qa/cases.js ו-qa/runner.js מול check.html (הכלי) בכרום שקוף, ומדפיסה שורה לכל ממצא.
  עובדת ב-Windows (PowerShell 5.1) וב-Linux (pwsh, בבדיקה האוטומטית של GitHub).
    run-suite.ps1                      הקוד המקומי (התיקייה שמעל qa)
    run-suite.ps1 -Target live         האתר החי
    run-suite.ps1 -PageFile index.html     דף הכניסה (qa/landing-runner.js) במקום הכלי
    run-suite.ps1 -PageFile admin.html     דף ניהול העדכונים (qa/admin-runner.js)
    run-suite.ps1 -ExtraCases <js>     מקרים נוספים (window.QA_CASES.push(...))
    run-suite.ps1 -Repo <תיקייה>       check.html מתיקייה אחרת (למשל עותק עם באג מכוון)
  קוד יציאה: 0 תקין, 1 נמצאו בעיות, 2 ההרצה נכשלה.
#>
param(
  [ValidateSet('local', 'live')] [string]$Target = 'local',
  [string]$Repo = '',
  [ValidateSet('check.html', 'index.html', 'admin.html')] [string]$PageFile = 'check.html',
  [string]$LiveUrl = '',
  [string]$ExtraCases = ''
)
$ErrorActionPreference = 'Stop'
if (-not $LiveUrl) { $LiveUrl = 'https://bodek-eight.vercel.app/' + $(if ($PageFile -eq 'index.html') { '' } else { $PageFile }) }
$qa = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Repo) { $Repo = Split-Path -Parent $qa }
$work = Join-Path ([IO.Path]::GetTempPath()) ('bodek-qa-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $work | Out-Null
$utf8 = New-Object Text.UTF8Encoding($false)
$read = { param($p) [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }
try {
  if ($Target -eq 'live') { $page = (Invoke-WebRequest $LiveUrl -UseBasicParsing).Content }
  else { $page = & $read (Join-Path $Repo $PageFile) }
  if ($PageFile -eq 'index.html') { $inject = '<script>' + (& $read (Join-Path $qa 'landing-runner.js')) + '</script>' }
  elseif ($PageFile -eq 'admin.html') { $inject = '<script>' + (& $read (Join-Path $qa 'admin-runner.js')) + '</script>' }
  else {
    $inject = '<script>' + (& $read (Join-Path $qa 'cases.js')) + '</script>'
    if ($ExtraCases) { $inject += '<script>' + (& $read $ExtraCases) + '</script>' }
    $inject += '<script>' + (& $read (Join-Path $qa 'runner.js')) + '</script>'
  }
  $harness = if ($page.Contains('</body>')) { $page.Replace('</body>', $inject + '</body>') } else { $page + $inject }
  # לוכד שגיאות בראש הדף: אם החבילה לא מסיימת, נכתב qa-err עם הכותרת, מצב הטעינה והשגיאות, כדי שהכישלון יסביר את עצמו
  $catcher = '<script>window.__qaErr=[];addEventListener("error",function(e){__qaErr.push((e.message||("resource failed: "+((e.target&&(e.target.src||e.target.href))||"?")))+(e.lineno?" @"+e.lineno:""))},true);addEventListener("unhandledrejection",function(e){__qaErr.push("promise: "+(e.reason&&e.reason.message||e.reason))});setTimeout(function(){if(!document.getElementById("qa-out")){var p=document.createElement("pre");p.id="qa-err";p.textContent=JSON.stringify({title:document.title,ready:document.readyState,len:document.documentElement.outerHTML.length,err:__qaErr});document.body.appendChild(p)}},12000)</script>'
  $hi = $harness.IndexOf('<head>')
  $harness = if ($hi -ge 0) { $harness.Insert($hi + 6, $catcher) } else { $catcher + $harness }
  $html = Join-Path $work 'qa.html'
  [IO.File]::WriteAllText($html, $harness, $utf8)

  $cands = @()
  if ($env:LOCALAPPDATA) { $cands += Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe' }
  $cands += 'C:\Program Files\Google\Chrome\Application\chrome.exe'
  foreach ($n in 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser') { $c = Get-Command $n -ErrorAction SilentlyContinue; if ($c) { $cands += $c.Source } }
  $chrome = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $chrome) { Write-Output '🔴 קריטי | לא נמצא Chrome | להתקין Google Chrome'; exit 2 }

  $domFile = Join-Path $work 'dom.html'; $errFile = Join-Path $work 'err.txt'
  $baseArgs = @('--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-sandbox', "--user-data-dir=$(Join-Path $work 'profile')", '--virtual-time-budget=15000', '--dump-dom')
  if ($IsLinux -or $IsMacOS) {
    # בלינוקס (GitHub) כרום לא קיבל מ-pwsh את כתובת הקובץ ופתח לשונית ריקה (chrome://newtab).
    # לכן, כמו באבחון שעבד: שרת http מקומי, וכרום מופעל דרך bash.
    $port = Get-Random -Minimum 20000 -Maximum 40000
    $srv = Start-Process python3 -ArgumentList @('-m', 'http.server', "$port", '--bind', '127.0.0.1', '--directory', $work) -PassThru
    try {
      Start-Sleep -Seconds 2
      $url = "http://127.0.0.1:$port/qa.html"
      $cmd = "'$chrome' " + (($baseArgs | ForEach-Object { "'$_'" }) -join ' ') + " '$url' > '$domFile' 2> '$errFile'"
      & bash -c $cmd
    } finally { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue }
  } else {
    $url = ([Uri]$html).AbsoluteUri
    Start-Process $chrome -ArgumentList ($baseArgs + $url) -RedirectStandardOutput $domFile -RedirectStandardError $errFile -Wait -NoNewWindow
  }
  $dom = if (Test-Path $domFile) { & $read $domFile } else { '' }
  $ms = [regex]::Matches($dom, '<pre id="qa-out">(.*?)</pre>', 'Singleline')
  if (-not $ms.Count) {
    $e = if (Test-Path $errFile) { & $read $errFile } else { '' }
    $qe = [regex]::Match($dom, '<pre id="qa-err">(.*?)</pre>', 'Singleline')
    $diag = if ($qe.Success) { 'בדף: ' + [Net.WebUtility]::HtmlDecode($qe.Groups[1].Value) } else { "אורך הפלט מכרום: $($dom.Length) | " + (($e -split "`n" | Where-Object { $_ -notmatch 'dbus' } | Select-Object -Last 15) -join ' / ') }
    $msg = '🔴 קריטי | חבילת הבדיקות לא הסתיימה (הדף קרס או לא נטען) | ' + $diag
    Write-Output $msg; if ($env:GITHUB_ACTIONS) { Write-Output "::error::$msg"; Write-Output "--- chrome log ---"; Write-Output $e }; exit 2
  }
  $res = [Net.WebUtility]::HtmlDecode($ms[$ms.Count - 1].Groups[1].Value) | ConvertFrom-Json
  $icon = @{ 'קריטי' = '🔴'; 'גבוה' = '🟠'; 'בינוני' = '🟡' }
  $failed = @($res | Where-Object { -not $_.pass })
  foreach ($f in $failed) { $line = "{0} {1} | [{2}] {3}: {4} | {5}" -f $icon[$f.sev], $f.sev, $f.area, $f.name, $f.problem, $f.fix; Write-Output $line; if ($env:GITHUB_ACTIONS) { Write-Output "::error::$line" } }
  Write-Output ("🟢 תקין | {0} מתוך {1} בדיקות עברו ({2}, {3}) | —" -f @($res | Where-Object { $_.pass }).Count, $res.Count, $Target, $PageFile)
  if ($failed.Count) { exit 1 } else { exit 0 }
}
catch { $msg = "🔴 קריטי | ההרצה נכשלה: $($_.Exception.Message) | לבדוק את run-suite.ps1"; Write-Output $msg; if ($env:GITHUB_ACTIONS) { Write-Output "::error::$msg" }; exit 2 }
finally { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
