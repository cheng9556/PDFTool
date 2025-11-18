package com.pdftool.controller;

import com.pdftool.service.OptimizedConversionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * PPT转换Controller
 * 
 * 功能：
 * - PPT转PDF：使用JodConverter + LibreOffice
 * - 文件大小限制：60MB
 * - 页数限制：100页（建议）
 * - 高性能、高质量转换
 * 
 * @author PDFTool
 * @version 1.0
 */
@RestController
@RequestMapping("/ppt")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "jodconverter.enabled", 
    havingValue = "true", 
    matchIfMissing = false
)
public class PptConversionController {

    @Autowired
    @Qualifier("optimizedConversionService")
    private OptimizedConversionService conversionService;

    private static final String TEMP_DIR = "temp";
    private static final long MAX_FILE_SIZE = 60 * 1024 * 1024; // 60MB

    /**
     * PPT转PDF
     * POST /ppt/topdf
     * 
     * @param file PPT文件（.ppt或.pptx）
     * @return JSON: {url: "/download/xxx.pdf", message: "转换成功"}
     */
    @PostMapping(value = "/topdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> convertPptToPdf(@RequestParam("file") MultipartFile file) {
        long startTime = System.currentTimeMillis();
        
        try {
            // 1. 验证文件
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("上传的文件为空"));
            }

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || !isPptFile(originalFilename)) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("只支持 PPT 文件 (.ppt, .pptx)"));
            }

            // 2. 检查文件大小
            if (file.getSize() > MAX_FILE_SIZE) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("文件大小超过限制（最大60MB）"));
            }

            System.out.println("====================================");
            System.out.println("开始转换PPT: " + originalFilename);
            System.out.println("文件大小: " + (file.getSize() / 1024) + " KB");
            System.out.println("====================================");

            // 3. 转换PPT到PDF
            byte[] pdfBytes = conversionService.convertPptToPdf(file.getBytes());

            // 4. 保存PDF到临时目录
            File tempDir = new File(TEMP_DIR);
            if (!tempDir.exists()) {
                tempDir.mkdirs();
            }

            // 生成唯一文件名
            String pdfFileName = UUID.randomUUID().toString() + "_" + 
                                getOutputFilename(originalFilename, ".pdf");
            File pdfFile = new File(tempDir, pdfFileName);

            try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                fos.write(pdfBytes);
            }

            long duration = System.currentTimeMillis() - startTime;

            System.out.println("====================================");
            System.out.println("转换成功: " + originalFilename + " -> " + pdfFileName);
            System.out.println("PDF大小: " + (pdfBytes.length / 1024) + " KB");
            System.out.println("总耗时: " + duration + " ms");
            System.out.println("====================================");

            // 5. 返回成功响应
            Map<String, Object> response = new HashMap<>();
            response.put("url", "/download/" + pdfFileName);
            response.put("message", "转换成功");
            response.put("filename", pdfFileName);
            response.put("size", pdfBytes.length);
            response.put("conversionTime", duration + " ms");
            
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("转换失败: " + e.getMessage()));
        }
    }

    /**
     * 检查健康状态
     */
    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("service", "PPT Conversion Service");
        status.put("status", "running");
        status.put("statistics", conversionService.getStatus());
        status.put("maxFileSize", "60 MB");
        status.put("recommendedMaxPages", 100);
        return ResponseEntity.ok(status);
    }

    /**
     * 检查是否为PPT文件
     */
    private boolean isPptFile(String filename) {
        if (filename == null) return false;
        String lower = filename.toLowerCase();
        return lower.endsWith(".ppt") || lower.endsWith(".pptx");
    }

    /**
     * 获取输出文件名
     */
    private String getOutputFilename(String originalFilename, String newExtension) {
        if (originalFilename == null) {
            return "converted" + newExtension;
        }
        
        int lastDotIndex = originalFilename.lastIndexOf('.');
        if (lastDotIndex > 0) {
            return originalFilename.substring(0, lastDotIndex) + newExtension;
        }
        
        return originalFilename + newExtension;
    }

    /**
     * 创建错误响应
     */
    private Map<String, String> createErrorResponse(String message) {
        Map<String, String> error = new HashMap<>();
        error.put("error", message);
        return error;
    }
}

