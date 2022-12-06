#Requires -Version 7.2

Add-Type -AssemblyName PresentationCore
$Html = [System.Windows.Clipboard]::GetText(3)
if (!$Html)
{
    Write-Host -ForegroundColor Red 'The clipboard is empty!'
    Return
}

$Html | Out-File -FilePath './tempHtmlFile.html'
node ./parseHTML.mjs './tempHtmlFile.html'
# Setting the clipboard is handled in Node.js script
Remove-Item './tempHtmlFile.html'
