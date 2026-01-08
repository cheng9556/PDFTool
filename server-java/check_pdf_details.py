#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
详细分析 test.pdf 的每一页特征
"""

import os
import fitz  # PyMuPDF

BASE_DIR = r"D:\AIProject\PDFTool\原型"
EXPECTED_PDF = os.path.join(BASE_DIR, "test.pdf")
OUTPUT_PDF = os.path.join(BASE_DIR, "my.pdf")

def analyze_pdf_details(file_path):
    """详细分析 PDF"""
    doc = fitz.open(file_path)
    page_count = len(doc)
    print(f"\n=== {os.path.basename(file_path)} ===")
    print(f"Total pages: {page_count}")
    
    for i in range(page_count):
        page = doc[i]
        rect = page.rect
        width_mm = rect.width * 25.4 / 72
        height_mm = rect.height * 25.4 / 72
        
        # 获取文本
        text = page.get_text()
        text_lines = text.strip().split('\n')
        first_line = text_lines[0] if text_lines else "(空)"
        
        # 获取文本块数量
        blocks = page.get_text("dict")["blocks"]
        text_blocks = [b for b in blocks if b.get("type") == 0]
        
        print(f"\n第 {i+1} 页:")
        print(f"  尺寸: {width_mm:.1f}mm x {height_mm:.1f}mm")
        print(f"  方向: {'横向' if width_mm > height_mm else '纵向'}")
        print(f"  文本块: {len(text_blocks)} 个")
        print(f"  字符数: {len(text)}")
        print(f"  首行: {first_line[:60]}...")
        
        # 检查是否空白
        if len(text.strip()) < 10:
            print(f"  ** 可能是空白页 **")
    
    doc.close()

print("=" * 60)
print("PDF 详细分析")
print("=" * 60)

analyze_pdf_details(EXPECTED_PDF)
analyze_pdf_details(OUTPUT_PDF)

print("\n" + "=" * 60)
print("对比总结")
print("=" * 60)

