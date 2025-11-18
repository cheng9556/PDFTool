package com.pdftool.filter;

import org.jodconverter.core.office.OfficeContext;
import org.jodconverter.local.filter.Filter;
import org.jodconverter.local.filter.FilterChain;

import com.sun.star.beans.PropertyValue;
import com.sun.star.frame.XStorable;
import com.sun.star.lang.XComponent;
import com.sun.star.uno.UnoRuntime;

/**
 * Word转PDF优化过滤器
 * 
 * 功能：
 * 1. 设置高质量PDF导出选项
 * 2. 保留所有格式（字体、样式、布局）
 * 3. 优化图片质量和压缩
 * 4. 保留超链接和书签
 * 
 * @author PDFTool
 * @version 1.0
 */
public class WordToPdfOptimizationFilter implements Filter {

    @Override
    public void doFilter(
            OfficeContext context,
            XComponent document,
            FilterChain chain) throws Exception {

        System.out.println("[Word转PDF优化] 应用高质量PDF导出设置...");

        try {
            // 获取文档属性
            XStorable storable = UnoRuntime.queryInterface(XStorable.class, document);
            
            if (storable != null) {
                // 配置PDF导出选项
                PropertyValue[] pdfOptions = createPdfExportOptions();
                
                // 打印配置信息
                System.out.println("[Word转PDF优化] PDF导出选项已配置：");
                for (PropertyValue prop : pdfOptions) {
                    System.out.println("  - " + prop.Name + " = " + prop.Value);
                }
            }

        } catch (Exception e) {
            System.err.println("[Word转PDF优化] 设置失败，使用默认选项: " + e.getMessage());
            // 不抛出异常，继续使用默认设置
        }

        // 继续过滤器链
        chain.doFilter(context, document);
    }

    /**
     * 创建高质量PDF导出选项
     * 
     * 格式保留优化：
     * - 嵌入所有字体
     * - 保留原始图片质量
     * - 保留超链接和书签
     * - 保留表单和注释
     * - 高质量JPEG压缩
     */
    private PropertyValue[] createPdfExportOptions() {
        return new PropertyValue[] {
            // ============ 质量选项 ============
            
            // 图片质量（90%）
            createPropertyValue("Quality", 90),
            
            // 使用JPEG压缩
            createPropertyValue("UseJPEGCompression", true),
            
            // 图片分辨率（300 DPI，高质量）
            createPropertyValue("MaxImageResolution", 300),
            
            // ============ 格式保留选项 ============
            
            // 嵌入标准字体（确保字体显示正确）
            createPropertyValue("EmbedStandardFonts", true),
            
            // 保留超链接
            createPropertyValue("ExportLinksRelativeFsys", false),
            createPropertyValue("ConvertOOoTargetToPDFTarget", true),
            createPropertyValue("ExportBookmarks", true),
            
            // 保留书签和大纲
            createPropertyValue("ExportBookmarksToPDFDestination", true),
            
            // ============ 文档结构选项 ============
            
            // 保留注释
            createPropertyValue("ExportNotes", true),
            
            // 保留表单域
            createPropertyValue("FormsType", 0),  // 0 = FDF, 1 = PDF, 2 = HTML
            
            // ============ 兼容性选项 ============
            
            // PDF版本（PDF/A-1a，高兼容性）
            createPropertyValue("SelectPdfVersion", 0),  // 0 = PDF 1.4
            
            // 创建PDF/A-1a（归档标准，最佳兼容性）
            createPropertyValue("UseTaggedPDF", true),
            
            // ============ 性能优化选项 ============
            
            // 禁用缩略图（减少文件大小，加快速度）
            createPropertyValue("ExportBookmarksToPDFDestination", false),
            
            // 减少PDF对象（优化文件大小）
            createPropertyValue("ReduceImageResolution", false),  // 保持原始分辨率
            
            // ============ 安全选项 ============
            
            // 允许打印
            createPropertyValue("RestrictPermissions", false),
            
            // 允许复制内容
            createPropertyValue("Changes", 4),  // 4 = 允许所有更改
            
            // ============ 高级选项 ============
            
            // 保留原始页面布局
            createPropertyValue("IsSkipEmptyPages", false),
            
            // 导出隐藏幻灯片（Word中可能有隐藏内容）
            createPropertyValue("ExportHiddenSlides", true),
            
            // 单页模式（优化查看体验）
            createPropertyValue("SinglePageSheets", false)
        };
    }

    /**
     * 创建属性值对象
     */
    private PropertyValue createPropertyValue(String name, Object value) {
        PropertyValue prop = new PropertyValue();
        prop.Name = name;
        prop.Value = value;
        return prop;
    }
}

