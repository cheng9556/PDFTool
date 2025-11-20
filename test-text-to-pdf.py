#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
文本转PDF功能测试脚本
"""
import requests
import os
import time

SERVER_URL = 'http://localhost:8789'

def test_direct_text():
    """测试直接文本转换"""
    print("=" * 60)
    print("测试1: 直接文本输入转PDF")
    print("=" * 60)
    
    text_content = """这是一段测试文本。
    
文本转PDF功能测试：

1. 支持中文字符
2. 支持自动换行
3. 支持自动分页
4. 支持多种字体大小
5. 支持自定义行间距

This is a test text with English characters.
Testing automatic line wrapping and page breaking.

功能特点：
✓ 高性能转换
✓ 质量优秀
✓ 速度快速
✓ 支持多种编码

测试完成！"""
    
    data = {
        'text': text_content,
        'font_size': '14',
        'line_spacing': '1.8'
    }
    
    print(f"发送请求到: {SERVER_URL}/text/to-pdf")
    print(f"文本长度: {len(text_content)} 字符")
    print(f"字体大小: 14")
    print(f"行间距: 1.8")
    print()
    
    start_time = time.time()
    
    try:
        response = requests.post(
            f'{SERVER_URL}/text/to-pdf',
            data=data,
            timeout=60
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            print("✓ 转换成功！")
            print(f"  文件名: {result['filename']}")
            print(f"  页数: {result['pages']}")
            print(f"  字符数: {result['characters']}")
            print(f"  文件大小: {result['size']/1024:.2f} KB")
            print(f"  转换时间: {result['conversion_time']}")
            print(f"  请求耗时: {elapsed:.2f}s")
            print()
            
            # 下载文件
            download_url = f"{SERVER_URL}{result['url']}"
            print(f"下载文件: {download_url}")
            
            download_response = requests.get(download_url, timeout=30)
            if download_response.status_code == 200:
                output_file = f"test-output/text_direct_{result['filename']}"
                os.makedirs('test-output', exist_ok=True)
                
                with open(output_file, 'wb') as f:
                    f.write(download_response.content)
                
                print(f"✓ 文件已保存: {output_file}")
            else:
                print(f"✗ 下载失败: {download_response.status_code}")
        else:
            error = response.json().get('error', '未知错误')
            print(f"✗ 转换失败: {error}")
            
    except Exception as e:
        print(f"✗ 请求失败: {str(e)}")
    
    print()


def test_txt_file():
    """测试TXT文件转换"""
    print("=" * 60)
    print("测试2: TXT文件上传转PDF")
    print("=" * 60)
    
    # 创建测试TXT文件
    txt_content = """文本转PDF测试文档
===================

这是一个通过TXT文件上传的测试。

功能说明：
1. 支持TXT文件上传
2. 自动识别多种编码（UTF-8、GBK、GB2312、UTF-16）
3. 自动换行和分页
4. 中文字体支持

性能测试：
✓ 大文件支持（最大10MB）
✓ 快速转换
✓ 高质量输出

English text support test:
Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

特殊字符测试：
""" + "!"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~\n"

    # 保存测试文件
    test_file = 'test-sample.txt'
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write(txt_content)
    
    print(f"创建测试文件: {test_file}")
    print(f"文件大小: {os.path.getsize(test_file)} 字节")
    print()
    
    data = {
        'font_size': '12',
        'line_spacing': '1.5'
    }
    
    files = {
        'file': open(test_file, 'rb')
    }
    
    print(f"发送请求到: {SERVER_URL}/text/to-pdf")
    print(f"字体大小: 12")
    print(f"行间距: 1.5")
    print()
    
    start_time = time.time()
    
    try:
        response = requests.post(
            f'{SERVER_URL}/text/to-pdf',
            data=data,
            files=files,
            timeout=60
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            print("✓ 转换成功！")
            print(f"  文件名: {result['filename']}")
            print(f"  页数: {result['pages']}")
            print(f"  字符数: {result['characters']}")
            print(f"  文件大小: {result['size']/1024:.2f} KB")
            print(f"  转换时间: {result['conversion_time']}")
            print(f"  请求耗时: {elapsed:.2f}s")
            print()
            
            # 下载文件
            download_url = f"{SERVER_URL}{result['url']}"
            print(f"下载文件: {download_url}")
            
            download_response = requests.get(download_url, timeout=30)
            if download_response.status_code == 200:
                output_file = f"test-output/text_file_{result['filename']}"
                os.makedirs('test-output', exist_ok=True)
                
                with open(output_file, 'wb') as f:
                    f.write(download_response.content)
                
                print(f"✓ 文件已保存: {output_file}")
            else:
                print(f"✗ 下载失败: {download_response.status_code}")
        else:
            error = response.json().get('error', '未知错误')
            print(f"✗ 转换失败: {error}")
            
    except Exception as e:
        print(f"✗ 请求失败: {str(e)}")
    
    finally:
        files['file'].close()
    
    print()


def test_large_text():
    """测试大文本转换"""
    print("=" * 60)
    print("测试3: 大文本转换性能测试")
    print("=" * 60)
    
    # 生成大量文本（约5000字）
    paragraph = "这是一段测试文本，用于测试大文本转换的性能。" * 20
    text_content = "\n\n".join([f"第{i+1}段：\n{paragraph}" for i in range(10)])
    
    data = {
        'text': text_content,
        'font_size': '12',
        'line_spacing': '1.5'
    }
    
    print(f"发送请求到: {SERVER_URL}/text/to-pdf")
    print(f"文本长度: {len(text_content)} 字符")
    print()
    
    start_time = time.time()
    
    try:
        response = requests.post(
            f'{SERVER_URL}/text/to-pdf',
            data=data,
            timeout=120
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            print("✓ 转换成功！")
            print(f"  文件名: {result['filename']}")
            print(f"  页数: {result['pages']}")
            print(f"  字符数: {result['characters']}")
            print(f"  文件大小: {result['size']/1024:.2f} KB")
            print(f"  转换时间: {result['conversion_time']}")
            print(f"  请求耗时: {elapsed:.2f}s")
            print(f"  转换速度: {result['characters']/elapsed:.0f} 字符/秒")
            print()
        else:
            error = response.json().get('error', '未知错误')
            print(f"✗ 转换失败: {error}")
            
    except Exception as e:
        print(f"✗ 请求失败: {str(e)}")
    
    print()


def main():
    print()
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 18 + "文本转PDF功能测试" + " " * 18 + "║")
    print("╚" + "=" * 58 + "╝")
    print()
    
    # 检查服务是否运行
    try:
        response = requests.get(f'{SERVER_URL}/health', timeout=5)
        if response.status_code == 200:
            print("✓ Python服务正常运行")
            print()
        else:
            print("✗ Python服务未正常响应")
            print("  请先启动Python服务: cd server-python && python app_optimized.py")
            return
    except:
        print("✗ 无法连接到Python服务")
        print("  请先启动Python服务: cd server-python && python app_optimized.py")
        return
    
    # 运行测试
    test_direct_text()
    test_txt_file()
    test_large_text()
    
    print("=" * 60)
    print("所有测试完成！")
    print("=" * 60)
    print()


if __name__ == '__main__':
    main()


