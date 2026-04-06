; INTAL PRO - Custom NSIS installer script
; Shton shkurtoren dhe ikonën në desktop

!macro customInstall
  ; Fshi cache të vjetër nëse ekziston
  RMDir /r "$APPDATA\intal-pro"
!macroend

!macro customUninstall
  RMDir /r "$APPDATA\intal-pro"
!macroend
