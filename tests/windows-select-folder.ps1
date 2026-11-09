param(
  [Parameter(Mandatory = $true)]
  [string]$Directory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

function ConvertTo-SendKeysText {
  param([string]$Text)
  return $Text -replace '([+^%~(){}])', '{$1}'
}

$appProcesses = @(Get-Process -Name 'privault-ui' -ErrorAction SilentlyContinue)
if ($appProcesses.Count -eq 0) {
  throw 'The Privault application process was not found.'
}
$appProcessIds = @{}
foreach ($process in $appProcesses) {
  $appProcessIds[[int]$process.Id] = $true
}

$root = [Windows.Automation.AutomationElement]::RootElement
$dialogCondition = New-Object Windows.Automation.PropertyCondition(
  [Windows.Automation.AutomationElement]::ClassNameProperty,
  '#32770'
)
$dialogs = $root.FindAll([Windows.Automation.TreeScope]::Children, $dialogCondition)
$dialog = $null
foreach ($candidate in $dialogs) {
  if ($appProcessIds.ContainsKey([int]$candidate.Current.ProcessId)) {
    $dialog = $candidate
    break
  }
}
if (-not $dialog) {
  throw 'The native folder dialog owned by Privault was not found.'
}

$dialog.SetFocus()
[System.Windows.Forms.SendKeys]::SendWait('%d')
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait((ConvertTo-SendKeysText $Directory))
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 800

$buttonCondition = New-Object Windows.Automation.PropertyCondition(
  [Windows.Automation.AutomationElement]::ControlTypeProperty,
  [Windows.Automation.ControlType]::Button
)
$buttons = $dialog.FindAll([Windows.Automation.TreeScope]::Subtree, $buttonCondition)
$selectButton = $null
foreach ($button in $buttons) {
  $name = $button.Current.Name
  Write-Output "BUTTON name='$name' class='$($button.Current.ClassName)'"
  if ($name -match '^(Select Folder|Open|选择文件夹|打开)$') {
    $selectButton = $button
    break
  }
}

if ($selectButton) {
  $invokePattern = $null
  if (-not $selectButton.TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern, [ref]$invokePattern)) {
    throw 'The native folder dialog select button cannot be invoked.'
  }
  $invokePattern.Invoke()
}

Write-Output "Selected folder: $Directory"
