#!/bin/bash

echo "========================================"
echo "Excel转PDF API测试脚本"
echo "========================================"
echo ""

echo "[1/3] 测试健康检查..."
curl -X GET http://localhost:8788/health
echo ""
echo ""

echo "[2/3] 请将测试Excel文件放在以下位置:"
echo "../原型/test.xlsx"
echo ""
read -p "按Enter继续..."

echo "[3/3] 开始转换..."
curl -X POST http://localhost:8788/excel/topdf \
  -F "file=@../原型/test.xlsx" \
  -o response.json
echo ""
echo ""

echo "转换完成！查看响应:"
cat response.json
echo ""
echo ""

echo "测试完成！"

