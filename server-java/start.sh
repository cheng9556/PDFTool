#!/bin/bash

echo "========================================"
echo "Excel转PDF服务 (JodConverter)"
echo "========================================"
echo ""
echo "正在启动服务..."
echo "端口: 8788"
echo ""

cd "$(dirname "$0")"
mvn spring-boot:run


