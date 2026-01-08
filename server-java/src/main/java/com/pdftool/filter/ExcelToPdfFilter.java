package com.pdftool.filter;

import org.jodconverter.core.office.OfficeContext;
import org.jodconverter.local.filter.Filter;
import org.jodconverter.local.filter.FilterChain;

import com.sun.star.beans.PropertyValue;
import com.sun.star.beans.XPropertySet;
import com.sun.star.beans.XPropertySetInfo;
import com.sun.star.container.XNameAccess;
import com.sun.star.lang.XComponent;
import com.sun.star.sheet.XSpreadsheetDocument;
import com.sun.star.style.XStyleFamiliesSupplier;
import com.sun.star.uno.UnoRuntime;

/**
 * Excel转PDF优化过滤器
 * 
 * 功能：
 * 1. 设置页面缩放（所有列缩放到一页宽度，参考 test.pdf）
 * 2. 保持Excel原有的页面方向、边距等设置
 * 3. 不强制修改打印区域，使用Excel原有的设置
 * 
 * 设计原则：
 * - 最小化干预，保持Excel原有布局
 * - 只做必要的列宽缩放优化
 * - 避免产生空白页
 * 
 * @author PDFTool
 * @version 3.0
 */
public class ExcelToPdfFilter implements Filter {

    @Override
    public void doFilter(OfficeContext context, XComponent document, FilterChain chain) throws Exception {
        System.out.println("[ExcelToPdfFilter] 过滤器被调用");
        
        XSpreadsheetDocument spreadsheet = UnoRuntime.queryInterface(XSpreadsheetDocument.class, document);

        if (spreadsheet != null) {
            System.out.println("[ExcelToPdfFilter] 检测到 Calc 文档，开始应用页面设置（参考 test.pdf）...");
            
            // 只配置页面样式（列宽缩放），不修改其他设置
            configurePageStyles(spreadsheet);
            
            // 不修改打印区域，使用Excel原有的设置（避免产生空白页）
        } else {
            System.out.println("[ExcelToPdfFilter] ⚠️ 警告: 文档不是 Calc 文档，跳过处理");
        }

        // 继续过滤器链
        chain.doFilter(context, document);
    }
    
    /**
     * 配置页面样式（缩放设置）
     */
    private void configurePageStyles(XSpreadsheetDocument spreadsheet) throws Exception {
        XStyleFamiliesSupplier styleFamiliesSupplier = UnoRuntime.queryInterface(
            XStyleFamiliesSupplier.class, spreadsheet);

        if (styleFamiliesSupplier != null) {
            XNameAccess styleFamilies = styleFamiliesSupplier.getStyleFamilies();

            if (styleFamilies != null && styleFamilies.hasByName("PageStyles")) {
                Object pageStylesObj = styleFamilies.getByName("PageStyles");
                XNameAccess pageStyles = UnoRuntime.queryInterface(XNameAccess.class, pageStylesObj);

                if (pageStyles != null) {
                    int configuredCount = 0;
                    for (String styleName : pageStyles.getElementNames()) {
                        Object styleObj = pageStyles.getByName(styleName);
                        XPropertySet props = UnoRuntime.queryInterface(XPropertySet.class, styleObj);

                        if (props != null) {
                            XPropertySetInfo propInfo = props.getPropertySetInfo();

                                if (propInfo != null) {
                                // 核心设置：所有列缩放到1页宽度（参考 test.pdf）
                                if (propInfo.hasPropertyByName("ScaleToPagesX")) {
                                    props.setPropertyValue("ScaleToPagesX", (short) 1);
                                }
                                
                                // 高度自动（不限制），让内容自然分页，避免空白页
                                if (propInfo.hasPropertyByName("ScaleToPagesY")) {
                                    props.setPropertyValue("ScaleToPagesY", (short) 0);
                                }
                                
                                // 不使用工作表缩放，使用页面样式缩放
                                if (propInfo.hasPropertyByName("UseSheetScale")) {
                                    props.setPropertyValue("UseSheetScale", Boolean.FALSE);
                                }
                                
                                // 重要：不修改页面方向、边距等其他设置，保持Excel原有布局
                                // 不设置 PrintOrientation，保持原有方向
                                // 不设置 PrintEmptyPages，使用Excel原有设置
                                
                                configuredCount++;
                                System.out.println("[ExcelToPdfFilter] ✓ 页面样式 '" + styleName + 
                                    "' 已配置：列宽缩放=1页，高度=自动，保持原有布局");
                            }
                        }
                    }
                    System.out.println("[ExcelToPdfFilter] ✅ 共配置了 " + configuredCount + " 个页面样式");
                }
            }
        }
    }
    
    // 注意：已移除 configurePrintArea 方法
    // 原因：不修改打印区域，使用Excel原有的设置，避免产生空白页
    // Excel文件本身已经定义了正确的打印区域，我们不应该覆盖它
    
    /**
     * 创建PDF导出选项（跳过空白页）
     * 
     * 注意：这个方法目前不会被调用，因为JodConverter的过滤器无法直接设置PDF导出选项
     * PDF导出选项需要在转换时通过PropertyValue数组传递
     * 但我们可以通过设置页面样式来间接影响PDF输出
     */
    @SuppressWarnings("unused")
    private PropertyValue[] createPdfExportOptions() {
        return new PropertyValue[] {
            // 跳过空白页
            createPropertyValue("IsSkipEmptyPages", true),
            // 只打印有内容的区域
            createPropertyValue("PrintRange", true)
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

