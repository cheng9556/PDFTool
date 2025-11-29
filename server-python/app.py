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
            'xls': 'application/vnd.ms-excel'
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
        
        # 生成每页缩略图
        thumbnails = []
        for page_num in range(total_pages):
            page = doc[page_num]
            # 生成缩略图（150x150像素）
            mat = fitz.Matrix(150 / page.rect.width, 150 / page.rect.height)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            thumbnails.append({
                'page_number': page_num + 1,
                'thumbnail': f'data:image/png;base64,{img_base64}',
                'width': page.rect.width,
                'height': page.rect.height
            })
        
        doc.close()
        
        file_size = os.path.getsize(temp_path)
        
        logger.info(f"上传PDF用于编排: {filename}, 文件ID: {file_id}, 页数: {total_pages}")
        
        return jsonify({
            'success': True,
            'file_id': file_id,
            'filename': filename,
            'file_size': file_size,
            'total_pages': total_pages,
            'thumbnails': thumbnails
        })
        
    except Exception as e:
        logger.error(f"上传PDF失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'上传失败: {str(e)}'}), 500


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
    logger.info("PDF转Word服务启动 - 增强版 v2.0")
    logger.info("端口: 8789")
    logger.info("支持的格式: PDF -> DOCX")
    logger.info("最大文件大小: 50MB")
    logger.info("========================================")
    logger.info("功能特性:")
    logger.info("  ✓ 复杂格式转换（表格、图片、样式）")
    logger.info("  ✓ 简化模式（不含图片）")
    logger.info("  ✓ 纯文本模式（仅提取文字）")
    logger.info("  ✓ 页码范围选择（单页/多页/范围）")
    logger.info("  ✓ PDF预览图生成")
    logger.info("  ✓ 性能优化（内存管理）")
    logger.info("========================================")
    logger.info("API端点:")
    logger.info("  GET  /health - 健康检查")
    logger.info("  POST /pdf/info - 获取PDF信息和预览图")
    logger.info("  POST /pdf/toword - PDF转Word（支持多种模式）")
    logger.info("  GET  /download/<filename> - 下载转换文件")
    logger.info("========================================\n")
    
    app.run(host='0.0.0.0', port=8789, debug=True)
