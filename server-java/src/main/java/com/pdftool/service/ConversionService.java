package com.pdftool.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.jodconverter.core.DocumentConverter;
import org.jodconverter.core.document.DefaultDocumentFormatRegistry;
import org.jodconverter.core.document.DocumentFormat;
import org.jodconverter.core.office.OfficeException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import technology.tabula.*;
import technology.tabula.extractors.SpreadsheetExtractionAlgorithm;
import technology.tabula.extractors.BasicExtractionAlgorithm;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.ArrayList;

@Service
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "jodconverter.enabled", 
    havingValue = "true", 
    matchIfMissing = false
)
public class ConversionService {

    @Autowired
    private DocumentConverter documentConverter;

    /**
     * Excel转PDF
     * 使用JodConverter + LibreOffice实现高质量转换
     * 
     * @param excelBytes Excel文件字节数组
     * @return PDF文件字节数组
     */
    public byte[] convertExcelToPdf(byte[] excelBytes) throws IOException, OfficeException {
        try (ByteArrayInputStream inputStream = new ByteArrayInputStream(excelBytes);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            // 检测Excel格式（.xls或.xlsx）
            DocumentFormat inputFormat = detectExcelFormat(excelBytes);
            System.out.println("检测到Excel格式: " + inputFormat.getName() + 
                             " (扩展名: " + inputFormat.getExtension() + ")");

            // 明确指定输入和输出格式（ByteArrayInputStream无法自动检测格式）
            documentConverter.convert(inputStream)
                    .as(inputFormat)  // 输入格式：自动检测的Excel格式
                    .to(outputStream)
                    .as(DefaultDocumentFormatRegistry.PDF)   // 输出格式：PDF
                    .execute();

            return outputStream.toByteArray();
        }
    }

    /**
     * 检测Excel文件格式
     * 通过文件魔数判断是.xls还是.xlsx
     */
    private DocumentFormat detectExcelFormat(byte[] excelBytes) {
        if (excelBytes.length < 4) {
            return DefaultDocumentFormatRegistry.XLSX;  // 默认使用XLSX
        }

        // 检查文件头魔数
        // .xlsx文件是ZIP格式，开头是 PK (0x50 0x4B)
        // .xls文件是OLE2格式，开头是 0xD0 0xCF
        if (excelBytes[0] == 0x50 && excelBytes[1] == 0x4B) {
            return DefaultDocumentFormatRegistry.XLSX;
        } else if ((excelBytes[0] & 0xFF) == 0xD0 && (excelBytes[1] & 0xFF) == 0xCF) {
            return DefaultDocumentFormatRegistry.XLS;
        }

        // 默认使用XLSX
        return DefaultDocumentFormatRegistry.XLSX;
    }

    /**
     * Word转PDF
     * 使用JodConverter + LibreOffice实现高质量转换
     * 支持.doc和.docx格式，保留所有格式、样式和布局
     * 
     * @param wordBytes Word文件字节数组
     * @return PDF文件字节数组
     */
    public byte[] convertWordToPdf(byte[] wordBytes) throws IOException, OfficeException {
        try (ByteArrayInputStream inputStream = new ByteArrayInputStream(wordBytes);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            // 检测Word格式（.doc或.docx）
            DocumentFormat inputFormat = detectWordFormat(wordBytes);
            System.out.println("检测到Word格式: " + inputFormat.getName() + 
                             " (扩展名: " + inputFormat.getExtension() + ")");

            // 执行转换
            long startTime = System.currentTimeMillis();
            documentConverter.convert(inputStream)
                    .as(inputFormat)  // 输入格式：.doc或.docx
                    .to(outputStream)
                    .as(DefaultDocumentFormatRegistry.PDF)  // 输出格式：PDF
                    .execute();

            long duration = System.currentTimeMillis() - startTime;
            System.out.println("Word转PDF完成，耗时: " + duration + " ms, 输出大小: " + 
                             (outputStream.size() / 1024) + " KB");

            return outputStream.toByteArray();
        }
    }

    /**
     * 检测Word文件格式（.doc或.docx）
     * 通过文件魔数判断
     */
    private DocumentFormat detectWordFormat(byte[] wordBytes) {
        if (wordBytes.length < 4) {
            return DefaultDocumentFormatRegistry.DOCX;  // 默认使用DOCX
        }

        // 检查文件头魔数
        // .docx文件是ZIP格式，开头是 PK (0x50 0x4B)
        // .doc文件是OLE2格式，开头是 0xD0 0xCF
        if (wordBytes[0] == 0x50 && wordBytes[1] == 0x4B) {
            return DefaultDocumentFormatRegistry.DOCX;
        } else if ((wordBytes[0] & 0xFF) == 0xD0 && (wordBytes[1] & 0xFF) == 0xCF) {
            return DefaultDocumentFormatRegistry.DOC;
        }

        // 默认使用DOCX
        return DefaultDocumentFormatRegistry.DOCX;
    }

    /**
     * PDF转Excel
     * 使用Tabula库提取PDF中的表格数据，然后生成Excel文件
     * 支持复杂文档，双算法策略（Spreadsheet + Basic备用）
     *
     * @param pdfBytes PDF文件字节数组
     * @return Excel文件字节数组（XLSX）
     */
    public byte[] convertPdfToExcel(byte[] pdfBytes) throws IOException {
        // 创建临时PDF文件（Tabula需要文件路径）
        File tempPdfFile = File.createTempFile("pdf_", ".pdf");
        try {
            // 写入PDF数据到临时文件
            Files.write(tempPdfFile.toPath(), pdfBytes);
            
            long startTime = System.currentTimeMillis();
            System.out.println("开始使用Tabula提取PDF表格 (文件大小: " + (pdfBytes.length / 1024) + " KB)...");

            // 使用Tabula提取表格
            try (org.apache.pdfbox.pdmodel.PDDocument document = 
                    org.apache.pdfbox.pdmodel.PDDocument.load(tempPdfFile)) {
                
                ObjectExtractor extractor = new ObjectExtractor(document);
                PageIterator pages = extractor.extract();
                
                // 创建Excel工作簿
                Workbook workbook = new XSSFWorkbook();
                int pageNum = 0;
                int totalTables = 0;
                boolean hasData = false;

                while (pages.hasNext()) {
                    pageNum++;
                    Page page = pages.next();
                    
                    System.out.println("处理第 " + pageNum + " 页...");
                    
                    // 尝试使用智能算法提取表格
                    List<technology.tabula.Table> tables = extractTablesWithBestAlgorithm(page);
                    
                    if (tables.isEmpty()) {
                        System.out.println("  -> 未检测到表格");
                        continue;
                    }

                    System.out.println("  -> 检测到 " + tables.size() + " 个表格");
                    totalTables += tables.size();
                    
                    for (int tableIndex = 0; tableIndex < tables.size(); tableIndex++) {
                        technology.tabula.Table table = tables.get(tableIndex);
                        List<List<RectangularTextContainer>> rows = table.getRows();
                        
                        // 跳过空表格
                        if (rows.isEmpty()) {
                            System.out.println("  -> 表格 " + (tableIndex + 1) + " 为空，跳过");
                            continue;
                        }
                        
                        // 计算表格信息
                        int maxCols = rows.stream().mapToInt(List::size).max().orElse(0);
                        System.out.println("  -> 表格 " + (tableIndex + 1) + ": " + rows.size() + " 行 x " + maxCols + " 列");
                        
                        // 为每个表格创建一个工作表
                        String sheetName = createSheetName(pageNum, tableIndex, tables.size());
                        Sheet sheet = workbook.createSheet(sheetName);
                        
                        // 将表格数据写入Excel并应用样式
                        writeTableToSheet(sheet, rows, pageNum);
                        
                        // 自动调整列宽（限制最大宽度以提高性能）
                        autoSizeColumns(sheet, rows);
                        
                        hasData = true;
                    }
                }

                if (!hasData) {
                    // 如果没有检测到表格，创建提示工作表
                    createWarningSheet(workbook);
                }

                // 将Excel写入字节数组
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                workbook.write(outputStream);
                workbook.close();
                
                long duration = System.currentTimeMillis() - startTime;
                System.out.println("PDF转Excel完成: " + pageNum + " 页, " + totalTables + 
                                 " 个表格, 耗时 " + duration + " ms");
                return outputStream.toByteArray();
            }
        } finally {
            // 删除临时文件
            if (tempPdfFile.exists()) {
                tempPdfFile.delete();
            }
        }
    }

    /**
     * 使用最佳算法提取表格（智能选择算法）
     */
    private List<technology.tabula.Table> extractTablesWithBestAlgorithm(Page page) {
        List<technology.tabula.Table> tables = new ArrayList<>();
        
        // 策略1: 先尝试Spreadsheet算法（适合有明确网格线的表格）
        SpreadsheetExtractionAlgorithm spreadsheetAlgorithm = new SpreadsheetExtractionAlgorithm();
        tables = spreadsheetAlgorithm.extract(page);
        
        // 策略2: 如果Spreadsheet算法提取的表格质量不高，尝试Basic算法
        if (tables.isEmpty() || isLowQualityExtraction(tables)) {
            System.out.println("  -> 使用Basic算法重新提取");
            BasicExtractionAlgorithm basicAlgorithm = new BasicExtractionAlgorithm();
            List<technology.tabula.Table> basicTables = basicAlgorithm.extract(page);
            
            // 选择提取效果更好的结果
            if (!basicTables.isEmpty() && (tables.isEmpty() || basicTables.size() > tables.size())) {
                tables = basicTables;
            }
        }
        
        return tables;
    }

    /**
     * 判断提取质量是否较低
     */
    private boolean isLowQualityExtraction(List<technology.tabula.Table> tables) {
        if (tables.isEmpty()) {
            return true;
        }
        
        // 检查是否有太多只有1行或1列的表格（可能是误识别）
        int lowQualityCount = 0;
        for (technology.tabula.Table table : tables) {
            List<List<RectangularTextContainer>> rows = table.getRows();
            if (rows.size() < 2 || (rows.size() > 0 && rows.get(0).size() < 2)) {
                lowQualityCount++;
            }
        }
        
        return lowQualityCount > tables.size() / 2;
    }

    /**
     * 创建工作表名称
     */
    private String createSheetName(int pageNum, int tableIndex, int totalTables) {
        // Excel工作表名称限制31个字符
        if (totalTables > 1) {
            return "P" + pageNum + "_T" + (tableIndex + 1);
        } else {
            return "Page" + pageNum;
        }
    }

    /**
     * 将表格数据写入Excel工作表（增强版）
     */
    private void writeTableToSheet(Sheet sheet, List<List<RectangularTextContainer>> rows, int pageNum) {
        CellStyle headerStyle = createHeaderStyle(sheet.getWorkbook());
        CellStyle normalStyle = createNormalStyle(sheet.getWorkbook());
        
        // 找出最大列数，确保所有行有相同的列数
        int maxCols = rows.stream().mapToInt(List::size).max().orElse(0);
        
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            Row excelRow = sheet.createRow(rowIndex);
            List<RectangularTextContainer> row = rows.get(rowIndex);
            
            // 处理每一列，包括空单元格
            for (int colIndex = 0; colIndex < maxCols; colIndex++) {
                org.apache.poi.ss.usermodel.Cell cell = excelRow.createCell(colIndex);
                
                // 获取单元格文本（如果列不存在则为空）
                String cellText = "";
                if (colIndex < row.size()) {
                    cellText = row.get(colIndex).getText();
                    if (cellText != null) {
                        cellText = cellText.trim();
                    } else {
                        cellText = "";
                    }
                }
                
                // 跳过完全空白的单元格
                if (cellText.isEmpty()) {
                    cell.setCellValue("");
                    cell.setCellStyle(normalStyle);
                    continue;
                }
                
                // 尝试识别数字
                if (isNumeric(cellText)) {
                    try {
                        cell.setCellValue(Double.parseDouble(cellText));
                    } catch (NumberFormatException e) {
                        cell.setCellValue(cellText);
                    }
                } else {
                    cell.setCellValue(cellText);
                }
                
                // 第一行应用标题样式
                if (rowIndex == 0) {
                    cell.setCellStyle(headerStyle);
                } else {
                    cell.setCellStyle(normalStyle);
                }
            }
        }
    }

    /**
     * 创建普通单元格样式
     */
    private CellStyle createNormalStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setWrapText(false);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }

    /**
     * 创建标题样式
     */
    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    /**
     * 自动调整列宽（优化性能）
     */
    private void autoSizeColumns(Sheet sheet, List<List<RectangularTextContainer>> rows) {
        if (rows.isEmpty()) {
            return;
        }
        
        int maxCols = Math.min(rows.get(0).size(), 50); // 限制最多50列以提高性能
        for (int colIndex = 0; colIndex < maxCols; colIndex++) {
            try {
                sheet.autoSizeColumn(colIndex);
                // 限制最大列宽
                if (sheet.getColumnWidth(colIndex) > 15000) {
                    sheet.setColumnWidth(colIndex, 15000);
                }
            } catch (Exception e) {
                // 忽略自动调整失败
            }
        }
    }

    /**
     * 创建警告工作表
     */
    private void createWarningSheet(Workbook workbook) {
        Sheet sheet = workbook.createSheet("提示");
        Row row = sheet.createRow(0);
        org.apache.poi.ss.usermodel.Cell cell = row.createCell(0);
        cell.setCellValue("未在PDF中检测到表格数据。\n" +
                         "可能原因：\n" +
                         "1. PDF是扫描版（需要OCR识别）\n" +
                         "2. 表格格式不规范\n" +
                         "3. PDF包含的是图片而非文本");
        
        CellStyle style = workbook.createCellStyle();
        style.setWrapText(true);
        cell.setCellStyle(style);
        sheet.setColumnWidth(0, 10000);
    }

    /**
     * 判断字符串是否为数字
     */
    private boolean isNumeric(String str) {
        if (str == null || str.isEmpty()) {
            return false;
        }
        try {
            Double.parseDouble(str);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}


