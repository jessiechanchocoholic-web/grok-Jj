(function () {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
  }

  var pages = [];
  var currentIndex = 0;
  var viewMode = 'split'; // 'after' | 'split' | 'before'
  var currentTool = 'rect'; // 'rect' | 'brush' | 'line'
  var brushSize = 28;
  var isDrawing = false;
  var activeStroke = null;
  var lastProcessMs = 0;

  // =========================================================================
  // IndexedDB Local Auto-Backup (防 Safari 重整或電話響走失原圖底)
  // =========================================================================
  var DB_NAME = 'GrokScannerV2DB';
  var STORE_NAME = 'pages_store';
  var dbPromise = null;

  function openScannerDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      var req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () { resolve(null); };
    });
    return dbPromise;
  }

  function saveAllPagesToDB() {
    openScannerDB().then(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        store.clear();
        pages.forEach(function (p, idx) {
          if (!p.originalDataUrl && p.originalCanvas) {
            p.originalDataUrl = p.originalCanvas.toDataURL('image/jpeg', 0.9);
          }
          store.put({
            id: p.id,
            order: idx,
            label: p.label,
            isDemo: !!p.isDemo,
            originalDataUrl: p.originalDataUrl,
            settings: p.settings,
            strokes: p.strokes
          });
        });
      } catch (err) {
        // Ignore quota errors
      }
    });
  }

  function clearScannerDB() {
    return openScannerDB().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        } catch (e) {
          resolve();
        }
      });
    });
  }

  function restorePagesFromDB() {
    return openScannerDB().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = function () {
            var list = (req.result || []).sort(function (a, b) { return a.order - b.order; });
            resolve(list);
          };
          req.onerror = function () { resolve([]); };
        } catch (e) {
          resolve([]);
        }
      });
    });
  }

  function defaultSettings() {
    return {
      autoWhiten: true,
      whitenStrength: 68,
      removeColorInk: true,
      colorSensitivity: 62,
      removePencil: true,
      pencilThreshold: 145,
      autoHeaderMask: true,
      headerMaskRatio: 9.0,
      cropPercent: 0,
      rotation: 0
    };
  }

  var els = {};
  function initElements() {
    var ids = [
      'cameraInput', 'pdfInput', 'albumInput', 'btnLoadDemo',
      'perfBadge', 'emptyStateBox', 'workspaceSection',
      'btnMagicAll', 'chkWhiten', 'rngWhiten', 'valWhiten',
      'chkColorInk', 'rngColorInk', 'valColorInk',
      'chkPencil', 'rngPencil', 'valPencil',
      'chkHeaderMask', 'rngHeaderMask', 'valHeaderMask',
      'rngCrop', 'valCrop', 'btnRotateLeft', 'btnRotateRight',
      'btnApplyAllPages', 'btnResetPage', 'btnDeleteCurrentPage',
      'toolRect', 'toolBrush', 'toolLine',
      'rngBrushSize', 'valBrushSize', 'btnUndo', 'btnClearStrokes',
      'modeAfter', 'modeSplit', 'modeBefore',
      'beforeBox', 'afterBox', 'beforeCanvas', 'editorCanvas',
      'pageIndicator', 'pagesStrip', 'btnClearAllPages',
      'selGrade', 'selSubject', 'inpFilename',
      'btnDownloadBothPdf', 'btnDownloadOrigPdf', 'btnDownloadPdf', 'btnPrint', 'pdfPageCount',
      'statusToast', 'printContainer'
    ];
    for (var i = 0; i < ids.length; i++) {
      els[ids[i]] = document.getElementById(ids[i]);
    }
  }

  var toastTimer = null;
  function showToast(msg, duration) {
    if (!els.statusToast) return;
    els.statusToast.textContent = msg;
    els.statusToast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.statusToast.classList.remove('show');
    }, duration || 2800);
  }

  function getFilenamePrefix() {
    var raw = els.inpFilename ? els.inpFilename.value.trim() : '';
    raw = raw.replace(/\.pdf$/i, '').replace(/_(空白練習卷|已清答案學生版|Original原圖留底).*$/, '');
    if (raw) return raw;
    var grade = els.selGrade ? els.selGrade.value : 'P3';
    var subj = els.selSubject ? els.selSubject.value : '英文';
    return grade + '_' + subj;
  }

  function updateAutoFilename() {
    var grade = els.selGrade ? els.selGrade.value : 'P3';
    var subj = els.selSubject ? els.selSubject.value : '英文';
    var today = new Date().toISOString().slice(0, 10);
    if (els.inpFilename) {
      els.inpFilename.value = grade + '_' + subj + '_' + today;
    }
  }

  // If user imports real photos/PDF while only a demo page is present, automatically remove demo page!
  function removeDemoPagesIfRealImport() {
    var hadDemo = false;
    pages = pages.filter(function (p) {
      if (p.isDemo) {
        hadDemo = true;
        return false;
      }
      return true;
    });
    if (hadDemo && currentIndex >= pages.length) {
      currentIndex = Math.max(0, pages.length - 1);
    }
  }

  function addPageFromCanvas(srcCanvas, label, customSettings, isDemoFlag, existingDataUrl) {
    var st = customSettings ? Object.assign({}, defaultSettings(), customSettings) : defaultSettings();
    var pageObj = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      label: label || ('第 ' + (pages.length + 1) + ' 頁'),
      isDemo: !!isDemoFlag,
      originalCanvas: srcCanvas,
      originalDataUrl: existingDataUrl || srcCanvas.toDataURL('image/jpeg', 0.9),
      beforeCanvas: null,
      processedCanvas: null,
      thumbUrl: '',
      settings: st,
      strokes: [],
      _filterCacheKey: null,
      _beforeCanvas: null,
      _filteredBaseCanvas: null
    };
    reprocessSinglePage(pageObj);
    pages.push(pageObj);
    currentIndex = pages.length - 1;
  }

  function reprocessSinglePage(pageObj) {
    var res = window.ScannerProcessor.processPageCanvas(
      pageObj.originalCanvas,
      pageObj.settings,
      pageObj.strokes,
      pageObj
    );
    pageObj.beforeCanvas = res.beforeCanvas;
    pageObj.processedCanvas = res.afterCanvas;
    lastProcessMs = res.elapsedMs || 1;

    var tc = document.createElement('canvas');
    var tw = 150;
    var th = Math.round((res.afterCanvas.height / res.afterCanvas.width) * tw);
    tc.width = tw;
    tc.height = th;
    tc.getContext('2d').drawImage(res.afterCanvas, 0, 0, tw, th);
    pageObj.thumbUrl = tc.toDataURL('image/jpeg', 0.7);
  }

  function syncControlsFromCurrentPage() {
    var p = pages[currentIndex];
    if (!p) return;
    var s = p.settings;
    els.chkWhiten.checked = s.autoWhiten;
    els.rngWhiten.value = s.whitenStrength;
    els.valWhiten.textContent = s.whitenStrength + '%';

    els.chkColorInk.checked = s.removeColorInk;
    els.rngColorInk.value = s.colorSensitivity;
    els.valColorInk.textContent = s.colorSensitivity + '%';

    els.chkPencil.checked = s.removePencil;
    els.rngPencil.value = s.pencilThreshold;
    els.valPencil.textContent = s.pencilThreshold;

    els.chkHeaderMask.checked = s.autoHeaderMask;
    els.rngHeaderMask.value = s.headerMaskRatio;
    els.valHeaderMask.textContent = s.headerMaskRatio + '%';

    els.rngCrop.value = s.cropPercent;
    els.valCrop.textContent = s.cropPercent + '%';
  }

  function renderStageAndStrip() {
    els.pdfPageCount.textContent = pages.length;

    // 0-page clean state
    if (pages.length === 0) {
      currentIndex = 0;
      els.emptyStateBox.style.display = 'block';
      els.pagesStrip.style.display = 'none';
      els.pagesStrip.innerHTML = '';
      els.workspaceSection.style.display = 'none';
      els.pageIndicator.textContent = '目前：0 頁（空白乾淨狀態）';
      if (els.perfBadge) {
        els.perfBadge.textContent = '⚡ 準備就緒（目前 0 頁）';
      }
      return;
    }

    els.emptyStateBox.style.display = 'none';
    els.pagesStrip.style.display = 'flex';
    els.workspaceSection.style.display = 'grid';

    if (currentIndex >= pages.length) currentIndex = pages.length - 1;
    var p = pages[currentIndex];
    syncControlsFromCurrentPage();

    // Draw beforeCanvas (Original Version A)
    els.beforeCanvas.width = p.beforeCanvas.width;
    els.beforeCanvas.height = p.beforeCanvas.height;
    els.beforeCanvas.getContext('2d').drawImage(p.beforeCanvas, 0, 0);

    // Draw editorCanvas (Cleaned Version B)
    els.editorCanvas.width = p.processedCanvas.width;
    els.editorCanvas.height = p.processedCanvas.height;
    els.editorCanvas.getContext('2d').drawImage(p.processedCanvas, 0, 0);

    if (viewMode === 'after') {
      els.beforeBox.style.display = 'none';
      els.afterBox.style.display = 'flex';
    } else if (viewMode === 'before') {
      els.beforeBox.style.display = 'flex';
      els.afterBox.style.display = 'none';
    } else {
      els.beforeBox.style.display = 'flex';
      els.afterBox.style.display = 'flex';
    }

    els.pageIndicator.textContent = '當前：第 ' + (currentIndex + 1) + ' / ' + pages.length + ' 頁（' + p.label + '）';
    if (els.perfBadge) {
      els.perfBadge.textContent = '⚡ 極速處理耗時：' + lastProcessMs + 'ms｜已鎖定存底 ' + pages.length + ' 頁';
    }

    // Render thumbnails strip (every page can be deleted, even the last one!)
    els.pagesStrip.innerHTML = '';
    pages.forEach(function (item, idx) {
      var card = document.createElement('div');
      card.className = 'page-thumb-card' + (idx === currentIndex ? ' active' : '');
      card.innerHTML =
        '<div style="font-size:13px;font-weight:800;color:#0f172a;">第 ' + (idx + 1) + ' 頁</div>' +
        '<img src="' + item.thumbUrl + '" alt="Page ' + (idx + 1) + '" />' +
        '<div class="thumb-actions">' +
          '<button type="button" class="thumb-btn" data-act="prev" data-idx="' + idx + '" title="前移">◀</button>' +
          '<button type="button" class="thumb-btn" data-act="next" data-idx="' + idx + '" title="後移">▶</button>' +
          '<button type="button" class="thumb-btn" data-act="dup" data-idx="' + idx + '" title="複製">複製</button>' +
          '<button type="button" class="thumb-btn" data-act="del" data-idx="' + idx + '" style="color:#e11d48;" title="刪除此頁">🗑️</button>' +
        '</div>';
      card.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (btn) {
          e.stopPropagation();
          handleThumbAction(btn.getAttribute('data-act'), Number(btn.getAttribute('data-idx')));
          return;
        }
        currentIndex = idx;
        renderStageAndStrip();
      });
      els.pagesStrip.appendChild(card);
    });
  }

  function handleThumbAction(act, idx) {
    if (act === 'prev' && idx > 0) {
      var tmp = pages[idx - 1];
      pages[idx - 1] = pages[idx];
      pages[idx] = tmp;
      currentIndex = idx - 1;
    } else if (act === 'next' && idx < pages.length - 1) {
      var tmp2 = pages[idx + 1];
      pages[idx + 1] = pages[idx];
      pages[idx] = tmp2;
      currentIndex = idx + 1;
    } else if (act === 'dup') {
      var src = pages[idx];
      addPageFromCanvas(
        src.originalCanvas,
        src.label + ' (副本)',
        Object.assign({}, src.settings),
        src.isDemo,
        src.originalDataUrl
      );
      pages[pages.length - 1].strokes = JSON.parse(JSON.stringify(src.strokes));
      reprocessSinglePage(pages[pages.length - 1]);
      showToast('已複製第 ' + (idx + 1) + ' 頁');
    } else if (act === 'del') {
      pages.splice(idx, 1);
      if (currentIndex >= pages.length) currentIndex = Math.max(0, pages.length - 1);
      showToast(pages.length === 0 ? '🗑️ 已刪除，目前返回 0 頁空白乾淨狀態' : '🗑️ 已刪除該頁');
    }
    saveAllPagesToDB();
    renderStageAndStrip();
  }

  var sliderRaf = null;
  function updateCurrentPageSettingsFromUI() {
    var p = pages[currentIndex];
    if (!p) return;
    p.settings.autoWhiten = els.chkWhiten.checked;
    p.settings.whitenStrength = Number(els.rngWhiten.value);
    p.settings.removeColorInk = els.chkColorInk.checked;
    p.settings.colorSensitivity = Number(els.rngColorInk.value);
    p.settings.removePencil = els.chkPencil.checked;
    p.settings.pencilThreshold = Number(els.rngPencil.value);
    p.settings.autoHeaderMask = els.chkHeaderMask.checked;
    p.settings.headerMaskRatio = Number(els.rngHeaderMask.value);
    p.settings.cropPercent = Number(els.rngCrop.value);

    // Update label numbers immediately
    els.valWhiten.textContent = p.settings.whitenStrength + '%';
    els.valColorInk.textContent = p.settings.colorSensitivity + '%';
    els.valPencil.textContent = p.settings.pencilThreshold;
    els.valHeaderMask.textContent = p.settings.headerMaskRatio + '%';
    els.valCrop.textContent = p.settings.cropPercent + '%';

    if (sliderRaf) cancelAnimationFrame(sliderRaf);
    sliderRaf = requestAnimationFrame(function () {
      reprocessSinglePage(p);
      renderStageAndStrip();
      saveAllPagesToDB();
    });
  }

  // Fast Image Import (1480px max dimension for 2.5x faster mobile processing while crisp for A4)
  function handleImageFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    removeDemoPagesIfRealImport();
    showToast('⚡ 正在極速載入 ' + files.length + ' 張試卷（自動保存 Original 原圖底）...');
    var loaded = 0;
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var maxDim = 1480;
          var w = img.width;
          var h = img.height;
          if (w > maxDim || h > maxDim) {
            var scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          var c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          addPageFromCanvas(c, file.name.replace(/\.[^.]+$/, ''), null, false);
          loaded++;
          if (loaded === files.length) {
            saveAllPagesToDB();
            renderStageAndStrip();
            showToast('✅ 已極速載入 ' + files.length + ' 頁（Original 原圖底＋清答案版已同步備妥）！');
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePdfFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (!window.pdfjsLib) {
      showToast('PDF 引擎載入中，請稍候再試');
      return;
    }
    removeDemoPagesIfRealImport();
    var totalAdded = 0;
    for (var f = 0; f < files.length; f++) {
      var file = files[f];
      showToast('📄 正在拆解作業 PDF：' + file.name + ' ...', 5000);
      var arrayBuf = await file.arrayBuffer();
      var pdfDoc = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
      for (var pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        var pdfPage = await pdfDoc.getPage(pageNum);
        var baseVp = pdfPage.getViewport({ scale: 1.0 });
        var targetScale = Math.min(2.0, 1480 / Math.max(baseVp.width, baseVp.height));
        var viewport = pdfPage.getViewport({ scale: targetScale });
        var c = document.createElement('canvas');
        c.width = Math.round(viewport.width);
        c.height = Math.round(viewport.height);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, c.width, c.height);
        await pdfPage.render({ canvasContext: ctx, viewport: viewport }).promise;
        addPageFromCanvas(c, file.name.replace(/\.pdf$/i, '') + ' P.' + pageNum, null, false);
        totalAdded++;
      }
    }
    saveAllPagesToDB();
    renderStageAndStrip();
    showToast('✅ 已拆解並自動清答案：共匯入 ' + totalAdded + ' 頁 PDF（已同時保留 Original 原圖底）！');
  }

  function getCanvasCoords(e) {
    var rect = els.editorCanvas.getBoundingClientRect();
    var scaleX = els.editorCanvas.width / rect.width;
    var scaleY = els.editorCanvas.height / rect.height;
    var clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY)
    };
  }

  function bindCanvasEvents() {
    function onStart(e) {
      if (pages.length === 0) return;
      e.preventDefault();
      isDrawing = true;
      var pt = getCanvasCoords(e);
      if (currentTool === 'brush') {
        activeStroke = { tool: 'brush', size: brushSize, points: [pt] };
      } else {
        activeStroke = { tool: currentTool, size: brushSize, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
      }
    }

    function onMove(e) {
      if (!isDrawing || !activeStroke) return;
      e.preventDefault();
      var pt = getCanvasCoords(e);
      if (activeStroke.tool === 'brush') {
        activeStroke.points.push(pt);
      } else {
        activeStroke.x2 = pt.x;
        activeStroke.y2 = pt.y;
      }
      var p = pages[currentIndex];
      var ctx = els.editorCanvas.getContext('2d');
      ctx.drawImage(p.processedCanvas, 0, 0);
      window.ScannerProcessor.renderStroke(ctx, activeStroke);
      if (activeStroke.tool === 'rect') {
        ctx.save();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          Math.min(activeStroke.x1, activeStroke.x2),
          Math.min(activeStroke.y1, activeStroke.y2),
          Math.abs(activeStroke.x2 - activeStroke.x1),
          Math.abs(activeStroke.y2 - activeStroke.y1)
        );
        ctx.restore();
      }
    }

    function onEnd() {
      if (!isDrawing || !activeStroke) return;
      isDrawing = false;
      var p = pages[currentIndex];
      p.strokes.push(activeStroke);
      activeStroke = null;
      reprocessSinglePage(p);
      saveAllPagesToDB();
      renderStageAndStrip();
    }

    els.editorCanvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    els.editorCanvas.addEventListener('touchstart', onStart, { passive: false });
    els.editorCanvas.addEventListener('touchmove', onMove, { passive: false });
    els.editorCanvas.addEventListener('touchend', onEnd);
  }

  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function downloadOriginalPdfOnly(prefix) {
    var origItems = pages.map(function (p) {
      return { canvas: p.beforeCanvas || p.originalCanvas, marginPt: 12, quality: 0.92 };
    });
    var origBlob = window.LocalPdfGenerator.generateA4PdfBlob(origItems);
    var fname = prefix + '_Original原圖留底.pdf';
    triggerBlobDownload(origBlob, fname);
    return fname;
  }

  function downloadCleanedPdfOnly(prefix) {
    var cleanItems = pages.map(function (p) {
      return { canvas: p.processedCanvas, marginPt: 12, quality: 0.92 };
    });
    var cleanBlob = window.LocalPdfGenerator.generateA4PdfBlob(cleanItems);
    var fname = prefix + '_已清答案學生版.pdf';
    triggerBlobDownload(cleanBlob, fname);
    return fname;
  }

  function bindUIEvents() {
    els.cameraInput.addEventListener('change', function (e) {
      handleImageFiles(e.target.files);
      e.target.value = '';
    });
    els.albumInput.addEventListener('change', function (e) {
      handleImageFiles(e.target.files);
      e.target.value = '';
    });
    els.pdfInput.addEventListener('change', function (e) {
      handlePdfFiles(e.target.files);
      e.target.value = '';
    });

    // Optional small button to load a 1-page sample for testing (marked isDemo=true, 100% deletable)
    els.btnLoadDemo.addEventListener('click', function () {
      var demoC = window.DemoSheetGenerator.createDemoPage1Canvas();
      addPageFromCanvas(demoC, '測試範例 P3 英文小測', defaultSettings(), true);
      saveAllPagesToDB();
      renderStageAndStrip();
      showToast('✨ 已載入 1 頁測試範例（你可以隨時撳 🗑️ 刪除或清空重設）');
    });

    els.btnMagicAll.addEventListener('click', function () {
      if (!pages.length) {
        showToast('請先影相或匯入 PDF 試卷');
        return;
      }
      pages.forEach(function (p) {
        p.settings.autoWhiten = true;
        p.settings.whitenStrength = 70;
        p.settings.removeColorInk = true;
        p.settings.colorSensitivity = 64;
        p.settings.removePencil = true;
        p.settings.pencilThreshold = 148;
        p.settings.autoHeaderMask = true;
        p.settings.headerMaskRatio = 9.0;
        reprocessSinglePage(p);
      });
      saveAllPagesToDB();
      renderStageAndStrip();
      showToast('⚡ 全卷一鍵清答案完成！（Original 原圖底依然安全保留）');
    });

    ['chkWhiten', 'rngWhiten', 'chkColorInk', 'rngColorInk', 'chkPencil', 'rngPencil', 'chkHeaderMask', 'rngHeaderMask', 'rngCrop'].forEach(function (id) {
      els[id].addEventListener('input', updateCurrentPageSettingsFromUI);
      els[id].addEventListener('change', updateCurrentPageSettingsFromUI);
    });

    els.btnRotateLeft.addEventListener('click', function () {
      var p = pages[currentIndex];
      if (!p) return;
      p.settings.rotation = (p.settings.rotation - 90 + 360) % 360;
      reprocessSinglePage(p);
      saveAllPagesToDB();
      renderStageAndStrip();
    });
    els.btnRotateRight.addEventListener('click', function () {
      var p = pages[currentIndex];
      if (!p) return;
      p.settings.rotation = (p.settings.rotation + 90) % 360;
      reprocessSinglePage(p);
      saveAllPagesToDB();
      renderStageAndStrip();
    });

    els.btnApplyAllPages.addEventListener('click', function () {
      var cur = pages[currentIndex];
      if (!cur) return;
      pages.forEach(function (p) {
        p.settings = Object.assign({}, cur.settings);
        reprocessSinglePage(p);
      });
      saveAllPagesToDB();
      renderStageAndStrip();
      showToast('✅ 已將當前濾鏡設定套用到全部 ' + pages.length + ' 頁！');
    });

    els.btnResetPage.addEventListener('click', function () {
      var p = pages[currentIndex];
      if (!p) return;
      p.settings = {
        autoWhiten: false, whitenStrength: 68,
        removeColorInk: false, colorSensitivity: 62,
        removePencil: false, pencilThreshold: 145,
        autoHeaderMask: false, headerMaskRatio: 9.0,
        cropPercent: 0, rotation: 0
      };
      p.strokes = [];
      reprocessSinglePage(p);
      saveAllPagesToDB();
      renderStageAndStrip();
      showToast('🔄 已 100% 還原此頁為 Original 原圖底！可隨時重新調整');
    });

    els.btnDeleteCurrentPage.addEventListener('click', function () {
      if (!pages.length) return;
      handleThumbAction('del', currentIndex);
    });

    function setTool(t) {
      currentTool = t;
      els.toolRect.classList.toggle('active', t === 'rect');
      els.toolBrush.classList.toggle('active', t === 'brush');
      els.toolLine.classList.toggle('active', t === 'line');
    }
    els.toolRect.addEventListener('click', function () { setTool('rect'); });
    els.toolBrush.addEventListener('click', function () { setTool('brush'); });
    els.toolLine.addEventListener('click', function () { setTool('line'); });

    els.rngBrushSize.addEventListener('input', function () {
      brushSize = Number(els.rngBrushSize.value);
      els.valBrushSize.textContent = brushSize + 'px';
    });

    els.btnUndo.addEventListener('click', function () {
      var p = pages[currentIndex];
      if (!p || !p.strokes.length) return;
      p.strokes.pop();
      reprocessSinglePage(p);
      saveAllPagesToDB();
      renderStageAndStrip();
    });

    els.btnClearStrokes.addEventListener('click', function () {
      var p = pages[currentIndex];
      if (!p) return;
      p.strokes = [];
      reprocessSinglePage(p);
      saveAllPagesToDB();
      renderStageAndStrip();
    });

    function setViewMode(m) {
      viewMode = m;
      els.modeAfter.classList.toggle('active', m === 'after');
      els.modeSplit.classList.toggle('active', m === 'split');
      els.modeBefore.classList.toggle('active', m === 'before');
      renderStageAndStrip();
    }
    els.modeAfter.addEventListener('click', function () { setViewMode('after'); });
    els.modeSplit.addEventListener('click', function () { setViewMode('split'); });
    els.modeBefore.addEventListener('click', function () { setViewMode('before'); });

    // 100% True Zero-Page Clear & Reset (No demo page re-inserted!)
    els.btnClearAllPages.addEventListener('click', function () {
      pages = [];
      currentIndex = 0;
      clearScannerDB();
      renderStageAndStrip();
      showToast('🗑️ 已徹底清空全部頁面與暫存（目前 0 頁空白乾淨狀態）');
    });

    els.selGrade.addEventListener('change', updateAutoFilename);
    els.selSubject.addEventListener('change', updateAutoFilename);

    // Button 1: Download BOTH versions at the same time (Original Backup PDF + Cleaned Blank PDF)
    els.btnDownloadBothPdf.addEventListener('click', function () {
      if (!pages.length) {
        showToast('請先影相或匯入試卷先可以下載 PDF');
        return;
      }
      var prefix = getFilenamePrefix();
      showToast('⚡ 正在同步生成兩份 PDF（Original 原圖留底 + 已清答案學生版）...');
      setTimeout(function () {
        var f1 = downloadOriginalPdfOnly(prefix);
        setTimeout(function () {
          var f2 = downloadCleanedPdfOnly(prefix);
          showToast('✅ 已同時下載兩份 PDF：「' + f1 + '」及「' + f2 + '」！', 4200);
        }, 320);
      }, 40);
    });

    // Button 2: Download Original Backup PDF Only
    els.btnDownloadOrigPdf.addEventListener('click', function () {
      if (!pages.length) {
        showToast('請先影相或匯入試卷先可以下載 PDF');
        return;
      }
      var prefix = getFilenamePrefix();
      var f1 = downloadOriginalPdfOnly(prefix);
      showToast('📷 已下載 Original 原圖留底 PDF：' + f1);
    });

    // Button 3: Download Cleaned Student PDF Only
    els.btnDownloadPdf.addEventListener('click', function () {
      if (!pages.length) {
        showToast('請先影相或匯入試卷先可以下載 PDF');
        return;
      }
      var prefix = getFilenamePrefix();
      var f2 = downloadCleanedPdfOnly(prefix);
      showToast('✨ 已下載已清答案學生版 PDF：' + f2);
    });

    els.btnPrint.addEventListener('click', function () {
      if (!pages.length) {
        showToast('請先影相或匯入試卷先可以列印');
        return;
      }
      els.printContainer.innerHTML = '';
      pages.forEach(function (p) {
        var div = document.createElement('div');
        div.className = 'print-page';
        var img = document.createElement('img');
        img.src = p.processedCanvas.toDataURL('image/jpeg', 0.95);
        div.appendChild(img);
        els.printContainer.appendChild(div);
      });
      setTimeout(function () {
        window.print();
      }, 200);
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    initElements();
    updateAutoFilename();
    bindUIEvents();
    bindCanvasEvents();

    // Start at 0 pages by default, or restore unsaved pages from IndexedDB if user had an active session
    restorePagesFromDB().then(function (savedList) {
      if (!savedList || savedList.length === 0) {
        renderStageAndStrip();
        return;
      }
      var loadedCount = 0;
      savedList.forEach(function (item) {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0);
          addPageFromCanvas(c, item.label, item.settings, item.isDemo, item.originalDataUrl);
          pages[pages.length - 1].strokes = item.strokes || [];
          reprocessSinglePage(pages[pages.length - 1]);
          loadedCount++;
          if (loadedCount === savedList.length) {
            renderStageAndStrip();
            showToast('💾 已自動為你恢復上次未清空嘅 ' + loadedCount + ' 頁試卷原圖底！');
          }
        };
        img.src = item.originalDataUrl;
      });
    });
  });
})();
