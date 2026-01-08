package com.pdftool.service;

import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * LibreOffice命令行转换服务
 * 
 * 使用方案A：直接调用LibreOffice命令行，绕过JodConverter
 * 
 * 优势：
 * - 速度最快：直接调用soffice命令，无JodConverter开销
 * - 稳定性高：使用LibreOffice原生转换，与命令行一致
 * - 资源占用低：无需维护进程池
 * - 配置简单：无需复杂的环境变量配置
 * 
 * @author PDFTool
 * @version 1.0
 */
@Service
public class LibreOfficeCliService {

    private static final String LIBREOFFICE_HOME = findLibreOfficeHome();
    private static final String SOFFICE_EXE = LIBREOFFICE_HOME != null 
            ? LIBREOFFICE_HOME + File.separator + "program" + File.separator + "soffice.exe"
            : "soffice"; // 如果在PATH中，直接使用

    /**
     * 使用LibreOffice命令行转换PPT到PDF
     * 
     * @param pptBytes PPT文件字节数组
     * @param inputExtension 输入文件扩展名（.ppt或.pptx）
     * @return PDF文件字节数组
     * @throws IOException IO错误
     * @throws TimeoutException 超时错误
     * @throws InterruptedException 中断错误
     */
    public byte[] convertPptToPdf(byte[] pptBytes, String inputExtension) 
            throws IOException, TimeoutException, InterruptedException {
        
        long startTime = System.currentTimeMillis();
        Path tempInputFile = null;
        Path tempOutputDir = null;
        
        try {
            // 1. 创建临时目录和文件（优化：使用更快的I/O）
            tempOutputDir = Files.createTempDirectory("ppt2pdf_");
            tempInputFile = Files.createTempFile("input_", inputExtension);
            
            // 2. 写入输入文件（优化：使用NIO快速写入，避免缓冲）
            Files.write(tempInputFile, pptBytes);
            
            // 3. 构建命令行（优化：添加性能参数，减少初始化时间）
            // 参考成功的命令行: soffice.exe --headless --convert-to pdf --outdir D:\ file.pptx
            // 添加 --nodefault 和 --nolockcheck 以加快启动速度
            ProcessBuilder pb = new ProcessBuilder(
                SOFFICE_EXE,
                "--headless",                    // 无界面模式（必需）
                "--nodefault",                   // 不加载默认文档（加快启动）
                "--nolockcheck",                 // 不检查文件锁定（加快启动）
                "--convert-to", "pdf",           // 转换为PDF
                "--outdir", tempOutputDir.toString(),  // 输出目录
                tempInputFile.toAbsolutePath().toString()  // 输入文件（使用绝对路径）
            );
            
            // 4. 设置性能优化环境变量（加快LibreOffice启动和转换速度）
            pb.environment().put("SAL_USE_VCLPLUGIN", "gen");  // 使用通用VCL插件（更快）
            pb.environment().put("SAL_DISABLE_OPENCL", "1");   // 禁用OpenCL（避免初始化延迟）
            
            // 5. 设置工作目录（优先使用LibreOffice程序目录）
            File programDir = LIBREOFFICE_HOME != null 
                ? new File(LIBREOFFICE_HOME, "program")
                : null;
            if (programDir != null && programDir.exists()) {
                pb.directory(programDir);
            }
            
            // 6. 重定向错误输出到空（减少I/O开销，只在错误时读取）
            pb.redirectErrorStream(true);
            
            // 7. 启动进程（优化：减少启动开销）
            long processStart = System.currentTimeMillis();
            final Process process;
            try {
                process = pb.start();
            } catch (IOException e) {
                String workDir = pb.directory() != null ? pb.directory().getAbsolutePath() : "未设置";
                throw new IOException("无法启动LibreOffice进程: " + e.getMessage() + 
                    "\n可执行文件: " + SOFFICE_EXE + 
                    "\n工作目录: " + workDir, e);
            }
            
            // 8. 异步读取输出（优化：只在错误时收集输出，减少字符串操作）
            final StringBuilder errorOutput = new StringBuilder();
            final java.util.concurrent.atomic.AtomicBoolean hasError = new java.util.concurrent.atomic.AtomicBoolean(false);
            
            // 启动输出读取线程（优化：减少日志输出，只在错误时记录）
            Thread outputThread = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(process.getInputStream(), "UTF-8"))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        // 只记录错误信息，不打印所有输出（性能优化）
                        if (line.contains("Error") || line.contains("error") || 
                            line.contains("Could not") || line.contains("failed") ||
                            line.contains("Exception") || line.contains("Fatal")) {
                            hasError.set(true);
                            errorOutput.append(line).append("\n");
                        }
                    }
                } catch (IOException e) {
                    // 静默处理，避免日志开销
                }
            });
            outputThread.setDaemon(true); // 设置为守护线程，避免阻塞JVM退出
            outputThread.start();
            
            // 9. 等待进程完成（优化：根据文件大小动态计算超时，更精确）
            // 经验值：小文件（<1MB）约5-10秒，大文件（>10MB）约30-60秒
            int fileSizeKB = pptBytes.length / 1024;
            long timeoutSeconds;
            if (fileSizeKB < 1024) {
                timeoutSeconds = 15; // 小于1MB：15秒
            } else if (fileSizeKB < 5120) {
                timeoutSeconds = 30; // 1-5MB：30秒
            } else if (fileSizeKB < 10240) {
                timeoutSeconds = 60; // 5-10MB：60秒
            } else {
                timeoutSeconds = Math.min(180, fileSizeKB / 100); // 大于10MB：按100KB/秒计算，最多3分钟
            }
            
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            
            // 等待输出线程完成（优化：减少等待时间到500ms）
            try {
                outputThread.join(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            
            if (!finished) {
                process.destroyForcibly();
                // 等待进程真正终止（优化：减少等待时间）
                try {
                    process.waitFor(1, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                throw new TimeoutException("LibreOffice转换超时（" + timeoutSeconds + "秒）" +
                    (errorOutput.length() > 0 ? "\n错误: " + errorOutput.toString() : ""));
            }
            
            int exitCode = process.exitValue();
            long processDuration = System.currentTimeMillis() - processStart;
            
            if (exitCode != 0) {
                String errorMsg = "LibreOffice转换失败，退出码: " + exitCode;
                
                // 检查是否是常见的错误退出码
                if (exitCode < 0) {
                    errorMsg += " (进程异常终止，可能是崩溃或被强制终止)";
                } else if (exitCode == 1) {
                    errorMsg += " (一般错误)";
                } else if (exitCode == 2) {
                    errorMsg += " (参数错误)";
                }
                
                if (errorOutput.length() > 0) {
                    errorMsg += "\n错误信息:\n" + errorOutput.toString();
                }
                
                // 添加诊断信息
                errorMsg += "\n诊断信息:";
                errorMsg += "\n  - 可执行文件: " + SOFFICE_EXE;
                if (pb.directory() != null) {
                    errorMsg += "\n  - 工作目录: " + pb.directory().getAbsolutePath();
                }
                errorMsg += "\n  - 输入文件: " + tempInputFile.toAbsolutePath();
                errorMsg += "\n  - 输出目录: " + tempOutputDir.toString();
                if (LIBREOFFICE_HOME != null) {
                    errorMsg += "\n  - LibreOffice路径: " + LIBREOFFICE_HOME;
                }
                
                throw new IOException(errorMsg);
            }
            
            // 10. 查找生成的PDF文件（优化：直接构造文件名，避免文件系统遍历）
            String inputFileName = tempInputFile.getFileName().toString();
            String pdfFileName = inputFileName.substring(0, inputFileName.lastIndexOf('.')) + ".pdf";
            Path pdfFile = tempOutputDir.resolve(pdfFileName);
            
            if (!Files.exists(pdfFile)) {
                // 尝试查找任何PDF文件（优化：只查找一次）
                File[] pdfFiles = tempOutputDir.toFile().listFiles((dir, name) -> name.endsWith(".pdf"));
                if (pdfFiles != null && pdfFiles.length > 0) {
                    pdfFile = pdfFiles[0].toPath();
                } else {
                    throw new IOException("未找到生成的PDF文件" +
                        (errorOutput.length() > 0 ? "\n错误: " + errorOutput.toString() : ""));
                }
            }
            
            // 11. 读取PDF文件（优化：使用NIO快速读取）
            byte[] pdfBytes = Files.readAllBytes(pdfFile);
            
            long totalDuration = System.currentTimeMillis() - startTime;
            
            // 精简日志输出（只在成功时输出关键信息）
            System.out.println(String.format("[LibreOffice CLI] ✅ 转换成功 | 输入: %.1f KB | 输出: %.1f KB | 耗时: %d ms (进程: %d ms)",
                pptBytes.length / 1024.0, pdfBytes.length / 1024.0, totalDuration, processDuration));
            
            return pdfBytes;
            
        } finally {
            // 12. 清理临时文件（优化：使用更高效的删除方式，后台异步清理）
            try {
                if (tempInputFile != null) {
                    Files.deleteIfExists(tempInputFile);
                }
                if (tempOutputDir != null) {
                    // 优化：先删除目录中的文件，再删除目录（避免Files.walk的开销）
                    File[] files = tempOutputDir.toFile().listFiles();
                    if (files != null) {
                        for (File file : files) {
                            file.delete(); // 静默删除，不抛出异常
                        }
                    }
                    Files.deleteIfExists(tempOutputDir);
                }
            } catch (IOException e) {
                // 静默处理清理错误，避免日志开销
            }
        }
    }

    /**
     * 查找LibreOffice安装路径
     */
    private static String findLibreOfficeHome() {
        // 1. 环境变量
        String envOfficeHome = System.getenv("OFFICE_HOME");
        if (envOfficeHome != null && new File(envOfficeHome).exists()) {
            return envOfficeHome;
        }

        // 2. Windows常见路径
        String[] windowsPaths = {
            "C:\\Program Files\\LibreOffice",
            "C:\\Program Files (x86)\\LibreOffice",
            "C:\\LibreOffice"
        };

        for (String path : windowsPaths) {
            if (new File(path).exists()) {
                return path;
            }
        }

        // 3. Linux常见路径
        String[] linuxPaths = {
            "/usr/lib/libreoffice",
            "/usr/lib64/libreoffice",
            "/opt/libreoffice",
            "/usr/local/lib/libreoffice"
        };

        for (String path : linuxPaths) {
            if (new File(path).exists()) {
                return path;
            }
        }

        // 4. Mac常见路径
        String macPath = "/Applications/LibreOffice.app/Contents";
        if (new File(macPath).exists()) {
            return macPath;
        }

        // 5. 如果在PATH中，返回null（使用系统soffice）
        return null;
    }

    /**
     * 检查LibreOffice是否可用
     */
    public boolean isAvailable() {
        if (LIBREOFFICE_HOME != null) {
            File sofficeExe = new File(SOFFICE_EXE);
            return sofficeExe.exists() && sofficeExe.canExecute();
        }
        
        // 检查是否在PATH中
        try {
            Process process = new ProcessBuilder("soffice", "--version").start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            if (finished && process.exitValue() == 0) {
                return true;
            }
        } catch (Exception e) {
            // 忽略
        }
        
        return false;
    }
}

