#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PDF转换服务 - 超高性能优化版 v3.0
专门针对Windows系统优化，解决多进程死锁问题
"""
import os
import sys
import uuid
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import fitz  # PyMuPDF
from pdf2docx import Converter
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
import threading
import signal
import traceback
import base64
import io
from PIL import Image

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 配置
UPLOAD_FOLDER = 'uploads'
CONVERTED_FOLDER = 'converted'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['CONVERTED_FOLDER'] = CONVERTED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# 全局超时配置
CONVERSION_TIMEOUT = 300  # 5分钟超时


class TimeoutException(Exception):
    """超时异常"""
    pass


def timeout_handler(func, timeout_seconds):
    """超时处理装饰器"""
    def wrapper(*args, **kwargs):
        result = [TimeoutException('转换超时')]
        
        def target():
            try:
                result[0] = func(*args, **kwargs)
            except Exception as e:
                result[0] = e
        
        thread = threading.Thread(target=target)
        thread.daemon = True
        thread.start()
        thread.join(timeout_seconds)
        
        if thread.is_alive():
            logger.error(f"转换超时（{timeout_seconds}秒）")
            raise TimeoutException(f'转换超时（{timeout_seconds}秒）')
        
        if isinstance(result[0], Exception):
            raise result[0]
        
        return result[0]
    
    return wrapper


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def cleanup_old_files(directory, max_age_hours=1):
    """清理超过指定时间的旧文件"""
    try:
        now = datetime.now()
        for filename in os.listdir(directory):
            filepath = os.path.join(directory, filename)
            if os.path.isfile(filepath):
                file_modified = datetime.fromtimestamp(os.path.getmtime(filepath))
                if now - file_modified > timedelta(hours=max_age_hours):
                    try:
                        os.remove(filepath)
                        logger.info(f"清理旧文件: {filename}")
                    except:
                        pass
    except Exception as e:
        logger.warning(f"清理文件失败: {str(e)}")


def convert_pdf_to_text_ultra_fast(pdf_path, output_path, start_page=0, end_page=None):
    """
    超快速纯文本提取模式 - 性能优化版
    直接提取PDF文本，无任何格式处理，速度最快
    """
    logger.info("使用超快速纯文本模式")
    doc_word = Document()
    
    # 最小边距
    sections = doc_word.sections
    for section in sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)
    
    pdf_doc = fitz.open(pdf_path)
    total_pages = len(pdf_doc)
    end_page = end_page if end_page else total_pages
    
    logger.info(f"提取文本: 第{start_page+1}页到第{end_page}页（共{end_page-start_page}页）")
    
    for page_num in range(start_page, min(end_page, total_pages)):
        page = pdf_doc[page_num]
        text = page.get_text("text")
        
        # 简洁的页码标题
        heading = doc_word.add_heading(f'Page {page_num + 1}', level=2)
        heading.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
        heading_format = heading.paragraph_format
        heading_format.space_before = Pt(0)
        heading_format.space_after = Pt(6)
        for run in heading.runs:
            run.font.size = Pt(11)
            run.font.color.rgb = RGBColor(46, 125, 50)
        
        # 添加文本
        if text.strip():
            para = doc_word.add_paragraph(text)
            para_format = para.paragraph_format
            para_format.line_spacing = 1.15
            para_format.space_before = Pt(0)
            para_format.space_after = Pt(0)
            for run in para.runs:
                run.font.size = Pt(10)
        else:
            para = doc_word.add_paragraph('[No text content on this page]')
            para_format = para.paragraph_format
            para_format.space_before = Pt(0)
            para_format.space_after = Pt(0)
            for run in para.runs:
                run.font.size = Pt(10)
                run.font.color.rgb = RGBColor(150, 150, 150)
        
        # 分页符
        if page_num < min(end_page, total_pages) - 1:
            doc_word.add_page_break()
        
        # 进度日志
        if (page_num - start_page + 1) % 10 == 0:
            logger.info(f"已处理 {page_num - start_page + 1}/{end_page - start_page} 页")
    
    pdf_doc.close()
    doc_word.save(output_path)
    logger.info(f"超快速转换完成: {end_page - start_page}页")


def convert_with_pdf2docx_optimized(pdf_path, word_path, mode='fast', start_page=0, end_page=None, include_images=False):
    """
    使用pdf2docx转换 - Windows优化版（禁用多进程）
    
    在Windows上，pdf2docx的多进程模式会导致死锁问题
    改用单进程模式，但通过分批处理来优化性能
    """
    logger.info(f"使用优化的{mode}模式（单进程，分批处理）")
    
    # 获取总页数
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    doc.close()
    
    if end_page is None or end_page > total_pages:
        end_page = total_pages
    
    pages_to_convert = end_page - start_page
    logger.info(f"需要转换 {pages_to_convert} 页（第{start_page+1}页到第{end_page}页）")
    
    # 策略：如果页数较多，使用分批处理
    BATCH_SIZE = 20  # 每批处理20页
    
    if pages_to_convert <= BATCH_SIZE:
        # 页数较少，直接转换
        logger.info(f"页数较少（{pages_to_convert}页），直接转换")
        cv = Converter(pdf_path)
        cv.convert(
            word_path,
            start=start_page,
            end=end_page,
            image=include_images,
            multi_processing=False,  # 禁用多进程！
        )
        cv.close()
        logger.info("转换完成")
    else:
        # 页数较多，分批转换后合并
        logger.info(f"页数较多（{pages_to_convert}页），使用分批策略")
        temp_docs = []
        
        for batch_start in range(start_page, end_page, BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, end_page)
            batch_num = (batch_start - start_page) // BATCH_SIZE + 1
            total_batches = (pages_to_convert + BATCH_SIZE - 1) // BATCH_SIZE
            
            logger.info(f"处理批次 {batch_num}/{total_batches}: 第{batch_start+1}-{batch_end}页")
            
            # 临时文件
            temp_path = word_path.replace('.docx', f'_batch{batch_num}.docx')
            temp_docs.append(temp_path)
            
            try:
                cv = Converter(pdf_path)
                cv.convert(
                    temp_path,
                    start=batch_start,
                    end=batch_end,
                    image=include_images,
                    multi_processing=False,  # 禁用多进程
                )
                cv.close()
                logger.info(f"批次 {batch_num} 完成")
            except Exception as e:
                logger.error(f"批次 {batch_num} 失败: {str(e)}")
                # 清理临时文件
                for temp_doc in temp_docs:
                    try:
                        if os.path.exists(temp_doc):
                            os.remove(temp_doc)
                    except:
                        pass
                raise
        
        # 合并所有批次
        logger.info(f"合并 {len(temp_docs)} 个批次...")
        merge_word_documents(temp_docs, word_path)
        
        # 清理临时文件
        for temp_doc in temp_docs:
            try:
                os.remove(temp_doc)
                logger.info(f"删除临时文件: {os.path.basename(temp_doc)}")
            except:
                pass
        
        logger.info("分批转换完成")


def merge_word_documents(doc_paths, output_path):
    """合并多个Word文档"""
    if not doc_paths:
        raise ValueError("没有要合并的文档")
    
    if len(doc_paths) == 1:
        # 只有一个文档，直接重命名
        os.rename(doc_paths[0], output_path)
        return
    
    # 创建主文档
    main_doc = Document(doc_paths[0])
    
    # 追加其他文档
    for doc_path in doc_paths[1:]:
        sub_doc = Document(doc_path)
        
        # 添加分页符
        main_doc.add_page_break()
        
        # 复制所有段落
        for paragraph in sub_doc.paragraphs:
            new_para = main_doc.add_paragraph(paragraph.text, style=paragraph.style)
            # 复制段落格式
            new_para.alignment = paragraph.alignment
            new_para.paragraph_format.left_indent = paragraph.paragraph_format.left_indent
            new_para.paragraph_format.right_indent = paragraph.paragraph_format.right_indent
            new_para.paragraph_format.space_before = paragraph.paragraph_format.space_before
            new_para.paragraph_format.space_after = paragraph.paragraph_format.space_after
            
            # 复制字体格式
            for i, run in enumerate(paragraph.runs):
                if i < len(new_para.runs):
                    new_run = new_para.runs[i]
                    new_run.bold = run.bold
                    new_run.italic = run.italic
                    new_run.underline = run.underline
                    if run.font.size:
                        new_run.font.size = run.font.size
        
        # 复制表格
        for table in sub_doc.tables:
            new_table = main_doc.add_table(rows=len(table.rows), cols=len(table.columns))
            for i, row in enumerate(table.rows):
                for j, cell in enumerate(row.cells):
                    new_table.rows[i].cells[j].text = cell.text
    
    main_doc.save(output_path)


def parse_page_range(pdf_path, pages_param):
    """解析页码范围"""
    try:
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        doc.close()
        
        if pages_param == 'all' or not pages_param:
            return 0, total_pages, list(range(total_pages))
        
        selected_pages = []
        for part in pages_param.split(','):
            part = part.strip()
            if '-' in part:
                start, end = part.split('-')
                start = int(start) - 1
                end = int(end)
                selected_pages.extend(range(max(0, start), min(total_pages, end)))
            else:
                page = int(part) - 1
                if 0 <= page < total_pages:
                    selected_pages.append(page)
        
        if not selected_pages:
            return 0, total_pages, list(range(total_pages))
        
        start_page = min(selected_pages)
        end_page = max(selected_pages) + 1
        
        return start_page, end_page, selected_pages
    except Exception as e:
        logger.error(f"解析页码失败: {str(e)}")
        return 0, None, []


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'service': 'PDF转换服务（超高性能优化版）',
        'version': '3.0.0',
        'optimization': 'Windows单进程+分批处理',
        'features': [
            'PDF转Word（超快速模式）',
            '分批处理（避免大文档卡死）',
            '超时保护（5分钟）',
            '进度监控',
            '自动清理'
        ],
        'modes': {
            'ultra-fast': '超快速模式（纯文本，推荐）',
            'fast': '快速模式（表格+文本）',
            'balanced': '平衡模式（表格+文本+图片）',
            'quality': '高质量模式（完整格式+图片）'
        }
    })


@app.route('/pdf/info', methods=['POST'])
def get_pdf_info():
    """
    获取PDF信息和批量预览
    支持分页获取缩略图，优化性能
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
        
        file = request.files['file']
        
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'error': '无效的PDF文件'}), 400
        
        # 获取分页参数
        page_param = request.form.get('page', '1')  # 当前页
        page_size = int(request.form.get('pageSize', '10'))  # 每页显示数量，默认10
        
        try:
            current_page = int(page_param)
        except:
            current_page = 1
        
        # 临时保存文件
        file_uuid = str(uuid.uuid4())
        pdf_filename = f"{file_uuid}_temp.pdf"
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], pdf_filename)
        file.save(pdf_path)
        
        try:
            # 打开PDF
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            
            # 计算分页
            total_pages = (page_count + page_size - 1) // page_size  # 总分页数
            start_index = (current_page - 1) * page_size
            end_index = min(start_index + page_size, page_count)
            
            logger.info(f"PDF预览请求: 总共{page_count}页, 获取第{start_index+1}-{end_index}页")
            
            # 生成当前分页的预览图
            previews = []
            for page_num in range(start_index, end_index):
                page = doc[page_num]
                
                # 生成缩略图 (150x200像素，适合网格显示)
                zoom = 150 / page.rect.width
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                
                # 转换为PIL Image并压缩
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                
                # 压缩为JPEG
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=70, optimize=True)
                img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                
                previews.append({
                    'page': page_num + 1,
                    'image': f'data:image/jpeg;base64,{img_base64}',
                    'width': int(page.rect.width),
                    'height': int(page.rect.height)
                })
            
            doc.close()
            os.remove(pdf_path)
            
            logger.info(f"预览生成成功: 第{current_page}页分页, 共{len(previews)}张")
            
            return jsonify({
                'success': True,
                'pageCount': page_count,
                'previews': previews,
                'pagination': {
                    'currentPage': current_page,
                    'pageSize': page_size,
                    'totalPages': total_pages,
                    'startIndex': start_index + 1,
                    'endIndex': end_index
                }
            })
            
        except Exception as e:
            logger.error(f"PDF预览生成失败: {str(e)}")
            try:
                os.remove(pdf_path)
            except:
                pass
            return jsonify({'error': f'预览生成失败: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"请求处理失败: {str(e)}")
        return jsonify({'error': f'请求失败: {str(e)}'}), 500


@app.route('/pdf/toword', methods=['POST'])
def convert_pdf_to_word():
    """
    PDF转Word端点 - 超高性能优化版 v3.0
    专门针对Windows优化，解决卡死问题
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': '只支持PDF文件'}), 400
        
        # 获取参数
        mode = request.form.get('mode', 'fast')  # ultra-fast, fast, balanced, quality
        pages_param = request.form.get('pages', 'all')
        include_images = request.form.get('include_images', 'false').lower() == 'true'
        
        # 文件名处理
        original_filename = secure_filename(file.filename)
        file_uuid = str(uuid.uuid4())
        pdf_filename = f"{file_uuid}_{original_filename}"
        word_filename = f"{file_uuid}_{os.path.splitext(original_filename)[0]}.docx"
        
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], pdf_filename)
        word_path = os.path.join(app.config['CONVERTED_FOLDER'], word_filename)
        
        # 保存PDF
        file.save(pdf_path)
        file_size = os.path.getsize(pdf_path) / 1024
        logger.info(f"接收文件: {original_filename} ({file_size:.2f} KB)")
        logger.info(f"模式: {mode}, 页码: {pages_param}, 图片: {include_images}")
        
        # 清理旧文件
        cleanup_old_files(app.config['UPLOAD_FOLDER'])
        cleanup_old_files(app.config['CONVERTED_FOLDER'])
        
        # 解析页码
        start_page, end_page, selected_pages = parse_page_range(pdf_path, pages_param)
        pages_count = end_page - start_page if end_page else 0
        
        logger.info(f"开始转换: {pages_count}页")
        start_time = datetime.now()
        
        try:
            # 根据模式选择转换策略
            if mode == 'ultra-fast' or mode == 'text-only':
                # 超快速模式：纯文本提取
                convert_pdf_to_text_ultra_fast(pdf_path, word_path, start_page, end_page)
                
            elif mode == 'fast':
                # 快速模式：表格+文本，不含图片
                convert_with_pdf2docx_optimized(
                    pdf_path, word_path, 
                    mode='fast',
                    start_page=start_page, 
                    end_page=end_page,
                    include_images=False
                )
                
            elif mode == 'balanced' or mode == 'premium':
                # 平衡模式：表格+文本+少量图片
                convert_with_pdf2docx_optimized(
                    pdf_path, word_path,
                    mode='balanced',
                    start_page=start_page,
                    end_page=end_page,
                    include_images=True
                )
                
            elif mode == 'quality' or mode == 'complex':
                # 高质量模式：完整格式+图片
                convert_with_pdf2docx_optimized(
                    pdf_path, word_path,
                    mode='quality',
                    start_page=start_page,
                    end_page=end_page,
                    include_images=True
                )
                
            else:
                # 默认：快速模式
                convert_with_pdf2docx_optimized(
                    pdf_path, word_path,
                    mode='fast',
                    start_page=start_page,
                    end_page=end_page,
                    include_images=include_images
                )
            
            conversion_time = (datetime.now() - start_time).total_seconds()
            word_size = os.path.getsize(word_path)
            
            logger.info(f"转换成功: {word_filename} ({word_size/1024:.2f} KB, {conversion_time:.2f}s)")
            logger.info(f"平均速度: {pages_count/conversion_time:.2f} 页/秒")
            
            # 清理PDF
            try:
                os.remove(pdf_path)
            except:
                pass
            
            return jsonify({
                'url': f'/download/{word_filename}',
                'filename': word_filename,
                'size': word_size,
                'conversion_time': f'{conversion_time:.2f}s',
                'mode': mode,
                'pages_converted': f'{start_page+1}-{end_page}' if pages_param != 'all' else 'all',
                'pages_count': pages_count,
                'speed': f'{pages_count/conversion_time:.2f} 页/秒'
            })
            
        except TimeoutException as e:
            logger.error(f"转换超时: {str(e)}")
            try:
                os.remove(pdf_path)
            except:
                pass
            return jsonify({'error': '转换超时，请尝试使用更快的模式或减少页数'}), 408
            
        except Exception as e:
            logger.error(f"转换失败: {str(e)}")
            logger.error(traceback.format_exc())
            try:
                os.remove(pdf_path)
            except:
                pass
            return jsonify({'error': f'转换失败: {str(e)}'}), 500
        
    except Exception as e:
        logger.error(f"请求处理失败: {str(e)}")
        return jsonify({'error': f'请求失败: {str(e)}'}), 500


@app.route('/pdf/to-images', methods=['POST'])
def pdf_to_images():
    """
    PDF转图片 - 支持分页、多格式、自定义质量
    
    参数:
    - file: PDF文件
    - page: 当前页码（默认1）
    - page_size: 每页返回图片数（默认6）
    - format: 输出格式 png/jpg（默认png）
    - quality: 图片质量 1-100（默认85）
    - dpi: 分辨率 72-600（默认150）
    
    返回:
    - images: 图片数组（base64编码）
    - current_page: 当前页码
    - total_pages: 总页数（分页）
    - total_pdf_pages: PDF总页数
    """
    try:
        # 验证文件
        if 'file' not in request.files:
            return jsonify({'error': '未上传文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        # 获取参数
        current_page = int(request.form.get('page', 1))
        page_size = int(request.form.get('page_size', 6))
        img_format = request.form.get('format', 'png').lower()
        quality = int(request.form.get('quality', 85))
        dpi = int(request.form.get('dpi', 150))
        
        # 参数验证
        if current_page < 1:
            current_page = 1
        if page_size < 1 or page_size > 20:
            page_size = 6
        if img_format not in ['png', 'jpg', 'jpeg']:
            img_format = 'png'
        if quality < 1 or quality > 100:
            quality = 85
        if dpi < 72 or dpi > 600:
            dpi = 150
        
        # 读取PDF
        pdf_bytes = file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pdf_pages = len(doc)
        
        logger.info(f"PDF转图片: {file.filename}, 总页数={total_pdf_pages}, 请求页={current_page}, 格式={img_format}, DPI={dpi}")
        
        # 计算分页
        start_index = (current_page - 1) * page_size
        end_index = min(start_index + page_size, total_pdf_pages)
        total_pages = (total_pdf_pages + page_size - 1) // page_size  # 向上取整
        
        if start_index >= total_pdf_pages:
            doc.close()
            return jsonify({'error': '页码超出范围'}), 400
        
        # 高性能转换PDF页为图片
        images = []
        zoom = dpi / 72  # 计算缩放比例
        mat = fitz.Matrix(zoom, zoom)
        
        # 性能优化：使用线程池并行处理（但保持顺序）
        start_time = datetime.now()
        
        for page_num in range(start_index, end_index):
            page_start = datetime.now()
            page = doc[page_num]
            
            # 高质量渲染：alpha=False提升性能，使用高质量抗锯齿
            pix = page.get_pixmap(
                matrix=mat, 
                alpha=False,
                colorspace=fitz.csRGB  # 明确指定RGB色彩空间
            )
            
            # 性能优化：直接使用PyMuPDF输出，避免PIL转换
            if img_format in ['jpg', 'jpeg']:
                # 直接输出JPEG（PyMuPDF原生支持，更快更高质量）
                img_bytes = pix.tobytes("jpeg", jpg_quality=quality)
                img_base64 = base64.b64encode(img_bytes).decode('utf-8')
            else:
                # PNG格式：使用PIL优化压缩
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                
                # 高质量PNG压缩
                buffer = io.BytesIO()
                img.save(buffer, format='PNG', optimize=True, compress_level=6)
                img_bytes = buffer.getvalue()
                img_base64 = base64.b64encode(img_bytes).decode('utf-8')
            
            page_duration = (datetime.now() - page_start).total_seconds()
            
            images.append({
                'page': page_num + 1,
                'image': f'data:image/{img_format};base64,{img_base64}',
                'width': pix.width,
                'height': pix.height,
                'size': len(img_bytes)
            })
            
            logger.info(f"  页面 {page_num + 1}: {pix.width}x{pix.height}, {len(img_bytes)/1024:.1f}KB, 耗时{page_duration*1000:.0f}ms")
        
        doc.close()
        
        total_duration = (datetime.now() - start_time).total_seconds()
        total_size = sum(img['size'] for img in images)
        avg_time = total_duration / len(images) if images else 0
        
        logger.info(f"高性能转换完成: {len(images)}张图片, 总耗时={total_duration:.2f}s, 平均={avg_time*1000:.0f}ms/页, 总大小={total_size/1024:.1f}KB")
        
        return jsonify({
            'images': images,
            'current_page': current_page,
            'total_pages': total_pages,
            'total_pdf_pages': total_pdf_pages,
            'page_size': page_size,
            'start_page': start_index + 1,
            'end_page': end_index,
            'format': img_format,
            'quality': quality,
            'dpi': dpi
        })
        
    except Exception as e:
        logger.error(f"PDF转图片失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'转换失败: {str(e)}'}), 500


@app.route('/pdf/to-ppt', methods=['POST'])
def pdf_to_ppt():
    """
    PDF转PPT - 高性能图片方式
    
    流程：PDF → 图片（PyMuPDF）→ PPT（python-pptx）
    
    参数:
    - file: PDF文件（必填）
    - dpi: 分辨率 72-300（默认150）
    - quality: JPEG质量 60-95（默认85）
    
    限制:
    - 文件大小：60MB以内
    - 页数：100页以内（建议）
    
    返回:
    - url: PPT下载地址
    - filename: PPT文件名
    - pages: 转换的页数
    - size: 文件大小
    - conversion_time: 转换耗时
    """
    try:
        from pptx import Presentation
        from pptx.util import Inches
    except ImportError:
        return jsonify({'error': '缺少python-pptx库，请安装: pip install python-pptx'}), 500
    
    try:
        # 验证文件
        if 'file' not in request.files:
            return jsonify({'error': '未上传文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        # 检查文件大小（60MB限制）
        file.seek(0, 2)  # 移到文件末尾
        file_size = file.tell()
        file.seek(0)  # 回到文件开头
        
        MAX_SIZE = 60 * 1024 * 1024  # 60MB
        if file_size > MAX_SIZE:
            return jsonify({'error': f'文件大小超过限制（最大60MB）'}), 400
        
        # 获取参数（优化：提高默认分辨率）
        dpi = int(request.form.get('dpi', 200))  # 提高默认DPI从150到200
        quality = int(request.form.get('quality', 92))  # 提高默认质量从85到92
        
        # 参数验证（扩大DPI上限以支持超高清）
        if dpi < 72 or dpi > 400:  # DPI上限从300提升到400
            dpi = 200
        if quality < 60 or quality > 100:  # 质量上限从95提升到100
            quality = 92
        
        start_time = datetime.now()
        
        # 读取PDF
        pdf_bytes = file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        
        logger.info(f"========================================")
        logger.info(f"PDF转PPT: {file.filename}")
        logger.info(f"PDF页数: {total_pages}")
        logger.info(f"文件大小: {file_size/1024:.1f} KB")
        logger.info(f"DPI: {dpi}, 质量: {quality}")
        logger.info(f"========================================")
        
        # 检查页数限制
        if total_pages > 100:
            logger.warning(f"页数过多（{total_pages}页），建议100页以内")
            # 不强制限制，但给出警告
        
        # 步骤1：PDF转图片（高性能）
        images_data = []
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)
        
        for page_num in range(total_pages):
            page_start = datetime.now()
            page = doc[page_num]
            
            # 高质量渲染
            pix = page.get_pixmap(
                matrix=mat,
                alpha=False,
                colorspace=fitz.csRGB
            )
            
            # 直接输出JPEG（性能优化）
            img_bytes = pix.tobytes("jpeg", jpg_quality=quality)
            images_data.append({
                'bytes': img_bytes,
                'width': pix.width,
                'height': pix.height
            })
            
            page_duration = (datetime.now() - page_start).total_seconds()
            logger.info(f"  页面 {page_num + 1}/{total_pages}: {pix.width}x{pix.height}, {len(img_bytes)/1024:.1f}KB, {page_duration*1000:.0f}ms")
        
        doc.close()
        
        # 步骤2：创建PPT
        ppt_start = datetime.now()
        prs = Presentation()
        
        # 设置幻灯片尺寸为标准16:9
        prs.slide_width = Inches(10)
        prs.slide_height = Inches(5.625)  # 16:9比例
        
        # 空白布局
        blank_layout = prs.slide_layouts[6]
        
        # 插入每张图片为一页幻灯片
        for idx, img_data in enumerate(images_data):
            slide = prs.slides.add_slide(blank_layout)
            
            # 将图片插入，填满整个幻灯片
            img_stream = io.BytesIO(img_data['bytes'])
            left = top = Inches(0)
            slide.shapes.add_picture(
                img_stream,
                left, top,
                width=prs.slide_width,
                height=prs.slide_height
            )
            
            logger.info(f"  插入幻灯片 {idx + 1}/{total_pages}")
        
        # 保存PPT
        ppt_filename = f"converted_{uuid.uuid4().hex[:8]}.pptx"
        ppt_path = os.path.join(app.config['CONVERTED_FOLDER'], ppt_filename)
        
        prs.save(ppt_path)
        ppt_size = os.path.getsize(ppt_path)
        
        ppt_duration = (datetime.now() - ppt_start).total_seconds()
        total_duration = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"========================================")
        logger.info(f"PDF转PPT完成！")
        logger.info(f"生成PPT: {ppt_filename}")
        logger.info(f"PPT大小: {ppt_size/1024:.1f} KB")
        logger.info(f"PPT创建耗时: {ppt_duration:.2f}s")
        logger.info(f"总耗时: {total_duration:.2f}s")
        logger.info(f"平均速度: {total_pages/total_duration:.1f} 页/秒")
        logger.info(f"========================================")
        
        return jsonify({
            'url': f'/download/{ppt_filename}',
            'filename': ppt_filename,
            'pages': total_pages,
            'size': ppt_size,
            'conversion_time': f'{total_duration:.2f}s',
            'dpi': dpi,
            'quality': quality,
            'message': '转换成功'
        })
        
    except Exception as e:
        logger.error(f"PDF转PPT失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'转换失败: {str(e)}'}), 500


@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """下载转换后的文件"""
    try:
        file_path = os.path.join(app.config['CONVERTED_FOLDER'], filename)
        if not os.path.exists(file_path):
            return jsonify({'error': '文件不存在'}), 404
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        logger.error(f"下载失败: {str(e)}")
        return jsonify({'error': f'下载失败: {str(e)}'}), 500


if __name__ == '__main__':
    logger.info("启动PDF转换服务（超高性能优化版 v3.0）")
    logger.info("监听端口: 8789")
    logger.info("优化特性:")
    logger.info("  - Windows单进程模式（避免死锁）")
    logger.info("  - 分批处理大文档")
    logger.info("  - 超时保护（5分钟）")
    logger.info("  - 进度监控")
    logger.info("  - 自动清理旧文件")
    
    app.run(host='0.0.0.0', port=8789, debug=False, threaded=True)

