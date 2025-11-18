package com.pdftool.config;

import org.jodconverter.core.DocumentConverter;
import org.jodconverter.core.office.OfficeManager;
import org.jodconverter.local.LocalConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.pdftool.filter.CalcFitToWidthFilter;

@Configuration
public class JodConverterConfig {

    /**
     * 配置DocumentConverter Bean
     * 使用LocalConverter + OfficeManager实现文档转换
     */
    @Bean
    public DocumentConverter documentConverter(OfficeManager officeManager) {
        return LocalConverter.builder()
                .officeManager(officeManager)
                .filterChain(new CalcFitToWidthFilter())
                .build();
    }
}


