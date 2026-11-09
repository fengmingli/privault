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
$targetValuePattern = $null
foreach ($edit in $edits) {
  $name = $edit.Current.Name
  $focusable = $edit.Current.IsKeyboardFocusable
  $valuePattern = $null
  $writable = $false
  if ($edit.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
    $writable = -not $valuePattern.Current.IsReadOnly
  }
  Write-Output "EDIT name='$name' class='$($edit.Current.ClassName)' focusable=$focusable writable=$writable"
  if ($focusable -and $writable -and $name -match 'Folder|File name|File Name|文件夹|文件名') {
    $targetEdit = $edit
    $targetValuePattern = $valuePattern
    break
  }
}
if (-not $targetEdit) {
  foreach ($edit in $edits) {
    $name = $edit.Current.Name
    $valuePattern = $null
    if (
      $edit.Current.IsKeyboardFocusable -and
      $name -notmatch 'Search|搜索' -and
      $edit.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern) -and
      -not $valuePattern.Current.IsReadOnly
    ) {
      $targetEdit = $edit
      $targetValuePattern = $valuePattern
      break
    }
  }
}
if (-not $targetEdit) {
  throw 'The native folder dialog edit box was not found.'
}

$targetValuePattern.SetValue($Directory)

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
} else {
  $targetEdit.SetFocus()
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}

Write-Output "Selected folder: $Directory"
