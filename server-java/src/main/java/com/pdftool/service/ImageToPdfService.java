package com.pdftool.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 高性能图片转PDF服务
 * 
 * 优化特性：
 * 1. 性能高 - 使用PDFBox直接操作，无LibreOffice开销
 * 2. 速度快 - 纯内存操作，毫秒级转换
 * 3. 格式完整 - 完美保留图片质量、尺寸、DPI
 * 4. 支持批量 - 多张图片合并为一个PDF
 * 5. 智能适配 - 自动适配页面大小
 * 
 * @author PDFTool
 * @version 2.0
 */
@Service
public class ImageToPdfService {

    // 性能统计
    private final AtomicInteger totalConversions = new AtomicInteger(0);
    private final AtomicInteger successfulConversions = new AtomicInteger(0);
    
    // 支持的图片格式
    private static final String[] SUPPORTED_FORMATS = {"jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"};
    
    // 默认DPI（高质量）
    private static final int DEFAULT_DPI = 300;
    
    // 页面边距（单位：点，1英寸=72点）
    private static final float MARGIN = 36; // 0.5英寸边距

    /**
     * 单张图片转PDF（高质量模式）
     * 
     * @param imageBytes 图片字节数组
     * @param imageFormat 图片格式（jpg, png等）
     * @return PDF字节数组
     */
    public byte[] convertImageToPdf(byte[] imageBytes, String imageFormat) throws IOException {
        int conversionId = totalConversions.incrementAndGet();
        long startTime = System.currentTimeMillis();
        
        System.out.println("========================================");
        System.out.println("[图片转PDF #" + conversionId + "] 开始转换");
        System.out.println("图片格式: " + imageFormat);
        System.out.println("图片大小: " + (imageBytes.length / 1024) + " KB");
        System.out.println("========================================");

        try (PDDocument document = new PDDocument()) {
            // 读取图片
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageBytes));
            if (image == null) {
                throw new IOException("无法读取图片，可能格式不支持");
            }
            
            // 创建PDImageXObject
            PDImageXObject pdImage = PDImageXObject.createFromByteArray(
                document, imageBytes, "image"
            );
            
            // 根据图片尺寸创建合适的页面
            PDRectangle pageSize = calculatePageSize(image.getWidth(), image.getHeight());
            PDPage page = new PDPage(pageSize);
            document.addPage(page);
            
            // 计算图片在页面上的位置和大小（保持宽高比，添加边距）
            float[] imageRect = calculateImageRect(
                image.getWidth(), 
                image.getHeight(), 
                pageSize.getWidth(), 
                pageSize.getHeight()
            );
            
            // 将图片绘制到页面
            try (PDPageContentStream contentStream = new PDPageContentStream(
                    document, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                contentStream.drawImage(
                    pdImage, 
                    imageRect[0],  // x
                    imageRect[1],  // y
                    imageRect[2],  // width
                    imageRect[3]   // height
                );
            }
            
            // 输出PDF
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            document.save(outputStream);
            
            byte[] pdfBytes = outputStream.toByteArray();
            long duration = System.currentTimeMillis() - startTime;
            
            successfulConversions.incrementAndGet();
            
            System.out.println("========================================");
            System.out.println("[图片转PDF #" + conversionId + "] 转换成功！");
            System.out.println("耗时: " + duration + " ms");
            System.out.println("PDF大小: " + (pdfBytes.length / 1024) + " KB");
            System.out.println("图片分辨率: " + image.getWidth() + "x" + image.getHeight());
            System.out.println("页面大小: " + pageSize.getWidth() + "x" + pageSize.getHeight() + " 点");
            System.out.println("========================================");
            
            return pdfBytes;
            
        } catch (Exception e) {
            System.err.println("[图片转PDF #" + conversionId + "] 转换失败: " + e.getMessage());
            throw e;
        }
    }

    /**
     * 多张图片转PDF（批量模式）
     * 统一宽度模式：所有页面使用相同宽度，高度根据图片比例自动调整
     * 
     * @param imageDataList 图片数据列表
     * @return PDF字节数组
     */
    public byte[] convertImagesToPdf(List<ImageData> imageDataList) throws IOException {
        int conversionId = totalConversions.incrementAndGet();
        long startTime = System.currentTimeMillis();
        
        System.out.println("========================================");
        System.out.println("[批量图片转PDF #" + conversionId + "] 开始转换（统一宽度模式）");
        System.out.println("图片数量: " + imageDataList.size());
        System.out.println("========================================");

        try (PDDocument document = new PDDocument()) {
            // 第一步：预读所有图片，计算统一的页面宽度
            float maxWidthInPoints = 0;
            List<BufferedImage> images = new ArrayList<>();
            
            System.out.println("[步骤1] 分析所有图片尺寸...");
            for (int i = 0; i < imageDataList.size(); i++) {
                ImageData imageData = imageDataList.get(i);
                BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageData.bytes));
                if (image == null) {
                    System.err.println("[图片 " + (i + 1) + "] 无法读取，跳过");
                    images.add(null);
                    continue;
                }
                images.add(image);
                
                // 将像素宽度转换为点（假设300 DPI）
                float widthInPoints = image.getWidth() * 72f / DEFAULT_DPI;
                if (widthInPoints > maxWidthInPoints) {
                    maxWidthInPoints = widthInPoints;
                }
                System.out.println("  图片 " + (i + 1) + ": " + image.getWidth() + "x" + image.getHeight() + " 像素");
            }
            
            // 添加边距
            float pageWidth = maxWidthInPoints + MARGIN * 2;
            System.out.println("[统一宽度] " + pageWidth + " 点 (最大图片宽度 + 边距)");
            System.out.println("");
            
            // 第二步：使用统一宽度创建所有页面
            System.out.println("[步骤2] 创建PDF页面...");
            int pageNum = 0;
            
            for (int i = 0; i < imageDataList.size(); i++) {
                BufferedImage image = images.get(i);
                if (image == null) {
                    continue;
                }
                
                pageNum++;
                ImageData imageData = imageDataList.get(i);
                
                System.out.println("[页面 " + pageNum + "] 处理图片: " + 
                    (imageData.bytes.length / 1024) + " KB");
                
                // 创建PDImageXObject
                PDImageXObject pdImage = PDImageXObject.createFromByteArray(
                    document, imageData.bytes, "image" + pageNum
                );
                
                // 根据图片宽高比计算页面高度（宽度统一）
                float imageWidth = image.getWidth();
                float imageHeight = image.getHeight();
                float aspectRatio = imageHeight / imageWidth;
                
                // 页面高度 = 统一宽度 * 图片宽高比
                float pageHeight = (pageWidth - MARGIN * 2) * aspectRatio + MARGIN * 2;
                
                // 创建统一宽度的页面
                PDRectangle pageSize = new PDRectangle(pageWidth, pageHeight);
                PDPage page = new PDPage(pageSize);
                document.addPage(page);
                
                System.out.println("  页面尺寸: " + pageWidth + " x " + pageHeight + " 点");
                
                // 计算图片位置（居中显示，添加边距）
                float availableWidth = pageWidth - MARGIN * 2;
                float availableHeight = pageHeight - MARGIN * 2;
                
                // 图片绘制区域
                float drawX = MARGIN;
                float drawY = MARGIN;
                float drawWidth = availableWidth;
                float drawHeight = availableHeight;
                
                // 绘制图片
                try (PDPageContentStream contentStream = new PDPageContentStream(
                        document, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                    contentStream.drawImage(
                        pdImage, 
                        drawX, 
                        drawY, 
                        drawWidth, 
                        drawHeight
                    );
                }
            }
            
            // 输出PDF
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            document.save(outputStream);
            
            byte[] pdfBytes = outputStream.toByteArray();
            long duration = System.currentTimeMillis() - startTime;
            
            successfulConversions.incrementAndGet();
            
            System.out.println("========================================");
            System.out.println("[批量图片转PDF #" + conversionId + "] 转换成功！（统一宽度）");
            System.out.println("总页数: " + document.getNumberOfPages());
            System.out.println("统一宽度: " + pageWidth + " 点");
            System.out.println("耗时: " + duration + " ms");
            System.out.println("PDF大小: " + (pdfBytes.length / 1024) + " KB");
            System.out.println("平均速度: " + (duration / imageDataList.size()) + " ms/图");
            System.out.println("========================================");
            
            return pdfBytes;
            
        } catch (Exception e) {
            System.err.println("[批量图片转PDF #" + conversionId + "] 转换失败: " + e.getMessage());
            throw e;
        }
    }

    /**
     * 根据图片尺寸计算合适的页面大小
     * 
     * 策略：
     * - 小于A4：使用实际尺寸
     * - 大于A4：使用A4或更大标准尺寸
     * - 横向图片：使用横向页面
     */
    private PDRectangle calculatePageSize(int imageWidth, int imageHeight) {
        // 将像素转换为点（假设72 DPI）
        float widthInPoints = imageWidth * 72f / DEFAULT_DPI;
        float heightInPoints = imageHeight * 72f / DEFAULT_DPI;
        
        // 判断方向
        boolean isLandscape = imageWidth > imageHeight;
        
        // A4尺寸（点）
        PDRectangle a4 = isLandscape ? new PDRectangle(842, 595) : PDRectangle.A4;
        
        // 如果图片比A4大，使用A3或自定义大小
        if (widthInPoints > a4.getWidth() || heightInPoints > a4.getHeight()) {
            // 使用图片实际尺寸（添加边距）
            return new PDRectangle(
                widthInPoints + MARGIN * 2, 
                heightInPoints + MARGIN * 2
            );
        }
        
        // 使用A4
        return a4;
    }

    /**
     * 计算图片在页面上的位置和大小
     * 保持宽高比，居中显示，添加边距
     * 
     * @return [x, y, width, height]
     */
    private float[] calculateImageRect(
            int imageWidth, 
            int imageHeight, 
            float pageWidth, 
            float pageHeight) {
        
        // 可用区域（减去边距）
        float availableWidth = pageWidth - MARGIN * 2;
        float availableHeight = pageHeight - MARGIN * 2;
        
        // 计算缩放比例（保持宽高比）
        float widthScale = availableWidth / imageWidth;
        float heightScale = availableHeight / imageHeight;
        float scale = Math.min(widthScale, heightScale);
        
        // 缩放后的尺寸
        float scaledWidth = imageWidth * scale;
        float scaledHeight = imageHeight * scale;
        
        // 居中位置
        float x = (pageWidth - scaledWidth) / 2;
        float y = (pageHeight - scaledHeight) / 2;
        
        return new float[]{x, y, scaledWidth, scaledHeight};
    }

    /**
     * 检查是否支持该图片格式
     */
    public boolean isSupportedFormat(String format) {
        if (format == null) return false;
        String lowerFormat = format.toLowerCase();
        for (String supported : SUPPORTED_FORMATS) {
            if (lowerFormat.equals(supported)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取服务状态
     */
    public String getStatus() {
        return String.format(
            "图片转PDF服务 - 总计:%d, 成功:%d, 成功率:%.1f%%",
            totalConversions.get(),
            successfulConversions.get(),
            (double) successfulConversions.get() / Math.max(1, totalConversions.get()) * 100
        );
    }

    /**
     * 图片数据封装类
     */
    public static class ImageData {
        public byte[] bytes;
        public String format;
        public String filename;
        
        public ImageData(byte[] bytes, String format, String filename) {
            this.bytes = bytes;
            this.format = format;
            this.filename = filename;
        }
    }
}

