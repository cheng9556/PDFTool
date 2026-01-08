package com.pdftool.filter;

import org.jodconverter.core.office.OfficeContext;
import org.jodconverter.local.filter.Filter;
import org.jodconverter.local.filter.FilterChain;

import com.sun.star.beans.XPropertySet;
import com.sun.star.beans.XPropertySetInfo;
import com.sun.star.container.XNameAccess;
import com.sun.star.lang.XComponent;
import com.sun.star.sheet.XSpreadsheetDocument;
import com.sun.star.style.XStyleFamiliesSupplier;
import com.sun.star.uno.UnoRuntime;

/**
 * Excel转PDF过滤器
 * 
 * 功能：
 * - 设置横向页面（Landscape）以充分利用页面宽度
 * - 减小页边距
 * - 设置 ScaleToPagesX=1（列缩放到1页宽度）
 */
public class CalcFitToWidthFilter implements Filter {

    // 页边距设置（单位：1/100 mm）
    private static final int MARGIN_MM = 500; // 5mm = 500/100mm

    @Override
    public void doFilter(OfficeContext context, XComponent document, FilterChain chain) throws Exception {
        System.out.println("[CalcFitToWidthFilter] === 过滤器开始执行 ===");
        
        XSpreadsheetDocument spreadsheet = UnoRuntime.queryInterface(XSpreadsheetDocument.class, document);

        if (spreadsheet != null) {
            System.out.println("[CalcFitToWidthFilter] 检测到 Calc 文档");
            XStyleFamiliesSupplier styleFamiliesSupplier = UnoRuntime.queryInterface(
                XStyleFamiliesSupplier.class, spreadsheet);

            if (styleFamiliesSupplier != null) {
                XNameAccess styleFamilies = styleFamiliesSupplier.getStyleFamilies();

                if (styleFamilies != null && styleFamilies.hasByName("PageStyles")) {
                    Object pageStylesObj = styleFamilies.getByName("PageStyles");
                    XNameAccess pageStyles = UnoRuntime.queryInterface(XNameAccess.class, pageStylesObj);

                    if (pageStyles != null) {
                        for (String styleName : pageStyles.getElementNames()) {
                            Object styleObj = pageStyles.getByName(styleName);
                            XPropertySet props = UnoRuntime.queryInterface(XPropertySet.class, styleObj);

                            if (props != null) {
                                XPropertySetInfo propInfo = props.getPropertySetInfo();
                                if (propInfo != null) {
                                    
                                    // 1. 设置横向页面（Landscape）
                                    if (propInfo.hasPropertyByName("IsLandscape")) {
                                        props.setPropertyValue("IsLandscape", true);
                                    }
                                    
                                    // 2. 设置页边距（减小边距让内容更充分利用页面）
                                    if (propInfo.hasPropertyByName("LeftMargin")) {
                                        props.setPropertyValue("LeftMargin", MARGIN_MM);
                                    }
                                    if (propInfo.hasPropertyByName("RightMargin")) {
                                        props.setPropertyValue("RightMargin", MARGIN_MM);
                                    }
                                    if (propInfo.hasPropertyByName("TopMargin")) {
                                        props.setPropertyValue("TopMargin", MARGIN_MM);
                                    }
                                    if (propInfo.hasPropertyByName("BottomMargin")) {
                                        props.setPropertyValue("BottomMargin", MARGIN_MM);
                                    }
                                    
                                    // 3. 禁用百分比缩放，使用页数缩放
                                    if (propInfo.hasPropertyByName("PageScale")) {
                                        props.setPropertyValue("PageScale", (short) 0);
                                    }
                                    
                                    // 4. 列缩放到1页宽度
                                    if (propInfo.hasPropertyByName("ScaleToPagesX")) {
                                        props.setPropertyValue("ScaleToPagesX", (short) 1);
                                    }
                                    
                                    // 5. 行不限制（自动分页）
                                    if (propInfo.hasPropertyByName("ScaleToPagesY")) {
                                        props.setPropertyValue("ScaleToPagesY", (short) 0);
                                    }
                                    
                                    System.out.println("[CalcFitToWidthFilter] " + styleName + 
                                        ": Landscape=true, Margin=5mm, Scale(1,0)");
                                }
                            }
                        }
                    }
                }
            }
        }

        System.out.println("[CalcFitToWidthFilter] === 过滤器执行完成 ===");
        chain.doFilter(context, document);
    }
}
