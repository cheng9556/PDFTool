package com.pdftool.controller;

import com.pdftool.service.ConversionService;
import com.pdftool.service.OptimizedConversionService;
import com.pdftool.service.EnhancedPdfToExcelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaTypeFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@CrossOrigin(origins = "*")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "jodconverter.enabled", 
    havingValue = "true", 
    matchIfMissing = false
)
public class ExcelToPdfController {

    @Autowired
    private ConversionService conversionService;

    @Autowired
    @Qualifier("optimizedConversionService")
    private com.pdftool.service.OptimizedConversionService optimizedConversionService;

    @Autowired
    private EnhancedPdfToExcelService enhancedPdfToExcelService;

    // 临时文件存储目录
    private static final String TEMP_DIR = "temp";

    /**
     * Excel转PDF
     * POST /excel/topdf
     * 返回JSON: {url: "/download/xxx.pdf"}
     */
    @PostMapping(value = "/excel/topdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> convertExcelToPdf(@RequestParam("file") MultipartFile file) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("上传的文件为空"));
            }

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || !isExcelFile(originalFilename)) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("只支持 Excel 文件 (.xls, .xlsx, .xlsm)"));
            }

            System.out.println("开始转换: " + originalFilename);

            // 转换Excel到PDF
            byte[] pdfBytes = conversionService.convertExcelToPdf(file.getBytes());

            // 保存PDF到临时目录
            File tempDir = new File(TEMP_DIR);
            if (!tempDir.exists()) {
                tempDir.mkdirs();
            }

            // 生成唯一文件名
            String pdfFileName = UUID.randomUUID().toString() + "_" + getOutputFilename(originalFilename, ".pdf");
            File pdfFile = new File(tempDir, pdfFileName);

            try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                fos.write(pdfBytes);
            }

            System.out.println("转换成功: " + originalFilename + " -> " + pdfFileName + 
                             " (大小: " + (pdfBytes.length / 1024) + "KB)");

            // 返回JSON响应，包含下载URL
            Map<String, String> response = new HashMap<>();
            response.put("url", "/download/" + pdfFileName);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("转换失败: " + e.getMessage()));
        }
    }

    /**
     * Word转PDF
     * POST /word/topdf
     * 接收Word文件（.doc或.docx），返回PDF文件的下载URL
     */
    @PostMapping(value = "/word/topdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> convertWordToPdf(@RequestParam("file") MultipartFile file) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("上传的文件为空"));
            }

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || !isWordFile(originalFilename)) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("只支持 Word 文件 (.doc, .docx)"));
            }

            System.out.println("开始转换 Word -> PDF: " + originalFilename);

            // 转换Word到PDF
            byte[] pdfBytes = conversionService.convertWordToPdf(file.getBytes());

            // 保存PDF到临时目录
            File tempDir = new File(TEMP_DIR);
            if (!tempDir.exists()) {
                tempDir.mkdirs();
            }

            // 生成唯一文件名
            String pdfFileName = UUID.randomUUID().toString() + "_" + getOutputFilename(originalFilename, ".pdf");
            File pdfFile = new File(tempDir, pdfFileName);

            try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                fos.write(pdfBytes);
            }

            System.out.println("转换成功: " + originalFilename + " -> " + pdfFileName + 
                             " (大小: " + (pdfBytes.length / 1024) + "KB)");

            // 返回JSON响应，包含下载URL
            Map<String, String> response = new HashMap<>();
            response.put("url", "/download/" + pdfFileName);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("转换失败: " + e.getMessage()));
        }
    }

    /**
     * PDF转Excel
     * POST /pdf/toexcel
     */
    @PostMapping(value = "/pdf/toexcel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> convertPdfToExcel(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("上传的文件为空"));
            }

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || !isPdfFile(originalFilename)) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("只支持 PDF 文件 (.pdf)"));
            }

            System.out.println("开始转换 PDF -> Excel (增强版): " + originalFilename);

            // 使用增强版PDF转Excel服务，支持复杂表格
            byte[] excelBytes = enhancedPdfToExcelService.convertPdfToExcel(file.getBytes());

            File tempDir = new File(TEMP_DIR);
            if (!tempDir.exists()) {
                tempDir.mkdirs();
            }

            String excelFileName = UUID.randomUUID().toString() + "_" + getOutputFilename(originalFilename, ".xlsx");
            File excelFile = new File(tempDir, excelFileName);

            try (FileOutputStream fos = new FileOutputStream(excelFile)) {
                fos.write(excelBytes);
            }

            System.out.println("转换成功: " + originalFilename + " -> " + excelFileName +
                    " (大小: " + (excelBytes.length / 1024) + "KB)");

            Map<String, String> response = new HashMap<>();
            response.put("url", "/download/" + excelFileName);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("转换失败: " + e.getMessage()));
        }
    }

    @GetMapping("/download/{filename}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String filename) {
        try {
            Path filePath = Paths.get(TEMP_DIR, filename);
            File file = filePath.toFile();

            if (!file.exists()) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new FileSystemResource(file);
            HttpHeaders headers = new HttpHeaders();
            MediaType contentType = MediaTypeFactory
                    .getMediaType(resource)
                    .orElse(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentType(contentType);
            headers.setContentDispositionFormData("attachment", filename);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(resource);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 检查是否为Excel文件
     */
    private boolean isExcelFile(String filename) {
        String lowerCaseFilename = filename.toLowerCase();
        return lowerCaseFilename.endsWith(".xls") || 
               lowerCaseFilename.endsWith(".xlsx") ||
               lowerCaseFilename.endsWith(".xlsm");
    }

    /**
     * 生成输出PDF文件名
     */
    private String getOutputFilename(String originalFilename, String targetExtension) {
        int lastDotIndex = originalFilename.lastIndexOf('.');
        String baseName = originalFilename;
        if (lastDotIndex > 0) {
            baseName = originalFilename.substring(0, lastDotIndex);
        }
        return baseName + targetExtension;
    }

    private boolean isPdfFile(String filename) {
        return filename.toLowerCase().endsWith(".pdf");
    }

    /**
     * Word转PDF（高性能优化版）
     * 
     * 优化特性：
     * - 性能高：并发处理，3个进程池
     * - 速度快：5分钟超时，快速失败
     * - 格式完整：高质量PDF导出（300 DPI）
     * - 保留所有格式：字体、样式、图片、表格
     */
    @PostMapping(value = "/word/topdf/optimized", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> convertWordToPdfOptimized(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "fast", required = false, defaultValue = "false") boolean fast) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("上传的文件为空"));
            }

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || !isWordFile(originalFilename)) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("只支持 Word 文件 (.doc, .docx)"));
            }

            System.out.println("========================================");
            System.out.println("开始转换 Word -> PDF (优化版)");
            System.out.println("文件: " + originalFilename);
            System.out.println("大小: " + (file.getSize() / 1024) + " KB");
            System.out.println("模式: " + (fast ? "快速模式" : "高质量模式"));
            System.out.println("========================================");

            long startTime = System.currentTimeMillis();

            // 使用优化的服务
            byte[] pdfBytes;
            if (fast) {
                pdfBytes = optimizedConversionService.convertWordToPdfFast(file.getBytes());
            } else {
                pdfBytes = optimizedConversionService.convertWordToPdf(file.getBytes());
            }

            long duration = System.currentTimeMillis() - startTime;

            // 保存PDF到临时目录
            File tempDir = new File(TEMP_DIR);
            if (!tempDir.exists()) {
                tempDir.mkdirs();
            }

            String pdfFileName = UUID.randomUUID().toString() + "_" + getOutputFilename(originalFilename, ".pdf");
            File pdfFile = new File(tempDir, pdfFileName);

            try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                fos.write(pdfBytes);
            }

            System.out.println("========================================");
            System.out.println("转换成功: " + originalFilename + " -> " + pdfFileName);
            System.out.println("总耗时: " + duration + " ms");
            System.out.println("输出大小: " + (pdfBytes.length / 1024) + " KB");
            System.out.println("性能: " + String.format("%.2f", (double)file.getSize() / duration) + " KB/ms");
            System.out.println("========================================");

            // 返回JSON响应
            Map<String, Object> response = new HashMap<>();
            response.put("url", "/download/" + pdfFileName);
            response.put("filename", pdfFileName);
            response.put("size", pdfBytes.length);
            response.put("duration", duration + "ms");
            response.put("mode", fast ? "fast" : "quality");
            return ResponseEntity.ok(response);

        } catch (java.util.concurrent.TimeoutException e) {
            System.err.println("转换超时: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT)
                    .body(createErrorResponse("转换超时（超过5分钟），请尝试使用快速模式或减小文件大小"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("转换失败: " + e.getMessage()));
        }
    }

    /**
     * 获取转换服务状态
     */
    @GetMapping("/word/topdf/status")
    public ResponseEntity<Map<String, Object>> getConversionStatus() {
        Map<String, Object> response = new HashMap<>();
        response.put("service", "Word to PDF Converter (Optimized)");
        response.put("version", "2.0");
        response.put("status", optimizedConversionService.getStatus());
        response.put("features", new String[]{
            "并发处理（3个进程池）",
            "超时控制（5分钟）",
            "自动重试（1次）",
            "高质量PDF（300 DPI）",
            "完整格式保留",
            "性能监控"
        });
        return ResponseEntity.ok(response);
    }

    /**
     * 检查是否为Word文件
     */
    private boolean isWordFile(String filename) {
        String lowerCaseFilename = filename.toLowerCase();
        return lowerCaseFilename.endsWith(".doc") || 
               lowerCaseFilename.endsWith(".docx");
    }

    /**
     * 创建错误响应
     */
    private Map<String, String> createErrorResponse(String errorMessage) {
        Map<String, String> error = new HashMap<>();
        error.put("error", errorMessage);
        return error;
    }
}

