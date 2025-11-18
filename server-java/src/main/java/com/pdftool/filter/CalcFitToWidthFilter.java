package com.pdftool.filter;

import org.jodconverter.core.office.OfficeContext;
import org.jodconverter.local.filter.Filter;
import org.jodconverter.local.filter.FilterChain;
import org.jodconverter.local.office.LocalOfficeContext;

import com.sun.star.beans.XPropertySet;
import com.sun.star.beans.XPropertySetInfo;
import com.sun.star.container.XNameAccess;
import com.sun.star.lang.XComponent;
import com.sun.star.sheet.XSpreadsheetDocument;
import com.sun.star.style.XStyleFamiliesSupplier;
import com.sun.star.uno.UnoRuntime;
import com.sun.star.view.PaperOrientation;

/**
 * LibreOffice Calc导出时确保所有列缩放在同一页宽度。
 */
public class CalcFitToWidthFilter implements Filter {

    private final short pagesWide;
    private final short pagesTall;

    public CalcFitToWidthFilter() {
        this((short) 1, (short) 0);
    }

    public CalcFitToWidthFilter(short pagesWide, short pagesTall) {
        this.pagesWide = pagesWide;
        this.pagesTall = pagesTall;
    }

    @Override
    public void doFilter(OfficeContext context, XComponent document, FilterChain chain) throws Exception {
        XSpreadsheetDocument spreadsheet = UnoRuntime.queryInterface(XSpreadsheetDocument.class, document);

        if (spreadsheet != null) {
            XStyleFamiliesSupplier styleFamiliesSupplier = UnoRuntime.queryInterface(XStyleFamiliesSupplier.class, spreadsheet);

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
                                    if (propInfo.hasPropertyByName("ScaleToPagesX")) {
                                        props.setPropertyValue("ScaleToPagesX", pagesWide);
                                    }
                                    if (propInfo.hasPropertyByName("ScaleToPagesY")) {
                                        props.setPropertyValue("ScaleToPagesY", pagesTall);
                                    }
                                    if (propInfo.hasPropertyByName("UseSheetScale")) {
                                        props.setPropertyValue("UseSheetScale", Boolean.FALSE);
                                    }
                                    if (propInfo.hasPropertyByName("PrintOrientation")) {
                                        props.setPropertyValue("PrintOrientation", PaperOrientation.LANDSCAPE);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        chain.doFilter(context, document);
    }
}



