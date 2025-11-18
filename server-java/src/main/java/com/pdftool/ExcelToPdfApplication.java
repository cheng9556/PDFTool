package com.pdftool;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ExcelToPdfApplication {

    public static void main(String[] args) {
        SpringApplication.run(ExcelToPdfApplication.class, args);
        System.out.println("\n=================================");
        System.out.println("Excel to PDF Server 启动成功!");
        System.out.println("访问地址: http://localhost:8788");
        System.out.println("API端点: POST /excel/topdf");
        System.out.println("=================================\n");
    }
}


