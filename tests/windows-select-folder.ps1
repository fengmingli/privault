param(
  [Parameter(Mandatory = $true)]
  [string]$Directory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

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

$editCondition = New-Object Windows.Automation.PropertyCondition(
  [Windows.Automation.AutomationElement]::ControlTypeProperty,
  [Windows.Automation.ControlType]::Edit
)
$edits = $dialog.FindAll([Windows.Automation.TreeScope]::Subtree, $editCondition)
$targetEdit = $null
foreach ($edit in $edits) {
  $name = $edit.Current.Name
  if ($name -match 'Folder|File name|File Name|文件夹|文件名') {
    $targetEdit = $edit
    break
  }
}
if (-not $targetEdit) {
  foreach ($edit in $edits) {
    $name = $edit.Current.Name
    if ($name -notmatch 'Search|搜索') {
      $targetEdit = $edit
      break
    }
  }
}
if (-not $targetEdit) {
  throw 'The native folder dialog edit box was not found.'
}

$targetEdit.SetFocus()
$valuePattern = $null
if (-not $targetEdit.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
  throw 'The native folder dialog edit box does not accept a value.'
}
$valuePattern.SetValue($Directory)

$buttonCondition = New-Object Windows.Automation.PropertyCondition(
  [Windows.Automation.AutomationElement]::ControlTypeProperty,
  [Windows.Automation.ControlType]::Button
)
$buttons = $dialog.FindAll([Windows.Automation.TreeScope]::Subtree, $buttonCondition)
$selectButton = $null
foreach ($button in $buttons) {
  $name = $button.Current.Name
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
} else {
  $targetEdit.SetFocus()
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}

Write-Output "Selected folder: $Directory"
