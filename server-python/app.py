"""
PDF转Word服务端 - 增强版
使用pdf2docx库实现高质量PDF转换
支持多种转换模式、页码选择、PDF预览等功能
"""
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from pdf2docx import Converter
import fitz  # PyMuPDF
import os
import uuid
import logging
import io
import base64
from werkzeug.utils import secure_filename
from datetime import datetime
from PIL import Image
import time
import traceback
import re
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置
UPLOAD_FOLDER = 'temp/uploads'
CONVERTED_FOLDER = 'temp/converted'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# 确保目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['CONVERTED_FOLDER'] = CONVERTED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE


def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def cleanup_old_files(folder, max_age_hours=24):
    """清理超过指定时间的临时文件"""
    try:
        now = datetime.now().timestamp()
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            if os.path.isfile(file_path):
                file_age = now - os.path.getmtime(file_path)
                if file_age > max_age_hours * 3600:
                    os.remove(file_path)
                    logger.info(f"已清理旧文件: {filename}")
    except Exception as e:
        logger.error(f"清理文件失败: {str(e)}")


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        'status': 'UP',
        'service': 'PDF to Word Converter (pdf2docx) - Enhanced + High Quality + Fast',
        'version': '2.2.0',
        'features': ['complex_format', 'images', 'page_selection', 'preview', 'premium_mode', 'fast_mode', 'multi_processing'],
        'modes': {
            'premium': '⭐高质量模式（表格+图片+样式，质量与速度平衡，推荐！）',
            'complex': '完整格式（表格+图片+样式，传统模式）',
            'fast': '快速模式（表格优化，速度优先）',
            'simple': '简化格式（表格+样式，无图片）',
            'text-only': '纯文本（仅文字）'
        },
        'recommended': 'premium'
    })


@app.route('/pdf/info', methods=['POST'])
def get_pdf_info():
    """
    获取PDF信息和预览图
    返回页数、每页缩略图等信息
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
        
        file = request.files['file']
        
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'error': '无效的PDF文件'}), 400
        
        # 临时保存文件
        file_uuid = str(uuid.uuid4())
        pdf_filename = f"{file_uuid}_temp.pdf"
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], pdf_filename)
        file.save(pdf_path)
        
        try:
            # 打开PDF获取信息
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            
            # 生成每页的缩略图（base64编码）
            previews = []
            for page_num in range(min(page_count, 20)):  # 最多返回前20页预览
                page = doc[page_num]
                
                # 生成缩略图 (150x200 像素)
                zoom = 150 / page.rect.width
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                
                # 转换为PIL Image并压缩
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                
                # 进一步压缩
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
            
            # 删除临时文件
            os.remove(pdf_path)
            
            logger.info(f"PDF信息获取成功: {page_count}页")
            
            return jsonify({
                'success': True,
                'pageCount': page_count,
                'previews': previews,
                'filename': file.filename
            })
            
        except Exception as e:
            logger.error(f"PDF信息获取失败: {str(e)}")
            try:
                os.remove(pdf_path)
            except:
                pass
            return jsonify({'error': f'PDF处理失败: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"请求处理失败: {str(e)}")
        return jsonify({'error': f'请求失败: {str(e)}'}), 500


@app.route('/pdf/preview', methods=['POST'])
def get_pdf_preview_single_page():
    """
    获取PDF单页预览（按需加载，性能优化）
    只返回指定页的预览图
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
        
        file = request.files['file']
        page_num = request.form.get('page', '1')
        
        try:
            page_num = int(page_num)
        except:
            return jsonify({'error': '页码格式错误'}), 400
        
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'error': '无效的PDF文件'}), 400
        
        # 临时保存文件
        file_uuid = str(uuid.uuid4())
        pdf_filename = f"{file_uuid}_temp.pdf"
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], pdf_filename)
        file.save(pdf_path)
        
        try:
            # 打开PDF
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            
            # 检查页码有效性
            if page_num < 1 or page_num > page_count:
                doc.close()
                os.remove(pdf_path)
                return jsonify({'error': f'页码超出范围 (1-{page_count})'}), 400
            
            # 生成指定页的预览
            page = doc[page_num - 1]  # 索引从0开始
            
            # 生成较大的预览图 (200x280像素)
            zoom = 200 / page.rect.width
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            # 转换为PIL Image并压缩
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            
            # 压缩为JPEG
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=75, optimize=True)
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            preview = {
                'page': page_num,
                'image': f'data:image/jpeg;base64,{img_base64}',
                'width': int(page.rect.width),
                'height': int(page.rect.height)
            }
            
            doc.close()
            os.remove(pdf_path)
            
            logger.info(f"单页预览生成成功: 第{page_num}页")
            
            return jsonify({
                'success': True,
                'preview': preview,
                'pageCount': page_count
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
    PDF转Word端点 - 增强版（性能优化 v2.1）
    支持多种转换模式和页码选择，针对表格文档进行性能优化
    
    参数:
        file: PDF文件 (multipart/form-data)
        mode: 转换模式 (premium/complex/fast/simple/text-only)
            - premium: 高质量模式（表格+图片，质量优先，推荐！）⭐
            - complex: 完整格式（保留表格、图片、格式）
            - fast: 快速模式（表格优化，速度优先）
            - simple: 简化格式（基本格式，不含图片）
            - text-only: 纯文本模式（仅提取文字）
        pages: 页码范围 (可选)
            - "all": 全部页（默认）
            - "1,3,5": 指定页码
            - "1-5": 页码范围
            - "1-3,5,7-9": 混合格式
        include_images: 是否包含图片 (true/false)
        
    返回:
        {url, filename, size, conversion_time, mode, pages_converted}
    """
    try:
        # 检查是否有文件
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': '只支持PDF文件'}), 400
        
        # 获取转换参数
        mode = request.form.get('mode', 'complex')  # complex, simple, text-only
        pages_param = request.form.get('pages', 'all')
        include_images = request.form.get('include_images', 'true').lower() == 'true'
        
        # 生成唯一文件名
        original_filename = secure_filename(file.filename)
        file_uuid = str(uuid.uuid4())
        pdf_filename = f"{file_uuid}_{original_filename}"
        word_filename = f"{file_uuid}_{os.path.splitext(original_filename)[0]}.docx"
        
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], pdf_filename)
        word_path = os.path.join(app.config['CONVERTED_FOLDER'], word_filename)
        
        # 保存上传的PDF文件
        file.save(pdf_path)
        file_size = os.path.getsize(pdf_path) / 1024
        logger.info(f"接收到PDF文件: {original_filename} ({file_size:.2f} KB)")
        logger.info(f"转换模式: {mode}, 页码: {pages_param}, 包含图片: {include_images}")
        
        # 清理旧文件
        cleanup_old_files(app.config['UPLOAD_FOLDER'])
        cleanup_old_files(app.config['CONVERTED_FOLDER'])
        
        # 解析页码范围
        start_page, end_page, selected_pages = parse_page_range(pdf_path, pages_param)
        
        # 开始转换
        logger.info(f"开始转换: {original_filename} -> {word_filename}")
        start_time = datetime.now()
        
        try:
            # 根据模式选择转换方式
            if mode == 'text-only':
                # 纯文本模式：使用PyMuPDF直接提取文本
                convert_pdf_to_text(pdf_path, word_path, start_page, end_page)
                
            elif mode == 'premium':
                # 高质量模式：平衡质量和速度，适合大多数文档
                logger.info("使用高质量模式（Premium）- 推荐模式")
                cv = Converter(pdf_path)
                cv.convert(
                    word_path, 
                    start=start_page, 
                    end=end_page, 
                    image=True,  # 包含图片（高质量）
                    multi_processing=True,  # 启用多进程
                    cpu_count=3,  # 使用3个CPU核心（性能优化）
                )
                cv.close()
                logger.info("高质量模式转换完成")
                
            elif mode == 'fast':
                # 快速模式：专为表格密集型文档优化（速度优先）
                logger.info("使用快速模式（Fast）- 表格优化")
                cv = Converter(pdf_path)
                cv.convert(
                    word_path, 
                    start=start_page, 
                    end=end_page, 
                    image=False,  # 快速模式不包含图片以提升速度
                    multi_processing=True,  # 启用多进程
                    cpu_count=3,  # 使用3个CPU核心（更激进的并行）
                )
                cv.close()
                logger.info("快速模式转换完成")
                
            elif mode == 'simple':
                # 简化模式：不包含图片，启用性能优化
                cv = Converter(pdf_path)
                cv.convert(
                    word_path, 
                    start=start_page, 
                    end=end_page, 
                    image=False,  # 不包含图片
                    multi_processing=True,  # 启用多进程加速
                    cpu_count=2  # 使用2个CPU核心
                )
                cv.close()
                
            else:  # complex mode (default)
                # 复杂模式：完整转换，启用性能优化
                cv = Converter(pdf_path)
                cv.convert(
                    word_path, 
                    start=start_page, 
                    end=end_page,
                    image=include_images,  # 根据参数决定是否包含图片
                    multi_processing=True,  # 启用多进程加速
                    cpu_count=2  # 使用2个CPU核心（平衡速度和资源）
                )
                cv.close()
            
            conversion_time = (datetime.now() - start_time).total_seconds()
            word_size = os.path.getsize(word_path)
            
            pages_converted = f"{start_page + 1}-{end_page if end_page else 'end'}" if pages_param != 'all' else 'all'
            
            logger.info(f"转换成功: {word_filename} ({word_size / 1024:.2f} KB, 耗时 {conversion_time:.2f}s)")
            
            # 删除临时PDF文件
            try:
                os.remove(pdf_path)
            except:
                pass
            
            # 返回下载链接
            return jsonify({
                'url': f'/download/{word_filename}',
                'filename': word_filename,
                'size': word_size,
                'conversion_time': f'{conversion_time:.2f}s',
                'mode': mode,
                'pages_converted': pages_converted,
                'include_images': include_images
            })
            
        except Exception as e:
            logger.error(f"转换失败: {str(e)}")
            # 清理文件
            try:
                os.remove(pdf_path)
            except:
                pass
            return jsonify({'error': f'转换失败: {str(e)}'}), 500
        
    except Exception as e:
        logger.error(f"处理请求失败: {str(e)}")
        return jsonify({'error': f'处理请求失败: {str(e)}'}), 500


def parse_page_range(pdf_path, pages_param):
    """
    解析页码参数
    返回 (start_page, end_page, selected_pages)
    """
    try:
        # 获取PDF总页数
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        doc.close()
        
        if pages_param == 'all' or not pages_param:
            return 0, None, list(range(total_pages))
        
        # 解析页码范围
        # 支持格式: "1,3,5" 或 "1-5" 或 "1-3,5,7-9"
        selected_pages = []
        for part in pages_param.split(','):
            part = part.strip()
            if '-' in part:
                # 范围
                start, end = part.split('-')
                start = int(start) - 1  # 转换为0-based索引
                end = int(end)
                selected_pages.extend(range(max(0, start), min(total_pages, end)))
            else:
                # 单个页码
                page = int(part) - 1  # 转换为0-based索引
                if 0 <= page < total_pages:
                    selected_pages.append(page)
        
        if not selected_pages:
            return 0, None, list(range(total_pages))
        
        # pdf2docx使用start和end参数（end可以为None表示到末尾）
        start_page = min(selected_pages)
        end_page = max(selected_pages) + 1 if selected_pages else None
        
        return start_page, end_page, selected_pages
        
    except Exception as e:
        logger.error(f"页码解析失败: {str(e)}")
        return 0, None, []


def convert_pdf_to_text(pdf_path, output_path, start_page=0, end_page=None):
    """
    纯文本模式转换：提取PDF文本并保存为Word文档
    优化版：每页PDF内容保留在Word的同一页中
    """
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    
    doc_word = Document()
    
    # 设置页面边距（减小边距以容纳更多内容）
    sections = doc_word.sections
    for section in sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)
    
    pdf_doc = fitz.open(pdf_path)
    
    total_pages = len(pdf_doc)
    end_page = end_page if end_page else total_pages
    
    for page_num in range(start_page, min(end_page, total_pages)):
        page = pdf_doc[page_num]
        text = page.get_text("text")
        
        # 添加页码标题（紧凑样式）
        heading = doc_word.add_heading(f'━━━ 第 {page_num + 1} 页 ━━━', level=2)
        heading.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
        # 设置标题字体大小和间距
        heading_format = heading.paragraph_format
        heading_format.space_before = Pt(0)
        heading_format.space_after = Pt(6)
        for run in heading.runs:
            run.font.size = Pt(11)
            run.font.color.rgb = RGBColor(46, 125, 50)  # 绿色
        
        # 添加文本内容
        if text.strip():
            para = doc_word.add_paragraph(text)
            para_format = para.paragraph_format
            para_format.line_spacing = 1.15  # 紧凑行距
            para_format.space_before = Pt(0)
            para_format.space_after = Pt(0)
            # 设置字体大小
            for run in para.runs:
                run.font.size = Pt(10)
        else:
            para = doc_word.add_paragraph('[此页无文本内容]')
            para_format = para.paragraph_format
            para_format.space_before = Pt(0)
            para_format.space_after = Pt(0)
            for run in para.runs:
                run.font.size = Pt(10)
                run.font.color.rgb = RGBColor(150, 150, 150)
        
        # 在每页内容后添加分页符（除了最后一页）
        if page_num < min(end_page, total_pages) - 1:
            doc_word.add_page_break()
    
    pdf_doc.close()
    doc_word.save(output_path)
    logger.info(f"纯文本转换完成: {end_page - start_page}页，每页PDF内容独立成页")


@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """
    下载转换后的文件（支持Word和PDF）
    """
    try:
        file_path = os.path.join(app.config['CONVERTED_FOLDER'], secure_filename(filename))
        
        if not os.path.exists(file_path):
            return jsonify({'error': '文件不存在'}), 404
        
        logger.info(f"下载文件: {filename}")
        
        # 根据文件扩展名设置MIME类型
        file_ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
        mimetype_map = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc': 'application/msword',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp'
        }
        mimetype = mimetype_map.get(file_ext, 'application/octet-stream')
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype=mimetype
        )
    except Exception as e:
        logger.error(f"下载文件失败: {str(e)}")
        return jsonify({'error': f'下载失败: {str(e)}'}), 500


@app.route('/pdf/compress', methods=['POST'])
def compress_pdf():
    """
    PDF压缩接口
    支持三种压缩级别：low(20%), medium(50%), high(80%)
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': '未找到文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '未选择文件'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': '只支持PDF文件'}), 400
        
        # 获取压缩级别
        compression_level = request.form.get('compression_level', 'medium').lower()
        if compression_level not in ['low', 'medium', 'high']:
            compression_level = 'medium'
        
        # 压缩级别配置
        compression_configs = {
            'low': {
                'image_quality': 90,      # 图片质量90%
                'image_dpi': 200,         # 图片DPI 200
                'garbage': 2,             # 轻度清理
                'deflate': True,          # 启用压缩
                'clean': True             # 清理交叉引用
            },
            'medium': {
                'image_quality': 75,      # 图片质量75%
                'image_dpi': 150,         # 图片DPI 150
                'garbage': 3,             # 中度清理
                'deflate': True,
                'clean': True
            },
            'high': {
                'image_quality': 60,      # 图片质量60%
                'image_dpi': 100,         # 图片DPI 100
                'garbage': 4,             # 深度清理
                'deflate': True,
                'clean': True
            }
        }
        
        config = compression_configs[compression_level]
        
        # 保存上传的文件
        filename = secure_filename(file.filename)
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4().hex[:8]}_{filename}")
        file.save(temp_path)
        
        start_time = time.time()
        original_size = os.path.getsize(temp_path)
        
        logger.info(f"开始压缩PDF: {filename}, 原始大小: {original_size / 1024:.1f}KB, 压缩级别: {compression_level}")
        
        # 打开PDF
        doc = fitz.open(temp_path)
        total_pages = len(doc)
        
        # 压缩图片：遍历所有图片并压缩
        image_count = 0
        total_images = 0
        
        for page_num in range(total_pages):
            page = doc[page_num]
            image_list = page.get_images()
            total_images += len(image_list)
            
            for img_index, img in enumerate(image_list):
                try:
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    # 只处理JPEG和PNG图片
                    if image_ext.lower() not in ['jpeg', 'jpg', 'png']:
                        continue
                    
                    # 使用PIL压缩图片
                    img_pil = Image.open(io.BytesIO(image_bytes))
                    img_original_size = len(image_bytes)
                    
                    # 如果是PNG，转换为JPEG以减小文件大小
                    convert_to_jpeg = False
                    if image_ext.lower() == 'png':
                        if img_pil.mode in ['RGBA', 'LA']:
                            # 创建白色背景
                            background = Image.new('RGB', img_pil.size, (255, 255, 255))
                            if img_pil.mode == 'RGBA':
                                background.paste(img_pil, mask=img_pil.split()[3])
                            else:
                                background.paste(img_pil)
                            img_pil = background
                            convert_to_jpeg = True
                        elif compression_level == 'high':
                            # 高压缩级别时，所有PNG都转JPEG
                            convert_to_jpeg = True
                    
                    # 计算目标尺寸（基于DPI）
                    scale_factor = config['image_dpi'] / 72.0
                    if scale_factor < 1.0:
                        new_width = int(img_pil.width * scale_factor)
                        new_height = int(img_pil.height * scale_factor)
                        if new_width > 0 and new_height > 0:
                            img_pil = img_pil.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    
                    # 压缩图片
                    img_buffer = io.BytesIO()
                    if convert_to_jpeg or image_ext.lower() in ['jpeg', 'jpg']:
                        img_pil.save(img_buffer, format='JPEG', quality=config['image_quality'], optimize=True)
                    else:
                        # PNG优化
                        img_pil.save(img_buffer, format='PNG', optimize=True)
                    
                    compressed_bytes = img_buffer.getvalue()
                    compressed_size = len(compressed_bytes)
                    
                    # 如果压缩后更小，则替换原图片
                    if compressed_size < img_original_size * 0.95:  # 至少减少5%才替换
                        # 获取图片位置信息
                        img_rects = page.get_image_rects(xref)
                        if img_rects:
                            img_rect = img_rects[0]
                            
                            # 删除原图片
                            try:
                                page.delete_image(xref)
                            except:
                                pass
                            
                            # 插入压缩后的图片
                            page.insert_image(img_rect, stream=compressed_bytes)
                            image_count += 1
                            
                except Exception as e:
                    logger.warning(f"压缩页面 {page_num + 1} 的图片 {img_index} 失败: {str(e)}")
                    continue
        
        # 生成输出文件名
        output_filename = f"compressed_{compression_level}_{uuid.uuid4().hex[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        output_path = os.path.join(app.config['CONVERTED_FOLDER'], output_filename)
        
        # 保存压缩后的PDF
        doc.save(output_path,
                 garbage=config['garbage'],
                 deflate=config['deflate'],
                 clean=config['clean'])  # 新版本PyMuPDF不再支持linear参数
        
        doc.close()
        
        # 删除临时文件
        try:
            os.remove(temp_path)
        except:
            pass
        
        # 计算压缩结果
        compressed_size = os.path.getsize(output_path)
        compression_ratio = (1 - compressed_size / original_size) * 100
        elapsed_time = time.time() - start_time
        
        logger.info(f"PDF压缩完成: {output_filename}, 原始: {original_size / 1024:.1f}KB, "
                   f"压缩后: {compressed_size / 1024:.1f}KB, 压缩率: {compression_ratio:.1f}%, "
                   f"处理图片: {image_count}, 耗时: {elapsed_time:.2f}秒")
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'url': f'/download/{output_filename}',
            'original_size': original_size,
            'compressed_size': compressed_size,
            'compression_ratio': round(compression_ratio, 1),
            'compression_level': compression_level,
            'image_count': image_count,
            'total_pages': total_pages,
            'elapsed_time': round(elapsed_time, 2)
        })
        
    except Exception as e:
        logger.error(f"PDF压缩失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'压缩失败: {str(e)}'}), 500


@app.route('/pdf/arrange/upload', methods=['POST'])
def arrange_upload_pdf():
    """
    上传PDF文件用于编排（支持多文件）
    返回文件ID和页面信息
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': '未找到文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '未选择文件'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': '只支持PDF文件'}), 400
        
        # 保存文件
        filename = secure_filename(file.filename)
        file_id = uuid.uuid4().hex[:8]
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"arrange_{file_id}_{filename}")
        file.save(temp_path)
        
        # 打开PDF获取页面信息
        doc = fitz.open(temp_path)
        total_pages = len(doc)
        doc.close()
        
        file_size = os.path.getsize(temp_path)
        
        logger.info(f"上传PDF用于编排: {filename}, 文件ID: {file_id}, 页数: {total_pages}")
        
        return jsonify({
            'success': True,
            'file_id': file_id,
            'filename': filename,
            'file_size': file_size,
            'total_pages': total_pages
        })
        
    except Exception as e:
        logger.error(f"上传PDF失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'上传失败: {str(e)}'}), 500


@app.route('/pdf/arrange/thumbnail', methods=['POST'])
def arrange_get_thumbnail():
    """
    获取PDF指定页面的缩略图
    参数: file_id, page_number
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '缺少必要参数'}), 400
        
        file_id = data.get('file_id')
        page_number = data.get('page_number')
        
        if not file_id or not page_number:
            return jsonify({'error': '缺少file_id或page_number'}), 400
        
        # 查找对应的PDF文件
        upload_folder = app.config['UPLOAD_FOLDER']
        pdf_files = [f for f in os.listdir(upload_folder) if f.startswith(f'arrange_{file_id}_')]
        
        if not pdf_files:
            return jsonify({'error': '未找到对应的PDF文件'}), 404
        
        pdf_path = os.path.join(upload_folder, pdf_files[0])
        doc = fitz.open(pdf_path)
        
        # 验证页码
        if page_number < 1 or page_number > len(doc):
            doc.close()
            return jsonify({'error': '页码超出范围'}), 400
        
        # 生成缩略图
        page = doc[page_number - 1]
        mat = fitz.Matrix(150 / page.rect.width, 150 / page.rect.height)
        pix = page.get_pixmap(matrix=mat)
        img_data = pix.tobytes("png")
        img_base64 = base64.b64encode(img_data).decode('utf-8')
        
        doc.close()
        
        return jsonify({
            'success': True,
            'thumbnail': f'data:image/png;base64,{img_base64}'
        })
        
    except Exception as e:
        logger.error(f"获取缩略图失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'获取缩略图失败: {str(e)}'}), 500


@app.route('/file/get-pages', methods=['POST'])
def get_file_pages():
    """
    获取文件的页数（支持PDF/Word/Excel/PPT）
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': '未找到文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '未选择文件'}), 400
        
        filename = secure_filename(file.filename)
        file_ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
        
        if file_ext not in ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']:
            return jsonify({'error': '不支持的文件格式'}), 400
        
        # 保存临时文件
        file_id = uuid.uuid4().hex[:8]
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"pages_{file_id}_{filename}")
        file.save(temp_path)
        
        total_pages = 0
        
        if file_ext == 'pdf':
            # PDF文件
            doc = fitz.open(temp_path)
            total_pages = len(doc)
            doc.close()
        else:
            # Office文件，需要先转PDF才能获取页数
            error_msg = None
            try:
                if not HAS_REQUESTS:
                    error_msg = '需要安装requests库才能获取Office文件页数: pip install requests'
                else:
                    java_url = 'http://localhost:8788'
                    
                    if file_ext in ['doc', 'docx']:
                        convert_url = f'{java_url}/word/topdf'
                    elif file_ext in ['xls', 'xlsx']:
                        convert_url = f'{java_url}/excel/topdf'
                    elif file_ext in ['ppt', 'pptx']:
                        convert_url = f'{java_url}/ppt/topdf'
                    else:
                        convert_url = None
                    
                    if convert_url:
                        # 检查Java服务是否可用
                        try:
                            health_check = requests.get(f'{java_url}/health', timeout=5)
                            if health_check.status_code != 200:
                                error_msg = 'Java服务(8788端口)不可用，请确保服务正在运行'
                        except requests.exceptions.RequestException:
                            error_msg = '无法连接到Java服务(8788端口)，请确保服务正在运行'
                        
                        if not error_msg:
                            with open(temp_path, 'rb') as f:
                                files = {'file': (filename, f, f'application/{file_ext}')}
                                response = requests.post(convert_url, files=files, timeout=120)
                            
                            if response.status_code == 200:
                                result = response.json()
                                if 'url' in result:
                                    # 下载PDF获取页数
                                    pdf_download_url = f"{java_url}{result['url']}"
                                    pdf_response = requests.get(pdf_download_url, timeout=60)
                                    if pdf_response.status_code == 200:
                                        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"pages_{file_id}_temp.pdf")
                                        with open(pdf_path, 'wb') as pf:
                                            pf.write(pdf_response.content)
                                        doc = fitz.open(pdf_path)
                                        total_pages = len(doc)
                                        doc.close()
                                        try:
                                            os.remove(pdf_path)
                                        except:
                                            pass
                                    else:
                                        error_msg = f'下载转换后的PDF失败: {pdf_response.status_code}'
                                else:
                                    error_msg = result.get('error', '转换响应格式错误')
                            else:
                                try:
                                    error_data = response.json()
                                    error_msg = error_data.get('error', f'Java服务转换失败: {response.status_code}')
                                except:
                                    error_msg = f'Java服务转换失败: {response.status_code}'
                    else:
                        error_msg = '不支持的文件格式转换'
            except requests.exceptions.Timeout:
                error_msg = '请求超时，请检查Java服务(8788端口)是否正常运行'
            except requests.exceptions.ConnectionError:
                error_msg = '无法连接到Java服务(8788端口)，请确保服务正在运行'
            except Exception as e:
                logger.error(f"获取Office文件页数失败: {str(e)}")
                logger.error(traceback.format_exc())
                error_msg = f'获取页数失败: {str(e)}'
            
            if error_msg:
                # 删除临时文件
                try:
                    os.remove(temp_path)
                except:
                    pass
                return jsonify({
                    'success': False,
                    'error': error_msg,
                    'total_pages': 0,
                    'file_type': file_ext
                }), 500
        
        # 删除临时文件
        try:
            os.remove(temp_path)
        except:
            pass
        
        return jsonify({
            'success': True,
            'total_pages': total_pages,
            'file_type': file_ext
        })
        
    except Exception as e:
        logger.error(f"获取文件页数失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'获取页数失败: {str(e)}'}), 500


@app.route('/file/to-long-image', methods=['POST'])
def convert_to_long_image():
    """
    文件转长图（支持PDF/Word/Excel/PPT）
    1. PDF文件：直接用PyMuPDF转换
    2. Word/Excel/PPT：先转PDF，再转长图
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': '未找到文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '未选择文件'}), 400
        
        filename = secure_filename(file.filename)
        file_ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
        
        # 检查文件类型
        if file_ext not in ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']:
            return jsonify({'error': '不支持的文件格式，仅支持PDF/Word/Excel/PPT'}), 400
        
        # 获取参数
        pages_param = request.form.get('pages', 'all')  # 页码范围
        output_format = request.form.get('format', 'jpg').lower()  # pdf/jpg/png
        dpi = int(request.form.get('dpi', 120))  # 图片DPI，降低默认值提升速度
        
        if output_format not in ['pdf', 'jpg', 'png']:
            output_format = 'jpg'
        
        # 优化DPI范围，降低上限提升速度
        if dpi < 72 or dpi > 200:
            dpi = 120
        
        start_time = time.time()
        
        # 保存上传的文件
        file_id = uuid.uuid4().hex[:8]
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"longimg_{file_id}_{filename}")
        file.save(temp_path)
        
        # 如果是Word/Excel/PPT，先转PDF
        pdf_path = temp_path
        if file_ext in ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']:
            logger.info(f"Office文件转PDF: {filename}")
            # 调用Java服务转PDF（如果可用）
            # 或者使用Python库转PDF
            # 这里先尝试调用Java服务
            try:
                import requests
                java_url = 'http://localhost:8788'
                
                # 根据文件类型选择接口
                if file_ext in ['doc', 'docx']:
                    convert_url = f'{java_url}/word/topdf'
                elif file_ext in ['xls', 'xlsx']:
                    convert_url = f'{java_url}/excel/topdf'
                elif file_ext in ['ppt', 'pptx']:
                    convert_url = f'{java_url}/ppt/topdf'
                else:
                    convert_url = None
                
                if convert_url and HAS_REQUESTS:
                    with open(temp_path, 'rb') as f:
                        files = {'file': (filename, f, f'application/{file_ext}')}
                        response = requests.post(convert_url, files=files, timeout=120)
                    
                    if response.status_code == 200:
                        result = response.json()
                        if 'url' in result:
                            # 下载PDF文件
                            pdf_download_url = f"{java_url}{result['url']}"
                            pdf_response = requests.get(pdf_download_url, timeout=60)
                            if pdf_response.status_code == 200:
                                pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"longimg_{file_id}_converted.pdf")
                                with open(pdf_path, 'wb') as pf:
                                    pf.write(pdf_response.content)
                                logger.info(f"Office文件转PDF成功: {filename}")
                            else:
                                raise Exception("下载转换后的PDF失败")
                        else:
                            raise Exception("转换响应格式错误")
                    else:
                        raise Exception(f"Java服务转换失败: {response.status_code}")
                else:
                    return jsonify({'error': '不支持的文件格式转换'}), 400
                    
            except Exception as e:
                logger.warning(f"调用Java服务失败: {str(e)}")
                if not HAS_REQUESTS:
                    return jsonify({'error': '需要安装requests库才能转换Office文件: pip install requests'}), 500
                return jsonify({'error': f'Office文件转PDF失败，请确保Java服务(8788端口)正在运行: {str(e)}'}), 500
        
        # 打开PDF
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        
        # 解析页码范围
        pages_to_convert = []
        if pages_param.lower() == 'all' or pages_param.strip() == '':
            pages_to_convert = list(range(total_pages))
        else:
            # 解析页码：支持 "1,3,5" 或 "1-5" 或 "1-3,5,7-9"
            parts = re.split(r'[,，]', pages_param)
            for part in parts:
                part = part.strip()
                if '-' in part:
                    # 范围
                    start, end = part.split('-', 1)
                    start = int(start.strip())
                    end = int(end.strip())
                    for p in range(start - 1, min(end, total_pages)):
                        if p >= 0 and p not in pages_to_convert:
                            pages_to_convert.append(p)
                else:
                    # 单页
                    p = int(part.strip()) - 1
                    if 0 <= p < total_pages and p not in pages_to_convert:
                        pages_to_convert.append(p)
        
        pages_to_convert.sort()
        
        # 检查页面数量限制
        if len(pages_to_convert) > 50:
            doc.close()
            return jsonify({'error': '最多支持50页，建议20页以内'}), 400
        
        if len(pages_to_convert) == 0:
            doc.close()
            return jsonify({'error': '未选择有效页面'}), 400
        
        logger.info(f"开始转换长图: {filename}, 页数: {len(pages_to_convert)}, 格式: {output_format}, DPI: {dpi}")
        
        # 转换页面为图片（优化版）
        images = []
        gap = 0  # 页面间距（像素）
        
        # 预先计算缩放矩阵
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        
        for page_idx in pages_to_convert:
            page = doc[page_idx]
            # 使用优化的pixmap参数
            pix = page.get_pixmap(matrix=mat, alpha=False)  # alpha=False提升速度
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(img)
            # 释放pixmap内存
            pix = None
        
        doc.close()
        
        # 计算长图尺寸
        max_width = max(img.width for img in images)
        total_height = sum(img.height for img in images) + gap * (len(images) - 1)
        
        # 创建长图
        long_img = Image.new('RGB', (max_width, total_height), (255, 255, 255))
        y_offset = 0
        for img in images:
            # 居中放置
            x_offset = (max_width - img.width) // 2
            long_img.paste(img, (x_offset, y_offset))
            y_offset += img.height + gap
        
        # 生成输出文件名
        output_filename = f"longimage_{file_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{output_format}"
        output_path = os.path.join(app.config['CONVERTED_FOLDER'], output_filename)
        
        # 保存长图（优化版）
        if output_format == 'pdf':
            # 将图片保存为PDF（使用PyMuPDF）
            pdf_doc = fitz.open()
            # 创建页面（尺寸转换为点，PyMuPDF使用点为单位）
            page = pdf_doc.new_page(width=max_width, height=total_height)
            # 将PIL图片转换为bytes（使用JPEG格式更快）
            img_bytes = io.BytesIO()
            long_img.save(img_bytes, format='JPEG', quality=85)
            img_bytes.seek(0)
            # 插入图片到PDF
            page.insert_image(fitz.Rect(0, 0, max_width, total_height), stream=img_bytes.getvalue())
            # 移除clean参数提升保存速度
            pdf_doc.save(output_path, garbage=4, deflate=True)
            pdf_doc.close()
        elif output_format == 'jpg':
            # 降低质量提升速度，85质量已足够
            long_img.save(output_path, format='JPEG', quality=85, optimize=True)
        else:  # png
            # PNG使用压缩级别控制
            long_img.save(output_path, format='PNG', compress_level=6, optimize=False)
        
        # 删除临时文件
        try:
            if pdf_path != temp_path:
                os.remove(pdf_path)
            os.remove(temp_path)
        except:
            pass
        
        output_size = os.path.getsize(output_path)
        elapsed_time = time.time() - start_time
        
        logger.info(f"长图转换完成: {output_filename}, 页数: {len(pages_to_convert)}, 尺寸: {max_width}x{total_height}, "
                   f"格式: {output_format}, 大小: {output_size / 1024:.1f}KB, 耗时: {elapsed_time:.2f}秒")
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'url': f'/download/{output_filename}',
            'format': output_format,
            'width': max_width,
            'height': total_height,
            'file_size': output_size,
            'pages_count': len(pages_to_convert),
            'elapsed_time': round(elapsed_time, 2)
        })
        
    except Exception as e:
        logger.error(f"转长图失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'转换失败: {str(e)}'}), 500


@app.route('/pdf/arrange/generate', methods=['POST'])
def arrange_generate_pdf():
    """
    根据用户选择的页面顺序生成编排后的PDF
    参数: files (JSON数组，每个元素包含file_id和pages数组)
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '缺少必要参数'}), 400
        
        # 接收页面顺序数组：[{file_id: 'xxx', page_number: 1}, ...]
        pages_order = data.get('pages_order', [])
        
        # 兼容旧格式：files数组
        if not pages_order and 'files' in data:
            files_config = data['files']
            # 转换为pages_order格式
            pages_order = []
            for file_config in files_config:
                file_id = file_config.get('file_id')
                pages = file_config.get('pages', [])
                for page_num in pages:
                    pages_order.append({
                        'file_id': file_id,
                        'page_number': page_num
                    })
        
        if not pages_order or len(pages_order) == 0:
            return jsonify({'error': '未选择任何页面'}), 400
        
        start_time = time.time()
        
        # 创建新的PDF文档
        output_doc = fitz.open()
        
        total_pages_added = 0
        
        # 按用户选择的顺序添加页面
        file_cache = {}  # 缓存已打开的文档
        
        for page_info in pages_order:
            file_id = page_info.get('file_id')
            page_number = page_info.get('page_number')
            
            if not file_id or not page_number:
                continue
            
            # 从缓存获取或打开PDF文件
            if file_id not in file_cache:
                upload_folder = app.config['UPLOAD_FOLDER']
                pdf_files = [f for f in os.listdir(upload_folder) if f.startswith(f'arrange_{file_id}_')]
                
                if not pdf_files:
                    logger.warning(f"未找到文件ID对应的PDF: {file_id}")
                    continue
                
                pdf_path = os.path.join(upload_folder, pdf_files[0])
                file_cache[file_id] = fitz.open(pdf_path)
            
            source_doc = file_cache[file_id]
            
            # 添加指定页面
            if 1 <= page_number <= len(source_doc):
                page_idx = page_number - 1
                # 复制页面到新文档
                output_doc.insert_pdf(source_doc, from_page=page_idx, to_page=page_idx)
                total_pages_added += 1
        
        # 关闭所有打开的文档
        for doc in file_cache.values():
            doc.close()
        
        if total_pages_added == 0:
            output_doc.close()
            return jsonify({'error': '未添加任何页面'}), 400
        
        # 生成输出文件名
        output_filename = f"arranged_{uuid.uuid4().hex[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        output_path = os.path.join(app.config['CONVERTED_FOLDER'], output_filename)
        
        # 保存PDF
        output_doc.save(output_path, garbage=4, deflate=True, clean=True)
        output_doc.close()
        
        output_size = os.path.getsize(output_path)
        elapsed_time = time.time() - start_time
        
        logger.info(f"PDF编排完成: {output_filename}, 总页数: {total_pages_added}, 耗时: {elapsed_time:.2f}秒")
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'url': f'/download/{output_filename}',
            'total_pages': total_pages_added,
            'file_size': output_size,
            'elapsed_time': round(elapsed_time, 2)
        })
        
    except Exception as e:
        logger.error(f"PDF编排失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'编排失败: {str(e)}'}), 500


@app.route('/longimage/print', methods=['POST'])
def print_longimage():
    """
    长图打印功能：将长图裁剪并排版到A4页面中
    支持1/2/3列布局
    输入：图片或PDF文件
    输出：适合打印的PDF文件
    """
    try:
        # 检查文件
        if 'file' not in request.files:
            return jsonify({'error': '未上传文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        # 获取分栏选项（1/2/3列）
        columns = int(request.form.get('columns', 1))
        if columns not in [1, 2, 3]:
            return jsonify({'error': '分栏数必须是1、2或3'}), 400
        
        # 获取DPI设置（影响质量）
        dpi = int(request.form.get('dpi', 300))
        
        start_time = time.time()
        
        # 保存上传的文件
        filename = secure_filename(file.filename)
        file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4()}_{filename}")
        file.save(upload_path)
        
        logger.info(f"开始处理长图打印: {filename}, 分栏: {columns}, DPI: {dpi}")
        
        # 将输入转换为PIL Image
        images = []
        if file_ext == 'pdf':
            # PDF文件：转换每一页为图片
            pdf_doc = fitz.open(upload_path)
            for page_num in range(len(pdf_doc)):
                page = pdf_doc[page_num]
                # 使用指定DPI渲染
                mat = fitz.Matrix(dpi/72, dpi/72)
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                images.append(img)
            pdf_doc.close()
        else:
            # 图片文件：直接打开
            img = Image.open(upload_path)
            # 转换为RGB（处理RGBA等格式）
            if img.mode != 'RGB':
                img = img.convert('RGB')
            images.append(img)
        
        # A4尺寸（72 DPI下的点数）
        A4_WIDTH_PT = 595
        A4_HEIGHT_PT = 842
        
        # 页面边距（点）
        MARGIN = 20
        
        # 可用区域尺寸
        usable_width = A4_WIDTH_PT - 2 * MARGIN
        usable_height = A4_HEIGHT_PT - 2 * MARGIN
        
        # 计算每列的宽度
        column_spacing = 10  # 列间距
        if columns == 1:
            column_width = usable_width
        elif columns == 2:
            column_width = (usable_width - column_spacing) / 2
        else:  # 3列
            column_width = (usable_width - 2 * column_spacing) / 3
        
        # 创建输出PDF
        output_pdf = fitz.open()
        
        # 收集所有需要处理的图片段
        all_segments = []
        
        for img_index, source_img in enumerate(images):
            logger.info(f"处理第 {img_index + 1}/{len(images)} 张图片, 尺寸: {source_img.size}")
            
            # 计算缩放比例（保持宽高比）
            img_width, img_height = source_img.size
            scale = (column_width * dpi / 72) / img_width
            
            # 调整图片尺寸以适应列宽
            new_width = int(img_width * scale)
            new_height = int(img_height * scale)
            resized_img = source_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            logger.info(f"图片缩放后尺寸: {new_width}x{new_height}px")
            
            # 将整张图片添加到待处理列表（不再预先切割）
            # 将整个图片添加到待处理列表
            all_segments.append({
                'image': resized_img,
                'width': new_width,
                'height': new_height
            })
        
        # 智能多列布局算法
        logger.info(f"开始智能布局: 共{len(all_segments)}张图片, {columns}列")
        
        # 初始化页面状态
        current_page = None
        current_column = 0  # 当前列索引（0, 1, 2...）
        column_y_positions = [MARGIN] * columns  # 每列的当前Y位置
        
        # 遍历所有图片段
        for seg_data in all_segments:
            img = seg_data['image']
            img_width_px = seg_data['width']
            img_height_px = seg_data['height']
            
            # 需要切割成多段以适应列高
            segment_height_px = int(usable_height * dpi / 72)
            remaining_height = img_height_px
            y_offset = 0
            
            while remaining_height > 0:
                # 计算当前段的高度
                current_seg_height = min(segment_height_px, remaining_height)
                
                # 裁剪当前段
                segment = img.crop((0, y_offset, img_width_px, y_offset + current_seg_height))
                
                # 计算segment在PDF中的尺寸（点）
                seg_width_pt = column_width
                seg_height_pt = current_seg_height * 72 / dpi
                
                # 查找可以放置的列
                placed = False
                for attempt in range(columns):
                    check_col = (current_column + attempt) % columns
                    
                    # 检查当前列是否有足够空间
                    if column_y_positions[check_col] + seg_height_pt <= A4_HEIGHT_PT - MARGIN:
                        # 如果需要新页面
                        if current_page is None:
                            current_page = output_pdf.new_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
                            column_y_positions = [MARGIN] * columns
                        
                        # 计算X位置
                        if columns == 1:
                            x = MARGIN
                        elif columns == 2:
                            x = MARGIN + check_col * (column_width + column_spacing)
                        else:  # 3列
                            x = MARGIN + check_col * (column_width + column_spacing)
                        
                        y = column_y_positions[check_col]
                        
                        # 保存segment为临时文件
                        temp_seg_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_seg_{uuid.uuid4()}.png")
                        segment.save(temp_seg_path, "PNG", optimize=True, quality=95)
                        
                        # 插入图片到PDF
                        rect = fitz.Rect(x, y, x + seg_width_pt, y + seg_height_pt)
                        current_page.insert_image(rect, filename=temp_seg_path)
                        
                        # 删除临时文件
                        try:
                            os.remove(temp_seg_path)
                        except:
                            pass
                        
                        # 更新该列的Y位置
                        column_y_positions[check_col] += seg_height_pt
                        current_column = check_col
                        placed = True
                        break
                
                # 如果所有列都满了，创建新页面
                if not placed:
                    current_page = output_pdf.new_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
                    column_y_positions = [MARGIN] * columns
                    current_column = 0
                    
                    # 在新页面的第一列放置
                    x = MARGIN
                    y = MARGIN
                    
                    temp_seg_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_seg_{uuid.uuid4()}.png")
                    segment.save(temp_seg_path, "PNG", optimize=True, quality=95)
                    
                    rect = fitz.Rect(x, y, x + seg_width_pt, y + seg_height_pt)
                    current_page.insert_image(rect, filename=temp_seg_path)
                    
                    try:
                        os.remove(temp_seg_path)
                    except:
                        pass
                    
                    column_y_positions[0] = MARGIN + seg_height_pt
                
                # 更新剩余高度和偏移
                remaining_height -= current_seg_height
                y_offset += current_seg_height
        
        # 获取页数（在关闭之前）
        total_pages = len(output_pdf)
        
        # 保存输出PDF
        output_filename = f"print_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.pdf"
        output_path = os.path.join(app.config['CONVERTED_FOLDER'], output_filename)
        output_pdf.save(output_path, garbage=4, deflate=True)
        output_pdf.close()
        
        # 清理上传的文件
        try:
            os.remove(upload_path)
        except:
            pass
        
        # 获取输出文件大小
        output_size = os.path.getsize(output_path)
        elapsed_time = time.time() - start_time
        
        logger.info(f"长图打印完成: {output_filename}, 页数: {total_pages}, 耗时: {elapsed_time:.2f}秒")
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'url': f'/download/{output_filename}',
            'total_pages': total_pages,
            'file_size': output_size,
            'elapsed_time': round(elapsed_time, 2),
            'columns': columns
        })
        
    except Exception as e:
        logger.error(f"长图打印失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'处理失败: {str(e)}'}), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    """文件过大错误处理"""
    return jsonify({'error': '文件大小超过50MB限制'}), 413


@app.errorhandler(500)
def internal_server_error(error):
    """内部服务器错误处理"""
    logger.error(f"服务器错误: {str(error)}")
    return jsonify({'error': '服务器内部错误'}), 500


if __name__ == '__main__':
    logger.info("========================================")
    logger.info("PDF工具服务启动 v2.0")
    logger.info("端口: 8789")
    logger.info("支持的格式: PDF/Word/Excel/PPT/图片")
    logger.info("最大文件大小: 100MB")
    logger.info("========================================")
    logger.info("功能特性:")
    logger.info("  ✓ PDF转Word/Excel/PPT/图片")
    logger.info("  ✓ Word/Excel/PPT转PDF")
    logger.info("  ✓ PDF压缩优化")
    logger.info("  ✓ PDF页面编排")
    logger.info("  ✓ PDF旋转")
    logger.info("  ✓ 文件转长图")
    logger.info("  ✓ 长图打印 (NEW!)")
    logger.info("========================================")
    logger.info("API端点:")
    logger.info("  GET  /health - 健康检查")
    logger.info("  POST /longimage/print - 长图打印")
    logger.info("  POST /pdf/compress - PDF压缩")
    logger.info("  POST /pdf/arrange/* - PDF页面编排")
    logger.info("  POST /file/to-long-image - 文件转长图")
    logger.info("  POST /pdf/rotate - PDF旋转")
    logger.info("  GET  /download/<filename> - 下载文件")
    logger.info("========================================\n")
    
    # 禁用reloader解决Windows权限问题
    app.run(host='0.0.0.0', port=8789, debug=True, use_reloader=False)
