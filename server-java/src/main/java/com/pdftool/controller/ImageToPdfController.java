package com.pdftool.controller;

import com.pdftool.service.ImageToPdfService;
import com.pdftool.service.ImageToPdfService.ImageData;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.util.*;

/**
 * 图片转PDF控制器
 * 
 * API端点：
 * - POST /image/topdf - 单张图片转PDF
 * - POST /images/topdf - 多张图片合并为PDF
 * - GET /image/topdf/status - 查看服务状态
 * 
 * @author PDFTool
 * @version 2.0
 */
@RestController
@CrossOrigin(origins = "*")
public class ImageToPdfController {

    @Autowired
    private ImageToPdfService imageToPdfService;

    @Autowired
    private com.pdftool.service.ImageSessionManager sessionManager;

    // 临时文件存储目录
    private static final String TEMP_DIR = "temp";

    /**
     * 单张图片转PDF
     * 
     * @param file 图片文件
     * @return JSON响应，包含PDF下载URL
     */
    @PostMapping(value = "/image/topdf", 
                consumes = MediaType.MULTIPART_FORM_DATA_VALUE, 
                produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> convertImageToPdf(@RequestParam("file") MultipartFile file) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("上传的文件为空"));
            }

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || !isImageFile(originalFilename)) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("只支持图片文件 (jpg, png, gif, bmp, tiff, webp)"));
            }

            // 文件大小限制：20MB
            if (file.getSize() > 20 * 1024 * 1024) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("图片文件不能超过20MB"));
            }

            System.out.println("========================================");
            System.out.println("开始转换 图片 -> PDF");
            System.out.println("文件: " + originalFilename);
            System.out.println("大小: " + (file.getSize() / 1024) + " KB");
            System.out.println("========================================");

            long startTime = System.currentTimeMillis();

            // 获取图片格式
            String format = getFileExtension(originalFilename);
            
            // 转换图片到PDF
            byte[] pdfBytes = imageToPdfService.convertImageToPdf(
                file.getBytes(), 
                format
            );

            long duration = System.currentTimeMillis() - startTime;

            // 保存PDF到临时目录
            File tempDir = new File(TEMP_DIR);
            if (!tempDir.exists()) {
                tempDir.mkdirs();
            }

            String pdfFileName = UUID.randomUUID().toString() + "_" + 
                                getBaseName(originalFilename) + ".pdf";
            File pdfFile = new File(tempDir, pdfFileName);

            try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                fos.write(pdfBytes);
            }

            System.out.println("========================================");
            System.out.println("转换成功: " + originalFilename + " -> " + pdfFileName);
            System.out.println("总耗时: " + duration + " ms");
            System.out.println("PDF大小: " + (pdfBytes.length / 1024) + " KB");
            System.out.println("========================================");

            // 返回JSON响应
            Map<String, Object> response = new HashMap<>();
            response.put("url", "/download/" + pdfFileName);
            response.put("filename", pdfFileName);
            response.put("size", pdfBytes.length);
            response.put("duration", duration + "ms");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("转换失败: " + e.getMessage()));
        }
    }

    /**
     * 多张图片合并为一个PDF
     * 
     * @param files 多个图片文件
     * @return JSON响应，包含PDF下载URL
     */
    @PostMapping(value = "/images/topdf", 
                consumes = MediaType.MULTIPART_FORM_DATA_VALUE, 
                produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> convertImagesToPdf(
            @RequestParam("files") MultipartFile[] files) {
        try {
            // 验证文件
            if (files == null || files.length == 0) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("请至少上传一张图片"));
            }

            if (files.length > 50) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("最多支持50张图片"));
            }

            System.out.println("========================================");
            System.out.println("开始批量转换 " + files.length + " 张图片 -> PDF");
            System.out.println("========================================");

            long startTime = System.currentTimeMillis();

            // 准备图片数据列表
            List<ImageData> imageDataList = new ArrayList<>();
            long totalSize = 0;

            for (int i = 0; i < files.length; i++) {
                MultipartFile file = files[i];
                
                if (file.isEmpty()) {
                    continue;
                }

                String filename = file.getOriginalFilename();
                if (filename == null || !isImageFile(filename)) {
                    System.out.println("跳过非图片文件: " + filename);
                    continue;
                }

                // 单个文件大小限制
                if (file.getSize() > 20 * 1024 * 1024) {
                    return ResponseEntity.badRequest()
                            .body(createErrorResponse("图片 " + filename + " 超过20MB"));
                }

                totalSize += file.getSize();
                
                // 总大小限制：100MB
                if (totalSize > 100 * 1024 * 1024) {
                    return ResponseEntity.badRequest()
                            .body(createErrorResponse("图片总大小不能超过100MB"));
                }

                String format = getFileExtension(filename);
                imageDataList.add(new ImageData(
                    file.getBytes(), 
                    format, 
                    filename
                ));
                
                System.out.println("  [" + (i + 1) + "] " + filename + 
                                 " (" + (file.getSize() / 1024) + " KB)");
            }

            if (imageDataList.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(createErrorResponse("没有有效的图片文件"));
            }

            // 批量转换
            byte[] pdfBytes = imageToPdfService.convertImagesToPdf(imageDataList);

            long duration = System.currentTimeMillis() - startTime;

            // 保存PDF
            File tempDir = new File(TEMP_DIR);
            if (!tempDir.exists()) {
                tempDir.mkdirs();
            }

            String pdfFileName = UUID.randomUUID().toString() + "_merged_" + 
                                imageDataList.size() + "pages.pdf";
            File pdfFile = new File(tempDir, pdfFileName);

            try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                fos.write(pdfBytes);
            }

            System.out.println("========================================");
            System.out.println("批量转换成功！");
            System.out.println("图片数量: " + imageDataList.size());
            System.out.println("总耗时: " + duration + " ms");
            System.out.println("平均: " + (duration / imageDataList.size()) + " ms/图");
            System.out.println("PDF大小: " + (pdfBytes.length / 1024) + " KB");
            System.out.println("========================================");

            // 返回JSON响应
            Map<String, Object> response = new HashMap<>();
            response.put("url", "/download/" + pdfFileName);
            response.put("filename", pdfFileName);
            response.put("size", pdfBytes.length);
            response.put("pages", imageDataList.size());
            response.put("duration", duration + "ms");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("批量转换失败: " + e.getMessage()));
        }
    }

    /**
     * 获取服务状态
     */
    @GetMapping("/image/topdf/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> response = new HashMap<>();
        response.put("service", "Image to PDF Converter (PDFBox)");
        response.put("version", "2.0");
        response.put("status", imageToPdfService.getStatus());
        response.put("features", new String[]{
            "高性能转换（毫秒级）",
            "完美保留图片质量",
            "自动适配页面大小",
            "支持批量合并",
            "支持多种格式（jpg, png, gif, bmp, tiff, webp）",
            "智能DPI处理（300 DPI）"
        });
        response.put("supported_formats", new String[]{
            "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"
        });
        return ResponseEntity.ok(response);
    }

    /**
     * 检查是否为图片文件
     */
    private boolean isImageFile(String filename) {
        String lowerCaseFilename = filename.toLowerCase();
        return lowerCaseFilename.endsWith(".jpg") ||
               lowerCaseFilename.endsWith(".jpeg") ||
               lowerCaseFilename.endsWith(".png") ||
               lowerCaseFilename.endsWith(".gif") ||
               lowerCaseFilename.endsWith(".bmp") ||
               lowerCaseFilename.endsWith(".tiff") ||
               lowerCaseFilename.endsWith(".tif") ||
               lowerCaseFilename.endsWith(".webp");
    }

    /**
     * 获取文件扩展名
     */
    private String getFileExtension(String filename) {
        int lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < filename.length() - 1) {
            return filename.substring(lastDotIndex + 1).toLowerCase();
        }
        return "";
    }

    /**
     * 获取文件基础名（无扩展名）
     */
    private String getBaseName(String filename) {
        int lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex > 0) {
            return filename.substring(0, lastDotIndex);
        }
        return filename;
    }

    /**
     * 创建错误响应
     */
    private Map<String, String> createErrorResponse(String errorMessage) {
        Map<String, String> error = new HashMap<>();
        error.put("error", errorMessage);
        return error;
    }

    // ========================================
    // Session式批量上传API（用于小程序多图片合并）
    // ========================================

    /**
     * 初始化上传会话
     * 返回会话ID，用于后续上传
     */
    @PostMapping("/image/topdf/session/init")
    public ResponseEntity<?> initSession() {
        try {
            String sessionId = sessionManager.createSession();
            Map<String, Object> response = new HashMap<>();
            response.put("id", sessionId);
            response.put("message", "会话已创建");
            
            System.out.println("========================================");
            System.out.println("初始化上传会话: " + sessionId);
            System.out.println("========================================");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(createErrorResponse("创建会话失败: " + e.getMessage()));
        }
    }

    /**
     * 上传单张图片到会话
     * 
     * @param sessionId 会话ID
     * @param index 图片索引（用于排序）
     * @param file 图片文件
     */
    @PostMapping("/image/topdf/session/upload")
    public ResponseEntity<?> uploadToSession(
            @RequestParam("id") String sessionId,
            @RequestParam("index") int index,
            @RequestParam("file") MultipartFile file) {
        try {
            // 获取会话
            com.pdftool.service.ImageUploadSession session = sessionManager.getSession(sessionId);
            if (session == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(createErrorResponse("会话不存在或已过期"));
            }

            // 验证文件
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(createErrorResponse("文件为空"));
            }

            String filename = file.getOriginalFilename();
            if (filename == null || !isImageFile(filename)) {
                return ResponseEntity.badRequest()
                    .body(createErrorResponse("不支持的文件格式"));
            }

            // 文件大小限制：单张20MB
            if (file.getSize() > 20 * 1024 * 1024) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(createErrorResponse("文件大小不能超过20MB"));
            }

            // 添加到会话
            session.addImage(index, file.getBytes(), filename);
            
            System.out.println("[会话 " + sessionId + "] 上传图片 #" + index + ": " + filename + 
                " (" + (file.getSize() / 1024) + " KB)");

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("index", index);
            response.put("count", session.getImageCount());
            
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(createErrorResponse("上传失败: " + e.getMessage()));
        }
    }

    /**
     * 提交会话，合并所有图片为一个PDF
     * 
     * @param sessionId 会话ID
     */
    @PostMapping("/image/topdf/session/commit")
    public ResponseEntity<?> commitSession(@RequestParam("id") String sessionId) {
        try {
            // 获取会话
            com.pdftool.service.ImageUploadSession session = sessionManager.getSession(sessionId);
            if (session == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(createErrorResponse("会话不存在或已过期"));
            }

            List<com.pdftool.service.ImageUploadSession.ImageItem> images = session.getImages();
            if (images.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(createErrorResponse("没有上传任何图片"));
            }

            // 检查数量限制（35张）
            if (images.size() > 35) {
                return ResponseEntity.badRequest()
                    .body(createErrorResponse("图片数量不能超过35张"));
            }

            System.out.println("========================================");
            System.out.println("[会话 " + sessionId + "] 开始合并转换");
            System.out.println("图片数量: " + images.size());
            System.out.println("========================================");

            // 按索引排序
            session.sortImages();

            // 转换为ImageData列表
            List<ImageData> imageDataList = new ArrayList<>();
            for (com.pdftool.service.ImageUploadSession.ImageItem item : images) {
                String format = getFileExtension(item.getFilename());
                imageDataList.add(new ImageData(item.getData(), format, item.getFilename()));
            }

            // 调用转换服务
            long startTime = System.currentTimeMillis();
            byte[] pdfBytes = imageToPdfService.convertImagesToPdf(imageDataList);
            long duration = System.currentTimeMillis() - startTime;

            // 保存PDF到临时目录
            File tempDir = new File(TEMP_DIR);
            if (!tempDir.exists()) {
                tempDir.mkdirs();
            }

            String pdfFileName = UUID.randomUUID().toString() + "_merged_images.pdf";
            File pdfFile = new File(tempDir, pdfFileName);

            try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                fos.write(pdfBytes);
            }

            // 清理会话
            sessionManager.removeSession(sessionId);

            System.out.println("========================================");
            System.out.println("[会话 " + sessionId + "] 合并转换完成");
            System.out.println("输出文件: " + pdfFileName);
            System.out.println("总耗时: " + duration + " ms");
            System.out.println("PDF大小: " + (pdfBytes.length / 1024) + " KB");
            System.out.println("========================================");

            // 返回响应
            Map<String, Object> response = new HashMap<>();
            response.put("url", "/download/" + pdfFileName);
            response.put("filename", pdfFileName);
            response.put("size", pdfBytes.length);
            response.put("pages", images.size());
            response.put("duration", duration + "ms");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            // 清理会话
            sessionManager.removeSession(sessionId);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(createErrorResponse("合并转换失败: " + e.getMessage()));
        }
    }

    /**
     * 取消会话
     * 
     * @param sessionId 会话ID
     */
    @PostMapping("/image/topdf/session/cancel")
    public ResponseEntity<?> cancelSession(@RequestParam("id") String sessionId) {
        try {
            sessionManager.removeSession(sessionId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "会话已取消");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(createErrorResponse("取消会话失败: " + e.getMessage()));
        }
    }
}

