Param ([string]$TempFilePath)
if (!$TempFilePath)
{
    Throw 'No path for temporary HTML file given!'
}

Add-Type -AssemblyName PresentationCore

$Html = [System.Windows.Clipboard]::GetText(3)
if (!$Html)
{
    Throw 'The clipboard doesnt contain Word data!'
}

$Html | Out-File -FilePath $TempFilePath
