# PDF转Word API测试脚本
param(
    [string]$PdfFile = "D:\AIProject\PDFTool\原型\cowin_function_list_.pdf"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PDF转Word API 测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查服务是否运行
Write-Host "1. 检查服务状态..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8789/health" -Method Get
    Write-Host "✓ 服务运行正常" -ForegroundColor Green
    Write-Host "  服务: $($health.service)" -ForegroundColor Gray
    Write-Host "  版本: $($health.version)" -ForegroundColor Gray
} catch {
    Write-Host "✗ 服务未运行，请先启动服务" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 检查PDF文件是否存在
if (-not (Test-Path $PdfFile)) {
    Write-Host "错误: PDF文件不存在: $PdfFile" -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $PdfFile
Write-Host "2. 准备转换文件..." -ForegroundColor Yellow
Write-Host "  文件: $($fileInfo.Name)" -ForegroundColor Gray
Write-Host "  大小: $([math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor Gray
Write-Host ""

# 上传并转换
Write-Host "3. 上传并转换..." -ForegroundColor Yellow
try {
    $uri = "http://localhost:8789/pdf/toword"
    
    # 构建multipart/form-data请求
    $boundary = [System.Guid]::NewGuid().ToString()
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$($fileInfo.Name)`"",
        "Content-Type: application/pdf",
        "",
        [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString([System.IO.File]::ReadAllBytes($PdfFile)),
        "--$boundary--"
    )
    
    $body = $bodyLines -join "`r`n"
    $bodyBytes = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetBytes($body)
    
    $response = Invoke-RestMethod -Uri $uri -Method Post `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $bodyBytes
    
    Write-Host "✓ 转换成功" -ForegroundColor Green
    Write-Host "  输出文件: $($response.filename)" -ForegroundColor Gray
    Write-Host "  文件大小: $([math]::Round($response.size / 1KB, 2)) KB" -ForegroundColor Gray
    Write-Host "  转换耗时: $($response.conversion_time)" -ForegroundColor Gray
    Write-Host ""
    
    # 下载文件
    Write-Host "4. 下载转换后的文件..." -ForegroundColor Yellow
    $downloadUrl = "http://localhost:8789$($response.url)"
    $outputPath = "D:\AIProject\PDFTool\原型\output_word.docx"
    
    Invoke-WebRequest -Uri $downloadUrl -OutFile $outputPath
    
    Write-Host "✓ 下载完成" -ForegroundColor Green
    Write-Host "  保存位置: $outputPath" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "测试完成！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "✗ 转换失败" -ForegroundColor Red
    Write-Host "错误信息: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

