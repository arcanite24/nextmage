; Playmat for Windows: installs for the current user (no administrator prompt) into
; %LOCALAPPDATA%\Programs\Playmat, with its own Java runtime, a Start menu entry and a desktop shortcut.
; Player data (accounts, decks, Career, the card database) lives in %LOCALAPPDATA%\Playmat and survives upgrades.
;
; Built by ops/desktop/package.sh:
;   iscc /DAppVersion=0.1.0 /DNumericVersion=0.1.0 /DSourceDir=<staged Playmat folder> /DOutputDir=<dist> Playmat.iss

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef NumericVersion
  #define NumericVersion "0.0.0"
#endif
#ifndef SourceDir
  #error Pass /DSourceDir=<staged folder with runtime\, app\ and playmat.ico>
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif

[Setup]
AppId={{6F1C3B7E-4D2A-4F7B-9C55-1E0B6A8D2F31}
AppName=Playmat
AppVersion={#AppVersion}
AppVerName=Playmat {#AppVersion}
AppPublisher=Playmat (a fan project)
AppPublisherURL=https://arcanite24.github.io/playmat/
AppSupportURL=https://discord.gg/SFQKFrTvww
AppUpdatesURL=https://github.com/arcanite24/playmat/releases/latest
VersionInfoVersion={#NumericVersion}
DefaultDirName={autopf}\Playmat
DefaultGroupName=Playmat
PrivilegesRequired=lowest
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
SetupIconFile={#SourceDir}\playmat.ico
UninstallDisplayIcon={app}\playmat.ico
UninstallDisplayName=Playmat
OutputDir={#OutputDir}
OutputBaseFilename=Playmat-Setup-Windows-x64
Compression=lzma2/max
SolidCompression=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
en.ReadyLabel1=Playmat is ready to install.
en.ReadyLabel2a=Everything it needs comes with it, Java included. Click Install; it takes a minute.
en.ReadyLabel2b=Everything it needs comes with it, Java included. Click Install; it takes a minute.
es.ReadyLabel1=Playmat está listo para instalarse.
es.ReadyLabel2a=Trae todo lo que necesita, Java incluido. Pulsa Instalar; tarda un minuto.
es.ReadyLabel2b=Trae todo lo que necesita, Java incluido. Pulsa Instalar; tarda un minuto.

[CustomMessages]
en.LaunchNow=Start Playmat now
es.LaunchNow=Abrir Playmat ahora
en.DeleteData=Also delete your Playmat data on this computer (accounts, decks, Career progress and the card database)?%n%nChoose No to keep it for a later install.
es.DeleteData=¿Borrar también tus datos de Playmat en este equipo (cuentas, mazos, progreso de Carrera y la base de datos de cartas)?%n%nElige No para conservarlos para una instalación futura.

[InstallDelete]
; a clean copy of each version: old jars would otherwise linger next to the new ones
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\runtime"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Playmat"; Filename: "{app}\runtime\bin\javaw.exe"; Parameters: "-jar ""{app}\app\playmat-launcher.jar"""; WorkingDir: "{app}"; IconFilename: "{app}\playmat.ico"; Comment: "Play Magic against the AI or with friends"
Name: "{autodesktop}\Playmat"; Filename: "{app}\runtime\bin\javaw.exe"; Parameters: "-jar ""{app}\app\playmat-launcher.jar"""; WorkingDir: "{app}"; IconFilename: "{app}\playmat.ico"; Comment: "Play Magic against the AI or with friends"

[Run]
Filename: "{app}\runtime\bin\javaw.exe"; Parameters: "-jar ""{app}\app\playmat-launcher.jar"""; WorkingDir: "{app}"; Description: "{cm:LaunchNow}"; Flags: nowait postinstall skipifsilent

[Code]
// Stops a running Playmat (its window and its game server both run on the bundled javaw.exe) so its files can be
// replaced or removed.
procedure StopPlaymat(AppDir: String);
var
  ResultCode: Integer;
begin
  // quoted for PowerShell: a user name like O'Brien can be in the path
  StringChangeEx(AppDir, '''', '''''', True);
  Exec('powershell.exe',
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process java,javaw -ErrorAction SilentlyContinue | ' +
    'Where-Object { $_.Path -and $_.Path.StartsWith(''' + AppDir + '\runtime\'', [StringComparison]::OrdinalIgnoreCase) } | ' +
    'Stop-Process -Force -ErrorAction SilentlyContinue"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopPlaymat(ExpandConstant('{app}'));
  Result := '';
end;

function InitializeUninstall(): Boolean;
begin
  StopPlaymat(ExpandConstant('{app}'));
  Result := True;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Data: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    Data := ExpandConstant('{localappdata}\Playmat');
    if DirExists(Data) and not UninstallSilent() then
      if MsgBox(CustomMessage('DeleteData'), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(Data, True, True, True);
  end;
end;
