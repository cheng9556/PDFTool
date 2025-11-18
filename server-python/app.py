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
    下载转换后的Word文件
    """
    try:
        file_path = os.path.join(app.config['CONVERTED_FOLDER'], secure_filename(filename))
        
        if not os.path.exists(file_path):
            return jsonify({'error': '文件不存在'}), 404
        
        logger.info(f"下载文件: {filename}")
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
    except Exception as e:
        logger.error(f"下载文件失败: {str(e)}")
        return jsonify({'error': f'下载失败: {str(e)}'}), 500


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
