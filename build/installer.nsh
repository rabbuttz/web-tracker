!macro customInit
  ; Check if the application is running
  nsProcess::_FindProcess "WebCamTracker4Resonite.exe"
  Pop $R0
  ${If} $R0 = 0
    MessageBox MB_YESNO|MB_ICONQUESTION "WebCamTracker4Resonite is currently running.$\n$\nDo you want to close it and reinstall?" IDYES closeapp
    Quit
    closeapp:
      nsProcess::_CloseProcess "WebCamTracker4Resonite.exe"
      Sleep 1000
  ${EndIf}

  ; Check if application is already installed
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{${UNINSTALL_APP_KEY}}" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "WebCamTracker4Resonite is already installed.$\n$\nDo you want to reinstall it?" IDYES reinstall
    Quit
    reinstall:
  ${EndIf}
!macroend

!macro customInstall
  ; Enable auto-start with Resonite by default (recommended)
  WriteRegStr HKCU "Software\WebCamTracker4Resonite" "AutoStartWithResonite" "1"
!macroend
