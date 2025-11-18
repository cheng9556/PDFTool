#!/bin/bash
# PDF转Word Python服务启动脚本 (Linux/Mac)

echo "========================================"
echo "PDF转Word服务启动脚本"
echo "========================================"
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python 3.8+"
    exit 1
fi

echo "Python版本:"
python3 --version
echo ""

# 检查虚拟环境是否存在
if [ ! -d "venv" ]; then
    echo "首次运行，正在创建虚拟环境..."
    python3 -m venv venv
    echo "虚拟环境创建完成"
    echo ""
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source venv/bin/activate

# 安装依赖
echo "检查并安装依赖..."
pip install -r requirements.txt
echo ""

# 启动服务
echo "启动PDF转Word服务..."
echo "服务地址: http://localhost:8789"
echo "按 Ctrl+C 停止服务"
echo ""

python app.py

