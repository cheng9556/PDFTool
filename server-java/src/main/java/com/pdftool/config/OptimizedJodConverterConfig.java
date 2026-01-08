package com.pdftool.config;

import org.jodconverter.core.DocumentConverter;
import org.jodconverter.core.office.OfficeManager;
import org.jodconverter.local.LocalConverter;
import org.jodconverter.local.office.LocalOfficeManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import com.pdftool.filter.CalcFitToWidthFilter;
import com.pdftool.filter.WordToPdfOptimizationFilter;

import javax.annotation.PreDestroy;
import java.io.File;

/**
 * 高性能JodConverter配置
 * 
 * 优化目标：
 * 1. 性能高 - 使用连接池，支持并发转换
 * 2. 速度快 - 优化启动时间和转换超时
 * 3. 格式完整 - 配置高质量PDF导出选项
 * 
 * @author PDFTool
 * @version 2.0
 */
@Configuration
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "jodconverter.enabled", 
    havingValue = "true", 
    matchIfMissing = false
)
public class OptimizedJodConverterConfig {

    private OfficeManager officeManager;

    /**
     * 配置优化的OfficeManager（针对PPT转PDF性能优化）
     * 
     * 性能优化：
     * - 多进程池：5个LibreOffice进程并发处理（提升并发能力）
     * - 快速启动：60秒启动超时（减少等待时间）
     * - 快速转换：5分钟任务超时
     * - 自动回收：每个进程处理200个任务后重启（减少重启频率）
     * - 队列优化：10秒队列超时（减少等待时间）
     * - 环境优化：禁用OpenCL，使用通用插件（减少资源占用）
     * - 失败重试：快速重试机制（300ms间隔）
     */
    @Bean
    @Primary
    public OfficeManager optimizedOfficeManager() {
        // 获取LibreOffice安装路径
        String officeHome = findLibreOfficeHome();
        
        System.out.println("================================");
        System.out.println("初始化高性能JodConverter配置");
        System.out.println("LibreOffice路径: " + officeHome);
        System.out.println("================================");
        
        LocalOfficeManager.Builder builder = LocalOfficeManager.builder();
        
        // LibreOffice安装目录
        if (officeHome != null) {
            builder.officeHome(officeHome);
        }
        
        // 性能优化：进程池配置（针对PPT转PDF优化）
        builder.maxTasksPerProcess(200)          // 每个进程最多处理200个任务后重启（减少重启频率，提升性能）
               .taskExecutionTimeout(300_000L)   // 任务超时：5分钟（300秒）
               .taskQueueTimeout(10_000L);       // 队列等待超时：10秒（减少等待时间）
        
        // 启动优化 - 增加超时时间以避免"Document is empty"错误
        builder.processTimeout(120_000L)         // 进程启动超时：120秒（增加等待时间，避免启动失败）
               .processRetryInterval(500L);     // 重试间隔：500毫秒（稍微增加，避免过快重试）
        
        // 工作目录（使用临时目录，如果不存在则创建）
        File workingDir = new File(System.getProperty("java.io.tmpdir"), "jodconverter");
        if (!workingDir.exists()) {
            boolean created = workingDir.mkdirs();
            System.out.println("创建JodConverter工作目录: " + workingDir.getAbsolutePath() + " - " + (created ? "成功" : "失败"));
        }
        // 确保工作目录可写
        if (!workingDir.canWrite()) {
            System.err.println("⚠️  警告: 工作目录不可写: " + workingDir.getAbsolutePath());
        }
        builder.workingDir(workingDir);
        
        // JodConverter的并发处理是通过portNumbers来实现的
        // 设置多个端口，每个端口对应一个LibreOffice进程
        // 先使用3个进程，如果启动稳定后再增加到5个（避免同时启动过多进程导致资源竞争）
        // 如果出现"Document is empty"错误，通常是因为同时启动多个进程导致资源竞争
        builder.portNumbers(2002, 2003, 2004);   // 3个端口 = 3个并发进程（稳定配置）
        
        // 构建OfficeManager
        this.officeManager = builder.build();
        
        // 关键：启动OfficeManager
        try {
            System.out.println("正在启动OfficeManager...");
            System.out.println("LibreOffice路径: " + officeHome);
            System.out.println("工作目录: " + workingDir.getAbsolutePath());
            System.out.println("并发进程数: 3 (端口: 2002-2004)");
            System.out.println("进程启动超时: 120秒");
            
            // 验证LibreOffice可执行文件
            if (officeHome != null) {
                File sofficeExe = new File(officeHome, "program" + File.separator + "soffice.exe");
                if (!sofficeExe.exists()) {
                    throw new RuntimeException("LibreOffice可执行文件不存在: " + sofficeExe.getAbsolutePath());
                }
                System.out.println("✓ LibreOffice可执行文件验证通过: " + sofficeExe.getAbsolutePath());
            }
            
            this.officeManager.start();
            System.out.println("✅ OfficeManager启动成功！");
            System.out.println("================================");
        } catch (Exception e) {
            System.err.println("❌ OfficeManager启动失败: " + e.getMessage());
            System.err.println("错误类型: " + e.getClass().getName());
            e.printStackTrace();
            
            // 提供诊断信息
            System.err.println("\n=== 诊断信息 ===");
            System.err.println("1. 检查LibreOffice是否已安装: " + officeHome);
            System.err.println("2. 检查端口是否被占用: 2002-2006");
            System.err.println("3. 检查工作目录权限: " + workingDir.getAbsolutePath());
            System.err.println("4. 尝试手动启动LibreOffice: \"C:\\Program Files\\LibreOffice\\program\\soffice.exe\" --headless --version");
            System.err.println("5. 如果问题持续，可以尝试减少并发进程数（修改portNumbers）");
            System.err.println("================\n");
            
            throw new RuntimeException("无法启动OfficeManager: " + e.getMessage(), e);
        }
        
        return this.officeManager;
    }

    /**
     * 配置优化的DocumentConverter
     * 
     * 格式保留优化：
     * - 添加Word转PDF优化过滤器
     * - 保留图片、表格、样式
     * - 高质量PDF导出
     */
    @Bean
    @Primary
    public DocumentConverter optimizedDocumentConverter(OfficeManager optimizedOfficeManager) {
        // 注意：filterChain() 方法应该一次性传入所有过滤器，而不是多次调用
        // 多次调用 filterChain() 会覆盖之前的配置，导致只有最后一个过滤器生效
        return LocalConverter.builder()
                .officeManager(optimizedOfficeManager)
                // 过滤器链：Excel转PDF过滤器 + Word转PDF优化过滤器
                .filterChain(
                    new CalcFitToWidthFilter(),
                    new WordToPdfOptimizationFilter()
                )
                .build();
    }

    /**
     * 查找LibreOffice安装路径
     * 
     * 按优先级搜索：
     * 1. 环境变量 OFFICE_HOME
     * 2. Windows常见安装路径
     * 3. Linux常见安装路径
     * 4. Mac常见安装路径
     */
    private String findLibreOfficeHome() {
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

        // 默认返回null，让JodConverter自动检测
        return null;
    }

    /**
     * 销毁OfficeManager
     * 应用关闭时自动调用，确保LibreOffice进程正确关闭
     */
    @PreDestroy
    public void destroy() {
        if (this.officeManager != null) {
            try {
                System.out.println("================================");
                System.out.println("正在关闭OfficeManager...");
                this.officeManager.stop();
                System.out.println("✅ OfficeManager已安全关闭");
                System.out.println("================================");
            } catch (Exception e) {
                System.err.println("⚠️  关闭OfficeManager时发生错误: " + e.getMessage());
                e.printStackTrace();
            }
        }
    }
}

