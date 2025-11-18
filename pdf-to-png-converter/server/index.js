import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join, resolve } from 'node:path';
import { rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { nanoid } from 'nanoid';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import ExcelJS from 'exceljs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

// Use built library from root/out
// Ensure you run `npm run build` in the repo root before starting server
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pdfToPng } = await import('../out/index.js');

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const id = nanoid(8);
    const outRoot = resolve('../test-results/miniserver');
    const outDir = join(outRoot, id);
    mkdirSync(outDir, { recursive: true });

    const reqScale = Number(req.body?.scale);
    const pages = await pdfToPng(req.file.buffer, {
      viewportScale: Number.isFinite(reqScale) && reqScale > 0 ? reqScale : 2.0,
      outputFolder: outDir,
      outputFileMaskFunc: (n) => `page_${n}.png`,
      verbosityLevel: 0,
    });

    // Respond with file paths relative to outRoot; client can fetch via /files/
    res.json({ id, pages: pages.map(p => ({ name: p.name, width: p.width, height: p.height })) });
  } catch (err) {
    // Best-effort clean when failed
    try { rmSync(resolve('../test-results/miniserver'), { recursive: false, force: true }); } catch {}
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
});

// Static serving of generated PNGs
app.use('/files', express.static(resolve('../test-results/miniserver')));

// PDF merge workflow: init -> upload -> commit
app.post('/pdf/merge/init', (_req, res) => {
  const id = nanoid(8);
  const base = resolve('../test-results/miniserver/pdf-merge', id, 'uploads');
  mkdirSync(base, { recursive: true });
  res.json({ id });
});

app.post('/pdf/merge/upload', upload.single('file'), (req, res) => {
  try {
    const { id, index } = req.query;
    if (!id || !req.file) return res.status(400).json({ error: 'missing id or file' });
    const base = resolve('../test-results/miniserver/pdf-merge', String(id), 'uploads');
    mkdirSync(base, { recursive: true });
    const filename = `${String(index).padStart(4, '0')}.pdf`;
    const dest = join(base, filename);
    writeFileSync(dest, req.file.buffer);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: (e && e.message) || String(e) }); }
});

app.post('/pdf/merge/commit', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'missing id' });
    const base = resolve('../test-results/miniserver/pdf-merge', String(id));
    const uploads = join(base, 'uploads');
    const outPdf = join(base, 'merged.pdf');
    const files = readdirSync(uploads).filter(n => n.endsWith('.pdf')).sort();
    if (files.length === 0) return res.status(400).json({ error: 'no pdfs uploaded' });
    const merged = await PDFDocument.create();
    for (const name of files) {
      const src = readFileSync(join(uploads, name));
      const srcDoc = await PDFDocument.load(src);
      const copied = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
      copied.forEach(p => merged.addPage(p));
    }
    const bytes = await merged.save();
    writeFileSync(outPdf, Buffer.from(bytes));
    res.json({ url: `/files/pdf-merge/${id}/merged.pdf` });
  } catch (e) { res.status(500).json({ error: (e && e.message) || String(e) }); }
});

// PDF split: upload single PDF and split to pages
app.post('/pdf/split', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const id = nanoid(8);
    const base = resolve('../test-results/miniserver/pdf-split', id);
    mkdirSync(base, { recursive: true });
    const doc = await PDFDocument.load(req.file.buffer);
    const urls = [];
    for (let i = 0; i < doc.getPageCount(); i++) {
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(doc, [i]);
      out.addPage(page);
      const bytes = await out.save();
      const name = `page_${i + 1}.pdf`;
      writeFileSync(join(base, name), Buffer.from(bytes));
      urls.push(`/files/pdf-split/${id}/${name}`);
    }
    res.json({ id, urls });
  } catch (e) { res.status(500).json({ error: (e && e.message) || String(e) }); }
});

// PDF rotate: upload with angle and optional pages
app.post('/pdf/rotate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const angle = Number(req.body?.angle) || 90;
    const pagesParam = (req.body?.pages || '').toString(); // e.g., "1,3,5"
    const selected = new Set(
      pagesParam
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => Number.isFinite(n) && n > 0)
    );
    const id = nanoid(8);
    const base = resolve('../test-results/miniserver/pdf-rotate', id);
    mkdirSync(base, { recursive: true });
    const doc = await PDFDocument.load(req.file.buffer);
    for (let i = 0; i < doc.getPageCount(); i++) {
      if (selected.size === 0 || selected.has(i + 1)) {
        const p = doc.getPage(i);
        p.setRotation(((p.getRotation()?.angle || 0) + angle) % 360);
      }
    }
    const name = 'rotated.pdf';
    writeFileSync(join(base, name), Buffer.from(await doc.save()));
    res.json({ url: `/files/pdf-rotate/${id}/${name}` });
  } catch (e) { res.status(500).json({ error: (e && e.message) || String(e) }); }
});

// PDF reorder: upload with order (comma-separated indices)
app.post('/pdf/reorder', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const order = (req.body?.order || '')
      .toString()
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n) && n > 0);
    const id = nanoid(8);
    const base = resolve('../test-results/miniserver/pdf-reorder', id);
    mkdirSync(base, { recursive: true });
    const src = await PDFDocument.load(req.file.buffer);
    const out = await PDFDocument.create();
    const indices = order.length ? order.map(n => n - 1) : src.getPageIndices();
    const copied = await out.copyPages(src, indices);
    copied.forEach(p => out.addPage(p));
    const name = 'reordered.pdf';
    writeFileSync(join(base, name), Buffer.from(await out.save()));
    res.json({ url: `/files/pdf-reorder/${id}/${name}` });
  } catch (e) { res.status(500).json({ error: (e && e.message) || String(e) }); }
});

// Image to PDF (multi-step): init -> upload -> commit
app.post('/img2pdf/init', (_req, res) => {
  const id = nanoid(8);
  const base = resolve('../test-results/miniserver/img2pdf', id, 'uploads');
  mkdirSync(base, { recursive: true });
  res.json({ id });
});

app.post('/img2pdf/upload', upload.single('file'), (req, res) => {
  try {
    const { id, index } = req.query;
    if (!id || !req.file) return res.status(400).json({ error: 'missing id or file' });
    const base = resolve('../test-results/miniserver/img2pdf', String(id), 'uploads');
    mkdirSync(base, { recursive: true });
    const filename = `${String(index).padStart(4, '0')}.${(req.file.mimetype || '').includes('png') ? 'png' : 'jpg'}`;
    const dest = join(base, filename);
    writeFileSync(dest, req.file.buffer);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || String(e) });
  }
});

app.post('/img2pdf/commit', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'missing id' });
    const base = resolve('../test-results/miniserver/img2pdf', String(id));
    const uploads = join(base, 'uploads');
    const outPdf = join(base, 'result.pdf');

    const files = readdirSync(uploads).filter(n => /\.(png|jpg|jpeg)$/i.test(n)).sort();
    if (files.length === 0) return res.status(400).json({ error: 'no images uploaded' });

    const pdfDoc = await PDFDocument.create();
    for (const name of files) {
      const buf = readFileSync(join(uploads, name));
      let img; let dims;
      if (/\.png$/i.test(name)) {
        img = await pdfDoc.embedPng(buf);
      } else {
        img = await pdfDoc.embedJpg(buf);
      }
      dims = img.scale(1);
      const page = pdfDoc.addPage([dims.width, dims.height]);
      page.drawImage(img, { x: 0, y: 0, width: dims.width, height: dims.height });
    }
    const pdfBytes = await pdfDoc.save();
    writeFileSync(outPdf, Buffer.from(pdfBytes));
    res.json({ url: `/files/img2pdf/${id}/result.pdf` });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || String(e) });
  }
});

// PDF to Excel: extract text and create Excel file
app.post('/pdf/toexcel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const id = nanoid(8);
    const base = resolve('../test-results/miniserver/pdf-toexcel', id);
    mkdirSync(base, { recursive: true });
    
    // Convert Buffer to Uint8Array for pdfjs-dist
    const uint8Array = new Uint8Array(req.file.buffer);
    
    // Load PDF using pdfjs-dist
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PDF Converter';
    workbook.created = new Date();
    
    // Process each page
    let totalTextItems = 0;
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Create a worksheet for each page
      const worksheet = workbook.addWorksheet(`Page ${pageNum}`);
      
      console.log(`Page ${pageNum}: Found ${textContent?.items?.length || 0} text items`);
      
      // Check if textContent has items
      if (!textContent || !textContent.items || textContent.items.length === 0) {
        console.log(`Page ${pageNum} has no text content, skipping...`);
        continue;
      }
      
      totalTextItems += textContent.items.length;
      
      // Group text items by Y position (rows)
      const rows = new Map();
      textContent.items.forEach(item => {
        if (!item || !item.transform) return; // Skip invalid items
        const y = Math.round(item.transform[5]); // Y coordinate
        if (!rows.has(y)) {
          rows.set(y, []);
        }
        rows.get(y).push({ x: item.transform[4], text: item.str || '' });
      });
      
      // Sort rows by Y position (top to bottom)
      const sortedRows = Array.from(rows.entries())
        .sort((a, b) => b[0] - a[0]); // Descending Y (top to bottom)
      
      // Add data to worksheet
      let rowIndex = 1;
      sortedRows.forEach(([y, items]) => {
        // Sort items by X position (left to right)
        items.sort((a, b) => a.x - b.x);
        
        // Detect columns based on X positions
        const columns = [];
        let currentCol = 0;
        let lastX = -Infinity;
        
        items.forEach(item => {
          // If X gap is large, move to next column
          if (item.x - lastX > 50) { // Threshold for column detection
            currentCol++;
          }
          if (!columns[currentCol]) {
            columns[currentCol] = [];
          }
          columns[currentCol].push(item.text);
          lastX = item.x;
        });
        
        // Add row to worksheet
        const row = worksheet.getRow(rowIndex);
        columns.forEach((colTexts, colIndex) => {
          row.getCell(colIndex + 1).value = colTexts.join(' ');
        });
        rowIndex++;
      });
      
      // Auto-fit columns (only if columns exist)
      if (worksheet.columns && worksheet.columns.length > 0) {
        worksheet.columns.forEach(column => {
          if (column) {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
              const cellValue = cell.value ? cell.value.toString() : '';
              maxLength = Math.max(maxLength, cellValue.length);
            });
            column.width = Math.min(maxLength + 2, 50); // Max width 50
          }
        });
      }
    }
    
    console.log(`PDF to Excel: Processed ${pdfDocument.numPages} pages, extracted ${totalTextItems} text items total`);
    
    // Check if we extracted any text at all
    if (totalTextItems === 0) {
      console.log('WARNING: No text content found in PDF. This PDF may contain only images.');
      return res.status(400).json({ 
        error: 'PDF中未找到可提取的文本内容。此PDF可能仅包含图像。如果您需要从图像PDF中提取文本，请使用OCR功能。' 
      });
    }
    
    // Save Excel file
    const excelPath = join(base, 'result.xlsx');
    await workbook.xlsx.writeFile(excelPath);
    
    console.log(`Successfully created Excel file with ${totalTextItems} text items`);
    res.json({ url: `/files/pdf-toexcel/${id}/result.xlsx` });
  } catch (e) {
    console.error('PDF to Excel error:', e);
    res.status(500).json({ error: (e && e.message) || String(e) });
  }
});

// Excel to PDF: convert Excel sheets to PDF using Canvas rendering
app.post('/excel/topdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const id = nanoid(8);
    const base = resolve('../test-results/miniserver/excel-topdf', id);
    mkdirSync(base, { recursive: true });
    
    // Load Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    
    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Process each worksheet
    for (const worksheet of workbook.worksheets) {
      if (worksheet.rowCount === 0) continue;
      
      // Get actual data range and calculate column widths
      const tableData = [];
      const columnWidths = [];
      let maxCol = 0;
      
      // First pass: collect all data with styling
      const cellStyles = [];
      
      // Get the actual used range of the worksheet (including cells with only borders)
      // ExcelJS dimensions gives us the actual range used in the spreadsheet
      let actualRowCount = worksheet.rowCount;
      let actualColumnCount = worksheet.columnCount || 10;
      
      // Try to get more accurate dimensions
      if (worksheet.dimensions && typeof worksheet.dimensions === 'object') {
        // dimensions can be a range object like { top: 1, left: 1, bottom: 23, right: 9 }
        if (worksheet.dimensions.bottom) {
          actualRowCount = worksheet.dimensions.bottom;
        } else if (worksheet.dimensions.model && worksheet.dimensions.model.bottom) {
          actualRowCount = worksheet.dimensions.model.bottom;
        }
        
        if (worksheet.dimensions.right) {
          actualColumnCount = worksheet.dimensions.right;
        } else if (worksheet.dimensions.model && worksheet.dimensions.model.right) {
          actualColumnCount = worksheet.dimensions.model.right;
        }
      }
      
      console.log(`Worksheet "${worksheet.name}" will process ${actualRowCount} rows x ${actualColumnCount} cols (original rowCount: ${worksheet.rowCount})`);
      
      // Ensure maxCol is at least as large as actualColumnCount
      maxCol = Math.max(maxCol, actualColumnCount);
      
      // Process each row, including empty rows with borders
      for (let rowNumber = 1; rowNumber <= actualRowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const rowData = [];
        const rowStyles = [];
        
        // Get the actual column count for this row
        const rowColCount = row.cellCount;
        maxCol = Math.max(maxCol, rowColCount, actualColumnCount);
        
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          maxCol = Math.max(maxCol, colNumber);
          let cellValue = '';
          
          // Handle different cell value types
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object' && cell.value.richText) {
              // Rich text
              cellValue = cell.value.richText.map(t => t.text).join('');
            } else if (typeof cell.value === 'object' && cell.value.result !== undefined) {
              // Formula
              cellValue = String(cell.value.result);
            } else {
              cellValue = String(cell.value);
            }
          }
          
          // Extract cell styling including font properties and borders
          const style = {
            bgColor: null,
            fgColor: null,
            bold: false,
            italic: false,
            fontSize: null,
            fontFamily: null,
            borderColor: null,
            borderStyle: null
          };
          
          // Get background color with multiple format support
          if (cell.fill) {
            let bgColor = null;
            
            // Pattern fill
            if (cell.fill.type === 'pattern' && cell.fill.fgColor) {
              const fillColor = cell.fill.fgColor;
              if (fillColor.argb) {
                bgColor = '#' + fillColor.argb.substring(2);
              } else if (fillColor.theme !== undefined) {
                // Theme colors - use approximate colors
                const themeColors = ['#000000', '#FFFFFF', '#E7E6E6', '#44546A', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
                bgColor = themeColors[fillColor.theme] || null;
              }
            }
            // Solid fill
            else if (cell.fill.type === 'solid' && cell.fill.bgColor) {
              const fillColor = cell.fill.bgColor;
              if (fillColor.argb) {
                bgColor = '#' + fillColor.argb.substring(2);
              }
            }
            
            style.bgColor = bgColor;
          }
          
          // Get font color, style, size, and family
          if (cell.font) {
            let textColor = null;
            
            if (cell.font.color) {
              if (cell.font.color.argb) {
                textColor = '#' + cell.font.color.argb.substring(2);
              } else if (cell.font.color.theme !== undefined) {
                // Theme colors - map Excel theme indices to colors
                // Note: Theme 1 is white, which should only be used on dark backgrounds
                const themeColors = [
                  '#000000',  // 0: Black (text)
                  '#FFFFFF',  // 1: White (background)
                  '#E7E6E6',  // 2: Light Gray
                  '#44546A',  // 3: Dark Blue
                  '#4472C4',  // 4: Blue
                  '#ED7D31',  // 5: Orange
                  '#A5A5A5',  // 6: Gray
                  '#FFC000',  // 7: Gold
                  '#5B9BD5',  // 8: Light Blue
                  '#70AD47'   // 9: Green
                ];
                textColor = themeColors[cell.font.color.theme] || null;
                
                // If theme is 1 (white) and there's no dark background, use black instead
                if (cell.font.color.theme === 1) {
                  textColor = '#000000';  // Override white text to black for visibility
                }
              }
            }
            
            // If no color was set, it will be null and we'll use default black in rendering
            style.fgColor = textColor;
            style.bold = cell.font.bold || false;
            style.italic = cell.font.italic || false;
            
            // Extract font size (Excel uses points, we convert to pixels)
            // Excel default is 11pt for Calibri, convert with consistent 1.333 factor then reduce slightly
            // Use consistent conversion: pt * 1.333 * 0.75 = pt * 1.0 (approximately matches Excel visual rendering)
            if (cell.font.size) {
              style.fontSize = Math.round(cell.font.size * 1.0); // Match Excel's visual size
            }
            
            // Extract font family (use Excel font name or fallback to system fonts)
            if (cell.font.name) {
              style.fontFamily = cell.font.name;
            }
          }
          
          // Extract border styles - check all borders and prioritize visible ones
          if (cell.border) {
            // Try to get the most visible border color
            let borderColor = null;
            let borderStyle = null;
            
            // Check each border in priority order
            const bordersToCheck = [cell.border.top, cell.border.right, cell.border.bottom, cell.border.left];
            
            for (const border of bordersToCheck) {
              if (border && border.style && border.style !== 'none') {
                // Get border color
                if (border.color && !borderColor) {
                  if (border.color.argb) {
                    borderColor = '#' + border.color.argb.substring(2);
                  } else if (border.color.theme !== undefined) {
                    const themeColors = ['#000000', '#FFFFFF', '#E7E6E6', '#44546A', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
                    borderColor = themeColors[border.color.theme] || '#000000';
                  } else {
                    // If no color specified, use black for visible borders
                    borderColor = '#000000';
                  }
                }
                
                // Get border style
                if (!borderStyle) {
                  borderStyle = border.style || 'thin';
                }
              }
            }
            
            style.borderColor = borderColor;
            style.borderStyle = borderStyle;
          }
          
          rowData[colNumber - 1] = cellValue;
          rowStyles[colNumber - 1] = style;
        });
        
        // Fill empty cells - check if they have borders even without content
        for (let i = 0; i < maxCol; i++) {
          if (rowData[i] === undefined) {
            rowData[i] = '';
          }
          
          // If we haven't collected style for this cell yet, check if the cell exists and has borders
          if (!rowStyles[i]) {
            const cell = row.getCell(i + 1);
            const emptyStyle = {
              bgColor: null,
              fgColor: null,
              bold: false,
              italic: false,
              fontSize: null,
              fontFamily: null,
              borderColor: null,
              borderStyle: null
            };
            
            // Check if this empty cell has borders
            if (cell && cell.border) {
              let borderColor = null;
              let borderStyle = null;
              
              const bordersToCheck = [cell.border.top, cell.border.right, cell.border.bottom, cell.border.left];
              
              for (const border of bordersToCheck) {
                if (border && border.style && border.style !== 'none') {
                  if (border.color && !borderColor) {
                    if (border.color.argb) {
                      borderColor = '#' + border.color.argb.substring(2);
                    } else if (border.color.theme !== undefined) {
                      const themeColors = ['#000000', '#FFFFFF', '#E7E6E6', '#44546A', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
                      borderColor = themeColors[border.color.theme] || '#000000';
                    } else {
                      borderColor = '#000000';
                    }
                  }
                  
                  if (!borderStyle) {
                    borderStyle = border.style || 'thin';
                  }
                }
              }
              
              emptyStyle.borderColor = borderColor;
              emptyStyle.borderStyle = borderStyle;
            }
            
            rowStyles[i] = emptyStyle;
          }
        }
        
        tableData.push(rowData);
        cellStyles.push(rowStyles);
      }
      
      
      if (tableData.length === 0 || maxCol === 0) continue;
      
      // Aggressive optimization for 200KB target file size
      // 1.5x scale = 150 DPI (optimized for file size, still readable on screens)
      const scale = 1.5; // Aggressive optimization for 200KB target
      
      // Calculate column widths and row heights based on content - ultra compact
      const minCellWidth = 80;
      const maxCellWidth = 400;
      const minCellHeight = 16; // Ultra compact - minimal height to match Excel
      const padding = 2; // Minimal padding for tightest spacing
      // Excel's default font is 11pt Calibri, which visually appears as ~11px
      const defaultFontSize = 11; // Match Excel's default 11pt font size
      const headerHeight = 3; // Minimal header height
      
      // Debug: Log font information for verification
      console.log(`\n=== Worksheet: ${worksheet.name} - Font Extraction Debug ===`);
      console.log(`Default font: ${defaultFontSize}px Calibri`);
      for (let r = 0; r < Math.min(5, tableData.length); r++) {
        for (let c = 0; c < Math.min(3, maxCol); c++) {
          // Safety check: ensure cellStyles[r] and cellStyles[r][c] exist
          if (!cellStyles[r] || !cellStyles[r][c]) {
            console.log(`Cell[${r},${c}]: MISSING STYLE DATA`);
            continue;
          }
          const style = cellStyles[r][c];
          const text = tableData[r][c];
          const actualFontSize = style.fontSize || defaultFontSize;
          const actualFontFamily = style.fontFamily || 'Calibri';
          console.log(`Cell[${r},${c}]: fontSize=${style.fontSize || 'default'}px (actual: ${actualFontSize}px), fontFamily="${style.fontFamily || 'default'}" (actual: "${actualFontFamily}"), bold=${style.bold}, text="${text?.substring(0, 20)}"`);
        }
      }
      console.log('==========================================\n');
      
      // Create a temporary canvas to measure text
      const tempCanvas = createCanvas(100, 100);
      const tempCtx = tempCanvas.getContext('2d');
      
      // Calculate column widths considering each cell's font size
      for (let col = 0; col < maxCol; col++) {
        let maxWidth = minCellWidth;
        for (let row = 0; row < tableData.length; row++) {
          const text = tableData[row][col] || '';
          const cellStyle = cellStyles[row][col];
          const cellFontSize = cellStyle.fontSize || defaultFontSize;
          // Default to Calibri (Excel's default), with fallback to Chinese fonts
          const cellFontFamily = cellStyle.fontFamily || 'Calibri';
          
          if (text) {
            // Set font for accurate measurement
            tempCtx.font = `${cellFontSize}px "${cellFontFamily}", "Calibri", "Microsoft YaHei", "SimHei", sans-serif`;
            
            // Split by newlines to find longest line
            const lines = text.split(/\r?\n/);
            for (const line of lines) {
              const textWidth = tempCtx.measureText(line).width + padding * 2;
              maxWidth = Math.max(maxWidth, Math.min(textWidth, maxCellWidth));
            }
          }
        }
        columnWidths[col] = maxWidth;
      }
      
      // Calculate row heights based on wrapped text and cell font sizes
      const rowHeights = [];
      for (let row = 0; row < tableData.length; row++) {
        let maxHeight = minCellHeight;
        
        for (let col = 0; col < maxCol; col++) {
          const text = tableData[row][col] || '';
          const cellStyle = cellStyles[row][col];
          const cellFontSize = cellStyle.fontSize || defaultFontSize;
          // Default to Calibri (Excel's default), with fallback to Chinese fonts
          const cellFontFamily = cellStyle.fontFamily || 'Calibri';
          const cellLineHeight = cellFontSize * 1.2; // Ultra tight line spacing like Excel
          
          if (text) {
            // Set font for accurate measurement
            tempCtx.font = `${cellFontSize}px "${cellFontFamily}", "Calibri", "Microsoft YaHei", "SimHei", sans-serif`;
            
            // Count lines from newlines
            const explicitLines = text.split(/\r?\n/).length;
            
            // Calculate wrapped lines for each explicit line
            let totalLines = 0;
            const lines = text.split(/\r?\n/);
            for (const line of lines) {
              const lineWidth = tempCtx.measureText(line).width;
              const maxWidth = columnWidths[col] - padding * 2;
              const wrappedLines = Math.ceil(lineWidth / maxWidth) || 1;
              totalLines += wrappedLines;
            }
            
            const cellHeight = totalLines * cellLineHeight + padding * 2;
            maxHeight = Math.max(maxHeight, cellHeight);
          }
        }
        
        rowHeights[row] = maxHeight;
      }
      
      // Calculate canvas size using actual column widths (scaled for high quality)
      const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
      const baseCanvasWidth = Math.min(totalWidth + 20, 4000); // Minimal padding for compact layout
      const canvasWidth = baseCanvasWidth * scale;
      
      // Debug: Log total rows
      console.log(`Total rows in worksheet: ${tableData.length}`);
      console.log(`Row heights sample (first 5): ${rowHeights.slice(0, 5).map(h => Math.round(h)).join(', ')}`);
      
      // Calculate page breaks based on accumulated height
      const maxPageHeight = 1200; // Maximum height per page before splitting
      const pages = [];
      let currentPage = [];
      let currentPageHeight = 0;
      
      for (let row = 0; row < tableData.length; row++) {
        const rowHeight = rowHeights[row];
        if (currentPageHeight + rowHeight > maxPageHeight && currentPage.length > 0) {
          console.log(`Page break at row ${row}, accumulated height: ${currentPageHeight}`);
          pages.push([...currentPage]);
          currentPage = [];
          currentPageHeight = 0;
        }
        currentPage.push(row);
        currentPageHeight += rowHeight;
      }
      if (currentPage.length > 0) {
        pages.push(currentPage);
      }
      
      const pagesNeeded = pages.length;
      console.log(`Split into ${pagesNeeded} pages, rows per page: ${pages.map(p => p.length).join(', ')}`);
      
      for (let pageNum = 0; pageNum < pagesNeeded; pageNum++) {
        const pageRowIndices = pages[pageNum];
        const pageRowHeights = pageRowIndices.map(i => rowHeights[i]);
        const totalPageHeight = pageRowHeights.reduce((sum, h) => sum + h, 0);
        
        const baseCanvasHeight = headerHeight + totalPageHeight + 10; // Reduced bottom margin
        const canvasHeight = baseCanvasHeight * scale;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
        
        // Scale the context for high-quality rendering
        ctx.scale(scale, scale);
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, baseCanvasWidth, baseCanvasHeight);
        
        // No title - removed as requested
        
        // Draw table with Chinese font support
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 1;
        
        let currentY = headerHeight;
        
        for (let i = 0; i < pageRowIndices.length; i++) {
          const rowIndex = pageRowIndices[i];
          const rowHeight = pageRowHeights[i];
          const rowData = tableData[rowIndex];
          const rowStyleData = cellStyles[rowIndex];
          let currentX = 5; // Reduced margin for compact layout
          
          for (let j = 0; j < maxCol; j++) {
            const cellWidth = columnWidths[j];
            const cellText = rowData[j] || '';
            const cellStyle = rowStyleData[j] || { bgColor: null, fgColor: null, bold: false, italic: false, fontSize: null, fontFamily: null, borderColor: null, borderStyle: null };
            
            // Get cell-specific font properties - use Excel's default for consistency
            const cellFontSize = cellStyle.fontSize || defaultFontSize; // Will be 11px if not set (Excel's default)
            // Default to Calibri (Excel's default), with fallback to Chinese fonts
            const cellFontFamily = cellStyle.fontFamily || 'Calibri';
            const cellLineHeight = cellFontSize * 1.2; // Ultra tight line spacing like Excel
            
            // Draw cell background with Excel color or white
            if (cellStyle.bgColor) {
              // Use Excel background color
              ctx.fillStyle = cellStyle.bgColor;
              ctx.fillRect(currentX, currentY, cellWidth, rowHeight);
            } else {
              // Use white background (no alternating colors to preserve Excel look)
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(currentX, currentY, cellWidth, rowHeight);
            }
            
            // Draw cell border ONLY if Excel has explicit border - match Excel exactly
            if (cellStyle.borderColor || cellStyle.borderStyle) {
              const borderColor = cellStyle.borderColor || '#000000';
              const borderWidth = cellStyle.borderStyle === 'medium' ? 1.5 : cellStyle.borderStyle === 'thick' ? 2 : 0.5;
              
              ctx.strokeStyle = borderColor;
              ctx.lineWidth = borderWidth;
              ctx.strokeRect(currentX, currentY, cellWidth, rowHeight);
            }
            
            // Draw cell text with line wrapping using cell-specific font
            if (cellText) {
              // IMPORTANT: Always set text color AFTER drawing background
              // Get text color from Excel, ensuring we never use null/undefined
              let textColor = '#000000';  // Default to black
              
              if (cellStyle.fgColor) {
                textColor = cellStyle.fgColor;
              }
              
              // Ensure text is visible: if text color is same as background, use black
              if (cellStyle.bgColor && textColor.toUpperCase() === cellStyle.bgColor.toUpperCase()) {
                textColor = '#000000';
              }
              
              // Additional safety: ensure textColor is never white on white background
              if (!cellStyle.bgColor && textColor.toUpperCase() === '#FFFFFF') {
                textColor = '#000000';
              }
              
              // CRITICAL: Always explicitly set fillStyle to text color
              ctx.fillStyle = textColor;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              
              // Disable image smoothing for sharper text rendering at high DPI
              ctx.imageSmoothingEnabled = false; // Disable for sharper pixel-perfect rendering
              
              // Build font string with cell-specific properties
              let fontWeight = cellStyle.bold ? 'bold' : 'normal';
              let fontStyle = cellStyle.italic ? 'italic' : 'normal';
              // Font fallback order: Excel font (e.g. Calibri) -> Chinese fonts -> generic sans-serif
              let fontString = `${fontStyle} ${fontWeight} ${cellFontSize}px "${cellFontFamily}", "Calibri", "Microsoft YaHei", "SimHei", "STHeiti", "Arial Unicode MS", sans-serif`;
              ctx.font = fontString;
              
              const maxWidth = cellWidth - padding * 2;
              const lines = cellText.split(/\r?\n/);
              let textY = currentY + padding;
              
              for (const line of lines) {
                if (!line) {
                  textY += cellLineHeight;
                  continue;
                }
                
                // Word wrap for long lines
                const words = line.split('');
                let currentLine = '';
                
                for (let k = 0; k < words.length; k++) {
                  const testLine = currentLine + words[k];
                  const testWidth = ctx.measureText(testLine).width;
                  
                  if (testWidth > maxWidth && currentLine.length > 0) {
                    // Draw current line and start new one
                    ctx.fillText(currentLine, currentX + padding, textY);
                    currentLine = words[k];
                    textY += cellLineHeight;
                  } else {
                    currentLine = testLine;
                  }
                }
                
                // Draw remaining text
                if (currentLine) {
                  ctx.fillText(currentLine, currentX + padding, textY);
                  textY += cellLineHeight;
                }
              }
            }
            
          currentX += cellWidth;
        }

        currentY += rowHeight;
      }
        
        // Convert canvas to JPEG for smaller file size (quality 30 = very aggressive compression for 200KB target)
        // JPEG is much smaller than PNG and suitable for tables without transparency
        // Quality 30 provides very aggressive compression to meet 200KB target
        const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: 0.3 });
        console.log(`Page ${pageNum}: JPEG size=${(jpegBuffer.length / 1024).toFixed(1)}KB`);
        
        // Embed image in PDF
        const pngImage = await pdfDoc.embedJpg(jpegBuffer);
        
        // Calculate appropriate scale to fit page
        // IMPORTANT: Canvas dimensions are in pixels (scaled by 'scale' factor)
        // We need to divide by scale to get the logical dimensions in points
        const imgWidth = pngImage.width / scale;  // Convert pixels back to points
        const imgHeight = pngImage.height / scale; // Convert pixels back to points
        const isWide = imgWidth > imgHeight;
        
        console.log(`Page ${pageNum + 1}: Canvas=${pngImage.width}x${pngImage.height}px, Logical=${Math.round(imgWidth)}x${Math.round(imgHeight)}pt`);
        
        // Use consistent page width for all pages - always A3 landscape for wide tables
        let pageWidth, pageHeight;
        if (isWide) {
          // Always use maximum A3 landscape for consistent width across all pages
          pageWidth = 1190;  // A3 landscape width
          pageHeight = 842;  // A3 landscape height
        } else {
          pageWidth = 595;  // A4 portrait width
          pageHeight = 842; // A4 portrait height
        }
        
        // Calculate scale to fit with margins
        const margin = 20;
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2;
        
        let pdfScale = Math.min(
          availableWidth / imgWidth,
          availableHeight / imgHeight,
          1 // Don't scale up, only down
        );
        
        const scaledWidth = imgWidth * pdfScale;
        const scaledHeight = imgHeight * pdfScale;
        
        // Position image at top-left (like Excel), not centered
        // Place with margin from top-left corner
        const x = margin;
        const y = pageHeight - scaledHeight - margin; // PDF coordinates start from bottom
        
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(pngImage, {
          x: x,
          y: y,
          width: scaledWidth,
          height: scaledHeight,
        });
      }
    }
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfPath = join(base, 'result.pdf');
    writeFileSync(pdfPath, Buffer.from(pdfBytes));
    
    res.json({ url: `/files/excel-topdf/${id}/result.pdf` });
  } catch (e) {
    console.error('Excel to PDF error:', e);
    res.status(500).json({ error: (e && e.message) || String(e) });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  // Write a small READY file for quick debugging
  try { writeFileSync(join(process.cwd(), '.server_ready'), String(Date.now())); } catch {}
  // eslint-disable-next-line no-console
  console.log(`PDF2PNG server listening on http://localhost:${PORT}`);
});


