; build/installer.nsh
; Open Crow — Minimalist Siyah & Neon Cyan Smooth Kurulum & Kaldırma Sihirbazı
; Windows 10/11 DWM Immersive Dark Mode, Özel Koyu Renkler, Uxtheme Bar Skini ve Tipografi

!include "LogicLib.nsh"
!include "WinMessages.nsh"

; ─── MUI2 Global Koyu Tema Renkleri ──────────────────────────────────────────
!define MUI_BGCOLOR "0D0E12"
!define MUI_TEXTCOLOR "FFFFFF"
!define MUI_INSTFILESPAGE_COLORS "FFFFFF 0D0E12"
!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"

; ─── Kurulum Sayfaları Hookları ──────────────────────────────────────────────
!ifndef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_GUIINIT KragaInstallerGuiInit
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW KragaDirectoryPageShow

  ; InstFiles sayfası öncesinde show fonksiyonunu bağla
  !macro customPageAfterChangeDir
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW KragaInstFilesPageShow
  !macroend

  ; Finish sayfası öncesinde show fonksiyonunu bağla
  !macro customFinishPage
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW KragaFinishPageShow
    !insertmacro MUI_PAGE_FINISH
  !macroend

  Function KragaInstallerGuiInit
    ; 1. Windows DWM Immersive Dark Mode (Siyah Başlık Çubuğu)
    ; Windows 10 1809 - 1909 (Attribute 19)
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 19, *i 1, i 4)'
    ; Windows 10 2004+ ve Windows 11 (Attribute 20)
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 20, *i 1, i 4)'

    ; 2. Windows 11 Köşe Yuvarlama (DWMWCP_ROUND = 2, Attribute 33)
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 33, *i 2, i 4)'

    ; 3. Ana Pencere Arka Planı (Koyu Renk: 0x120E0D - BGR / #0D0E12)
    SetCtlColors $HWNDPARENT 0xFFFFFF 0x0D0E12
    System::Call 'gdi32::CreateSolidBrush(i 0x120E0D) i .r0'
    System::Call 'user32::SetClassLongW(i $HWNDPARENT, i -10, i r0)'

    ; 4. Sol alt Branding Text (ID 1028)
    GetDlgItem $r1 $HWNDPARENT 1028
    ${If} $r1 != 0
      SetCtlColors $r1 0x666A78 0x0D0E12
    ${EndIf}
  FunctionEnd

  ; ── Dizin Seçim Sayfası Teması ──
  Function KragaDirectoryPageShow
    Push $R0
    Push $R1
    Push $R2

    FindWindow $R0 "#32770" "" $HWNDPARENT
    ${If} $R0 != 0
      ; Dialog arka plan fırçası (BGR 0x120E0D / #0D0E12)
      System::Call 'gdi32::CreateSolidBrush(i 0x120E0D) i .R2'
      System::Call 'user32::SetClassLongW(i $R0, i -10, i R2)'
      SetCtlColors $R0 0xFFFFFF 0x0D0E12

      ; DWM Dark Mode
      System::Call 'dwmapi::DwmSetWindowAttribute(i $R0, i 19, *i 1, i 4)'
      System::Call 'dwmapi::DwmSetWindowAttribute(i $R0, i 20, *i 1, i 4)'
      System::Call 'dwmapi::DwmSetWindowAttribute(i $R0, i 33, *i 2, i 4)'

      ; Statik metinler: 1006 (Açıklama)
      GetDlgItem $R1 $R0 1006
      ${If} $R1 != 0
        SetCtlColors $R1 0xD0D4DC 0x0D0E12
      ${EndIf}

      ; Çirkin beyaz kutu çizen GroupBox (ID 1020) çerçevesini kaldır
      GetDlgItem $R1 $R0 1020
      ${If} $R1 != 0
        ShowWindow $R1 0
      ${EndIf}

      ; Disk Alanı metinleri: 1023 (Gereken alan), 1024 (Kullanılabilir alan)
      GetDlgItem $R1 $R0 1023
      ${If} $R1 != 0
        SetCtlColors $R1 0x8A8F9B 0x0D0E12
      ${EndIf}
      GetDlgItem $R1 $R0 1024
      ${If} $R1 != 0
        SetCtlColors $R1 0x8A8F9B 0x0D0E12
      ${EndIf}

      ; Dizin Edit Kutusu (ID 1019)
      GetDlgItem $R1 $R0 1019
      ${If} $R1 != 0
        SetCtlColors $R1 0xFFFFFF 0x1A1C24
      ${EndIf}

      ; Gözat Butonu (ID 1001)
      GetDlgItem $R1 $R0 1001
      ${If} $R1 != 0
        SetCtlColors $R1 0xFFFFFF 0x1E2028
      ${EndIf}

      System::Call 'user32::InvalidateRect(i $R0, i 0, i 1)'
      System::Call 'user32::UpdateWindow(i $R0)'
    ${EndIf}

    ; Alt butonları ve branding'i renklendir
    GetDlgItem $R1 $HWNDPARENT 1028
    ${If} $R1 != 0
      SetCtlColors $R1 0x666A78 0x0D0E12
    ${EndIf}

    GetDlgItem $R1 $HWNDPARENT 1
    ${If} $R1 != 0
      SetCtlColors $R1 0xFFFFFF 0x1E2028
    ${EndIf}
    GetDlgItem $R1 $HWNDPARENT 2
    ${If} $R1 != 0
      SetCtlColors $R1 0xD0D4DC 0x1E2028
    ${EndIf}
    GetDlgItem $R1 $HWNDPARENT 3
    ${If} $R1 != 0
      SetCtlColors $R1 0xD0D4DC 0x1E2028
    ${EndIf}

    System::Call 'user32::InvalidateRect(i $HWNDPARENT, i 0, i 1)'
    System::Call 'user32::UpdateWindow(i $HWNDPARENT)'

    Pop $R2
    Pop $R1
    Pop $R0
  FunctionEnd

  ; ── Yükleniyor (InstFiles / Progress) Sayfası Teması ──
  Function KragaInstFilesPageShow
    Push $R0
    Push $R1
    Push $R2

    FindWindow $R0 "#32770" "" $HWNDPARENT
    ${If} $R0 != 0
      ; Koyu Dialog Arka Planı
      System::Call 'gdi32::CreateSolidBrush(i 0x120E0D) i .R2'
      System::Call 'user32::SetClassLongW(i $R0, i -10, i R2)'
      SetCtlColors $R0 0xFFFFFF 0x0D0E12

      ; DWM Dark Mode
      System::Call 'dwmapi::DwmSetWindowAttribute(i $R0, i 19, *i 1, i 4)'
      System::Call 'dwmapi::DwmSetWindowAttribute(i $R0, i 20, *i 1, i 4)'

      ; Statik Durum Metinleri: 1006 (Kuruluyor...), 1027 (Kopya detayları)
      GetDlgItem $R1 $R0 1006
      ${If} $R1 != 0
        SetCtlColors $R1 0xFFFFFF 0x0D0E12
      ${EndIf}
      GetDlgItem $R1 $R0 1027
      ${If} $R1 != 0
        SetCtlColors $R1 0x8A8F9B 0x0D0E12
      ${EndIf}

      ; Beyaz devasa listbox'ı (ID 1016) gizle (çirkin beyaz kutuyu yok eder)
      GetDlgItem $R1 $R0 1016
      ${If} $R1 != 0
        ShowWindow $R1 0
      ${EndIf}

      ; İlerleme Çubuğu (ID 1004)
      GetDlgItem $R1 $R0 1004
      ${If} $R1 != 0
        SendMessage $R1 0x2001 0 0x0D0E12 ; PBM_SETBKCOLOR (Arka plan siyah)
        SendMessage $R1 0x0409 0 0x00F0FF ; PBM_SETBARCOLOR (Neon Cyan)
      ${EndIf}

      System::Call 'user32::InvalidateRect(i $R0, i 0, i 1)'
      System::Call 'user32::UpdateWindow(i $R0)'
    ${EndIf}

    Pop $R2
    Pop $R1
    Pop $R0
  FunctionEnd

  ; ── Kurulum Tamamlandı (Finish) Sayfası Teması ──
  Function KragaFinishPageShow
    Push $R0
    Push $R1
    Push $R2

    FindWindow $R0 "#32770" "" $HWNDPARENT
    ${If} $R0 != 0
      System::Call 'gdi32::CreateSolidBrush(i 0x120E0D) i .R2'
      System::Call 'user32::SetClassLongW(i $R0, i -10, i R2)'
      SetCtlColors $R0 0xFFFFFF 0x0D0E12

      ; DWM Dark Mode
      System::Call 'dwmapi::DwmSetWindowAttribute(i $R0, i 19, *i 1, i 4)'
      System::Call 'dwmapi::DwmSetWindowAttribute(i $R0, i 20, *i 1, i 4)'

      ; Başlık ve Alt Metin (ID 1201, 1202)
      GetDlgItem $R1 $R0 1201
      ${If} $R1 != 0
        SetCtlColors $R1 0xFFFFFF 0x0D0E12
      ${EndIf}
      GetDlgItem $R1 $R0 1202
      ${If} $R1 != 0
        SetCtlColors $R1 0xD0D4DC 0x0D0E12
      ${EndIf}

      ; Checkbox (ID 1203 "Open Crow programını çalıştır")
      GetDlgItem $R1 $R0 1203
      ${If} $R1 != 0
        SetCtlColors $R1 0xFFFFFF 0x0D0E12
      ${EndIf}

      System::Call 'user32::InvalidateRect(i $R0, i 0, i 1)'
      System::Call 'user32::UpdateWindow(i $R0)'
    ${EndIf}

    ; Bitir Butonu
    GetDlgItem $R1 $HWNDPARENT 1
    ${If} $R1 != 0
      SetCtlColors $R1 0xFFFFFF 0x1E2028
    ${EndIf}

    Pop $R2
    Pop $R1
    Pop $R0
  FunctionEnd

!else
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.KragaUninstallerGuiInit

  Function un.KragaUninstallerGuiInit
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 19, *i 1, i 4)'
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 20, *i 1, i 4)'
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 33, *i 2, i 4)'

    SetCtlColors $HWNDPARENT 0xFFFFFF 0x0D0E12
    System::Call 'gdi32::CreateSolidBrush(i 0x120E0D) i .r0'
    System::Call 'user32::SetClassLongW(i $HWNDPARENT, i -10, i r0)'

    GetDlgItem $r1 $HWNDPARENT 1028
    ${If} $r1 != 0
      SetCtlColors $r1 0x666A78 0x0D0E12
    ${EndIf}
  FunctionEnd
!endif
