package com.pdftool.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * 健康检查Controller
 * 用于监控服务状态
 */
@RestController
@CrossOrigin(origins = "*")
public class HealthController {

    /**
     * 健康检查端点
     * GET /health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "PDF Tool Java Service");
        response.put("version", "2.0");
        return ResponseEntity.ok(response);
    }

    /**
     * 根路径
     */
    @GetMapping("/")
    public ResponseEntity<Map<String, String>> root() {
        Map<String, String> response = new HashMap<>();
        response.put("service", "PDF Tool Java Service");
        response.put("version", "2.0");
        response.put("status", "running");
        response.put("description", "高性能PDF处理服务");
        return ResponseEntity.ok(response);
    }
}

