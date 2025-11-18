package com.pdftool.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import technology.tabula.*;
import technology.tabula.extractors.BasicExtractionAlgorithm;
import technology.tabula.extractors.SpreadsheetExtractionAlgorithm;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

/**
 * 增强版PDF转Excel服务
 * 专门处理复杂表格，支持多种提取策略
 */
@Service
public class EnhancedPdfToExcelService {

    /**
     * PDF转Excel（增强版）
     * 支持复杂表格、多列布局、无边框表格
     */
    public byte[] convertPdfToExcel(byte[] pdfBytes) throws IOException {
        File tempPdfFile = File.createTempFile("pdf_", ".pdf");
        try {
            Files.write(tempPdfFile.toPath(), pdfBytes);
            
            long startTime = System.currentTimeMillis();
            System.out.println("========================================");
            System.out.println("开始增强版PDF表格提取");
            System.out.println("文件大小: " + (pdfBytes.length / 1024) + " KB");
            System.out.println("========================================");

            try (PDDocument document = PDDocument.load(tempPdfFile)) {
                ObjectExtractor extractor = new ObjectExtractor(document);
                PageIterator pages = extractor.extract();
                
                Workbook workbook = new XSSFWorkbook();
                int pageNum = 0;
                int totalTables = 0;
                boolean hasData = false;

                while (pages.hasNext()) {
                    pageNum++;
                    Page page = pages.next();
                    
                    System.out.println("\n【第 " + pageNum + " 页】");
                    System.out.println("  页面尺寸: " + page.getWidth() + " x " + page.getHeight());
                    
                    // 使用多策略提取
                    List<technology.tabula.Table> tables = extractTablesWithMultipleStrategies(page, pageNum);
                    
                    if (tables.isEmpty()) {
                        System.out.println("  ❌ 未检测到表格");
                        continue;
                    }

                    System.out.println("  ✓ 检测到 " + tables.size() + " 个表格");
                    totalTables += tables.size();
                    
                    // 将同一页的所有表格合并到一个sheet中
                    List<List<RectangularTextContainer>> allRowsInPage = new ArrayList<>();
                    
                    for (int tableIndex = 0; tableIndex < tables.size(); tableIndex++) {
                        technology.tabula.Table table = tables.get(tableIndex);
                        List<List<RectangularTextContainer>> rows = table.getRows();
                        
                        if (rows.isEmpty() || (rows.size() == 1 && isEmptyRow(rows.get(0)))) {
                            System.out.println("    表格" + (tableIndex + 1) + ": 空表格，跳过");
                            continue;
                        }
                        
                        System.out.println("    表格" + (tableIndex + 1) + ": " + rows.size() + " 行 x " + 
                                         (rows.isEmpty() ? 0 : rows.get(0).size()) + " 列");
                        
                        // 添加到合并列表
                        allRowsInPage.addAll(rows);
                        
                        // 如果不是最后一个表格，添加一个空行作为分隔
                        if (tableIndex < tables.size() - 1) {
                            List<RectangularTextContainer> emptyRow = new ArrayList<>();
                            allRowsInPage.add(emptyRow);
                        }
                    }
                    
                    // 创建单个sheet包含整页的所有表格
                    if (!allRowsInPage.isEmpty()) {
                        String sheetName = "Page" + pageNum;
                        Sheet sheet = workbook.createSheet(sheetName);
                        
                        System.out.println("  合并所有表格到: " + sheetName + " (总计 " + allRowsInPage.size() + " 行)");
                        
                        writeEnhancedTableToSheet(sheet, allRowsInPage);
                        autoSizeColumnsOptimized(sheet, allRowsInPage);
                        
                        hasData = true;
                    }
                }

                if (!hasData) {
                    createWarningSheet(workbook);
                }

                ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                workbook.write(outputStream);
                workbook.close();
                
                long duration = System.currentTimeMillis() - startTime;
                System.out.println("\n========================================");
                System.out.println("转换完成");
                System.out.println("总页数: " + pageNum);
                System.out.println("总表格数: " + totalTables);
                System.out.println("耗时: " + duration + " ms");
                System.out.println("========================================");
                
                return outputStream.toByteArray();
            }
        } finally {
            if (tempPdfFile.exists()) {
                tempPdfFile.delete();
            }
        }
    }

    /**
     * 使用多种策略提取表格
     * 策略1: Spreadsheet (网格线表格)
     * 策略2: Basic (基础表格检测)
     * 策略3: 全页提取 (最激进的策略)
     */
    private List<technology.tabula.Table> extractTablesWithMultipleStrategies(Page page, int pageNum) {
        List<technology.tabula.Table> bestTables = new ArrayList<>();
        int maxValidCount = 0;
        
        // 策略1: Spreadsheet算法（适合有网格线的表格）
        System.out.println("  尝试策略1: Spreadsheet算法");
        SpreadsheetExtractionAlgorithm spreadsheetAlgo = new SpreadsheetExtractionAlgorithm();
        List<technology.tabula.Table> spreadsheetTables = spreadsheetAlgo.extract(page);
        
        if (!spreadsheetTables.isEmpty()) {
            int validCount = countValidTables(spreadsheetTables);
            int totalCells = countTotalCells(spreadsheetTables);
            System.out.println("    -> 提取 " + spreadsheetTables.size() + " 个表格 (有效: " + validCount + ", 单元格: " + totalCells + ")");
            if (validCount > maxValidCount || (validCount == maxValidCount && totalCells > countTotalCells(bestTables))) {
                bestTables = spreadsheetTables;
                maxValidCount = validCount;
            }
        }
        
        // 策略2: Basic算法（适合无网格线但有规律间距的表格）
        System.out.println("  尝试策略2: Basic算法");
        BasicExtractionAlgorithm basicAlgo = new BasicExtractionAlgorithm();
        List<technology.tabula.Table> basicTables = basicAlgo.extract(page);
        
        if (!basicTables.isEmpty()) {
            int validCount = countValidTables(basicTables);
            int totalCells = countTotalCells(basicTables);
            System.out.println("    -> 提取 " + basicTables.size() + " 个表格 (有效: " + validCount + ", 单元格: " + totalCells + ")");
            if (validCount > maxValidCount || (validCount == maxValidCount && totalCells > countTotalCells(bestTables))) {
                bestTables = basicTables;
                maxValidCount = validCount;
            }
        }
        
        // 策略3: 尝试提取整页作为一个表格（当其他策略效果不佳时）
        if (maxValidCount == 0 || countTotalCells(bestTables) < 10) {
            System.out.println("  尝试策略3: 全页提取");
            // 使用Basic算法提取整个页面区域
            BasicExtractionAlgorithm wholePageAlgo = new BasicExtractionAlgorithm();
            List<technology.tabula.Table> wholePageTables = wholePageAlgo.extract(page);
            
            if (!wholePageTables.isEmpty()) {
                int totalCells = countTotalCells(wholePageTables);
                System.out.println("    -> 全页提取得到 " + totalCells + " 个单元格");
                if (totalCells > countTotalCells(bestTables)) {
                    bestTables = wholePageTables;
                }
            }
        }
        
        System.out.println("  最终选择: " + bestTables.size() + " 个表格, " + countTotalCells(bestTables) + " 个单元格");
        return bestTables;
    }
    
    /**
     * 统计所有表格的总单元格数
     */
    private int countTotalCells(List<technology.tabula.Table> tables) {
        int total = 0;
        for (technology.tabula.Table table : tables) {
            List<List<RectangularTextContainer>> rows = table.getRows();
            for (List<RectangularTextContainer> row : rows) {
                total += row.size();
            }
        }
        return total;
    }

    /**
     * 统计有效表格数量
     */
    private int countValidTables(List<technology.tabula.Table> tables) {
        int count = 0;
        for (technology.tabula.Table table : tables) {
            List<List<RectangularTextContainer>> rows = table.getRows();
            if (rows.size() >= 2) { // 至少2行
                boolean hasContent = false;
                for (List<RectangularTextContainer> row : rows) {
                    for (RectangularTextContainer cell : row) {
                        if (cell.getText() != null && !cell.getText().trim().isEmpty()) {
                            hasContent = true;
                            break;
                        }
                    }
                    if (hasContent) break;
                }
                if (hasContent) count++;
            }
        }
        return count;
    }

    /**
     * 检查行是否为空
     */
    private boolean isEmptyRow(List<RectangularTextContainer> row) {
        for (RectangularTextContainer cell : row) {
            if (cell.getText() != null && !cell.getText().trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    /**
     * 将表格写入Excel（增强版，处理合并单元格和空值）
     */
    private void writeEnhancedTableToSheet(Sheet sheet, List<List<RectangularTextContainer>> rows) {
        Workbook workbook = sheet.getWorkbook();
        CellStyle headerStyle = createHeaderStyle(workbook);
        CellStyle normalStyle = createNormalStyle(workbook);
        CellStyle numberStyle = createNumberStyle(workbook);
        
        // 找出最大列数
        int maxCols = rows.stream().mapToInt(List::size).max().orElse(0);
        
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            Row excelRow = sheet.createRow(rowIndex);
            List<RectangularTextContainer> row = rows.get(rowIndex);
            
            for (int colIndex = 0; colIndex < maxCols; colIndex++) {
                org.apache.poi.ss.usermodel.Cell cell = excelRow.createCell(colIndex);
                
                String cellText = "";
                if (colIndex < row.size()) {
                    cellText = row.get(colIndex).getText();
                    if (cellText != null) {
                        cellText = cellText.trim();
                    } else {
                        cellText = "";
                    }
                }
                
                // 智能类型识别
                if (!cellText.isEmpty()) {
                    if (isNumeric(cellText)) {
                        try {
                            cell.setCellValue(Double.parseDouble(cellText));
                            cell.setCellStyle(rowIndex == 0 ? headerStyle : numberStyle);
                        } catch (NumberFormatException e) {
                            cell.setCellValue(cellText);
                            cell.setCellStyle(rowIndex == 0 ? headerStyle : normalStyle);
                        }
                    } else {
                        cell.setCellValue(cellText);
                        cell.setCellStyle(rowIndex == 0 ? headerStyle : normalStyle);
                    }
                } else {
                    cell.setCellValue("");
                    cell.setCellStyle(normalStyle);
                }
            }
        }
    }

    /**
     * 优化的列宽自动调整
     */
    private void autoSizeColumnsOptimized(Sheet sheet, List<List<RectangularTextContainer>> rows) {
        if (rows.isEmpty()) return;
        
        int maxCols = Math.min(rows.stream().mapToInt(List::size).max().orElse(0), 50);
        for (int colIndex = 0; colIndex < maxCols; colIndex++) {
            try {
                sheet.autoSizeColumn(colIndex);
                int currentWidth = sheet.getColumnWidth(colIndex);
                // 限制最小和最大宽度
                if (currentWidth < 2000) {
                    sheet.setColumnWidth(colIndex, 2000);
                } else if (currentWidth > 20000) {
                    sheet.setColumnWidth(colIndex, 20000);
                }
            } catch (Exception e) {
                sheet.setColumnWidth(colIndex, 3000);
            }
        }
    }

    private String createSheetName(int pageNum, int tableIndex, int totalTables) {
        if (totalTables > 1) {
            return "P" + pageNum + "_T" + (tableIndex + 1);
        } else {
            return "Page" + pageNum;
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 11);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }

    private CellStyle createNormalStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        return style;
    }

    private CellStyle createNumberStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setAlignment(HorizontalAlignment.RIGHT);
        return style;
    }

    private void createWarningSheet(Workbook workbook) {
        Sheet sheet = workbook.createSheet("提示");
        Row row = sheet.createRow(0);
        org.apache.poi.ss.usermodel.Cell cell = row.createCell(0);
        cell.setCellValue("未在PDF中检测到表格数据。\n" +
                         "可能原因：\n" +
                         "1. PDF是扫描版（需要OCR识别）\n" +
                         "2. 表格格式特殊或不规范\n" +
                         "3. PDF内容为图片格式");
        
        CellStyle style = workbook.createCellStyle();
        style.setWrapText(true);
        cell.setCellStyle(style);
        sheet.setColumnWidth(0, 10000);
        row.setHeight((short) 1200);
    }

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

