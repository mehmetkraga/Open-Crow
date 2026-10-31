Add-Type -AssemblyName System.Drawing

$buildDir = Join-Path $PSScriptRoot "..\build"
if (!(Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir -Force
}

$birdLogoPath = Join-Path $PSScriptRoot "..\assets\logo-bird.png"
$birdImg = $null
if (Test-Path $birdLogoPath) {
    $birdImg = [System.Drawing.Image]::FromFile($birdLogoPath)
}

# 1. Sidebar Bitmap (164 x 314, 24bpp RGB)
$sWidth = 164
$sHeight = 314
$sBmp = New-Object System.Drawing.Bitmap $sWidth, $sHeight, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$sG = [System.Drawing.Graphics]::FromImage($sBmp)
$sG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$sG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$sG.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Koyu Şık Arka Plan (#0D0E12)
$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(13, 14, 18))
$sG.FillRectangle($bgBrush, 0, 0, $sWidth, $sHeight)

# Üst Köşe Çizgisel Neon Vurguları
$gridPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(20, 0, 240, 255), 1)
for ($i = 0; $i -lt 120; $i += 10) {
    $sG.DrawLine($gridPen, 0, $i, $i, 0)
}

# Orijinal Kraga Kuş Logosu
if ($birdImg -ne $null) {
    $sG.DrawImage($birdImg, 40, 80, 84, 84)
}

# Başlıklar
$titleFont = New-Object System.Drawing.Font 'Segoe UI', 15, ([System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sG.DrawString('KRAGA', $titleFont, $titleBrush, 82, 185, $sf)
$sG.DrawString('IDE', $titleFont, $titleBrush, 82, 208, $sf)

# İnce Ayraç
$linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(40, 255, 255, 255), 1)
$sG.DrawLine($linePen, 35, 238, 129, 238)

# Alt Başlık
$subFont = New-Object System.Drawing.Font 'Segoe UI', 7.5, ([System.Drawing.FontStyle]::Bold)
$subBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0, 240, 255))
$sG.DrawString('AI CODING ASSISTANT', $subFont, $subBrush, 82, 246, $sf)

$sidebarPath = Join-Path $buildDir "installerSidebar.bmp"
$sBmp.Save($sidebarPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$sG.Dispose()
$sBmp.Dispose()

# 2. Header Bitmap (150 x 57, 24bpp RGB)
$hWidth = 150
$hHeight = 57
$hBmp = New-Object System.Drawing.Bitmap $hWidth, $hHeight, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$hG = [System.Drawing.Graphics]::FromImage($hBmp)
$hG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$hG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$hG.FillRectangle($bgBrush, 0, 0, $hWidth, $hHeight)

# Sağ tarafta orijinal küçük kuş logosu
if ($birdImg -ne $null) {
    $hG.DrawImage($birdImg, 102, 6, 44, 44)
    $birdImg.Dispose()
}

$headerPath = Join-Path $buildDir "installerHeader.bmp"
$hBmp.Save($headerPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$hG.Dispose()
$hBmp.Dispose()

Write-Host "Orijinal Kraga Kuş Logosu ile yeni NSIS bitmap'leri basariyla olusturuldu!" -ForegroundColor Green
