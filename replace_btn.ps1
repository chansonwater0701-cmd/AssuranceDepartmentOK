$path = '1212.html'
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$content = $content.Replace("document.getElementById('btn-reset').style.display = 'block';", "document.getElementById('btn-next').style.display = 'flex';")
$content = $content.Replace("document.getElementById('btn-reset').style.display = 'none';", "document.getElementById('btn-next').style.display = 'none';")
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host 'Done'
