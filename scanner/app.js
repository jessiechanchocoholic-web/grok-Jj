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

  function defaultSettings() {
    return {
      autoWhiten: true,
      whitenStrength: 68,
      removeColorInk: true,
      colorSensitivity: 62,
      removePencil: true,
      pencilThreshold: 145,
      autoHeaderMask: false,
      headerMaskRatio: 9.0,
      cropPercent: 0,
      rotation: 0
    };
  }

  var els = {};
  function initElements() {
    var ids = [
      'cameraInput', 'pdfInput', 'albumInput', 'btnLoadDemo',
      'btnMagicAll', 'chkWhiten', 'rngWhiten', 'valWhiten',
      'chkColorInk', 'rngColorInk', 'valColorInk',
      'chkPencil', 'rngPencil', 'valPencil',
      'chkHeaderMask', 'rngHeaderMask', 'valHeaderMask',
      'rngCrop', 'valCrop', 'btnRotateLeft', 'btnRotateRight',
      'btnApplyAllPages', 'btnResetPage',
      'toolRect', 'toolBrush', 'toolLine',
      'rngBrushSize', 'valBrushSize', 'btnUndo', 'btnClearStrokes',
      'modeAfter', 'modeSplit', 'modeBefore',
      'beforeBox', 'afterBox', 'beforeCanvas', 'editorCanvas',
      'pageIndicator', 'pagesStrip', 'btnClearAllPages',
      'selGrade', 'selSubject', 'inpFilename',
      'btnDownloadPdf', 'btnPrint', 'pdfPageCount',
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

  function updateAutoFilename() {
    var grade = els.selGrade ? els.selGrade.value : 'P3';
    var subj = els.selSubject ? els.selSubject.value : '英文';
    var today = new Date().toISOString().slice(0, 10);
    if (els.inpFilename) {
      els.inpFilename.value = grade + '_' + subj + '_空白練習卷_' + today + '.pdf';
    }
  }

  function addPageFromCanvas(srcCanvas, label, customSettings) {
    var st = customSettings ? Object.assign({}, defaultSettings(), customSettings) : defaultSettings();
    var pageObj = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      label: label || ('第 ' + (pages.length + 1) + ' 頁'),
      originalCanvas: srcCanvas,
      beforeCanvas: null,
      processedCanvas: null,
      thumbUrl: '',
      settings: st,
      strokes: []
    };
    reprocessSinglePage(pageObj);
    pages.push(pageObj);
    currentIndex = pages.length - 1;
  }

  function reprocessSinglePage(pageObj) {
    var beforeC = window.ScannerProcessor.prepareGeometryCanvas(
      pageObj.originalCanvas,
      pageObj.settings.rotation,
      pageObj.settings.cropPercent
    );
    var res = window.ScannerProcessor.processPageCanvas(
      pageObj.originalCanvas,
      pageObj.settings,
      pageObj.strokes
    );
    pageObj.beforeCanvas = beforeC;
    pageObj.processedCanvas = res.afterCanvas;

    // Create small thumbnail for strip
    var tc = document.createElement('canvas');
    var tw = 160;
    var th = Math.round((res.afterCanvas.height / res.afterCanvas.width) * tw);
    tc.width = tw;
    tc.height = th;
    tc.getContext('2d').drawImage(res.afterCanvas, 0, 0, tw, th);
    pageObj.thumbUrl = tc.toDataURL('image/jpeg', 0.72);
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
    if (pages.length === 0) return;
    if (currentIndex >= pages.length) currentIndex = pages.length - 1;
    var p = pages[currentIndex];
    syncControlsFromCurrentPage();

    // Draw beforeCanvas
    els.beforeCanvas.width = p.beforeCanvas.width;
    els.beforeCanvas.height = p.beforeCanvas.height;
    els.beforeCanvas.getContext('2d').drawImage(p.beforeCanvas, 0, 0);

    // Draw editorCanvas
    els.editorCanvas.width = p.processedCanvas.width;
    els.editorCanvas.height = p.processedCanvas.height;
    els.editorCanvas.getContext('2d').drawImage(p.processedCanvas, 0, 0);

    // Toggle viewMode visibility
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
    els.pdfPageCount.textContent = pages.length;

    // Render thumbnails strip
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
          '<button type="button" class="thumb-btn" data-act="del" data-idx="' + idx + '" style="color:#e11d48;" title="刪除">✕</button>' +
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
      var copyPage = {
        id: 'p_' + Date.now(),
        label: src.label + ' (副本)',
        originalCanvas: src.originalCanvas,
        beforeCanvas: src.beforeCanvas,
        processedCanvas: src.processedCanvas,
        thumbUrl: src.thumbUrl,
        settings: Object.assign({}, src.settings),
        strokes: JSON.parse(JSON.stringify(src.strokes))
      };
      reprocessSinglePage(copyPage);
      pages.splice(idx + 1, 0, copyPage);
      currentIndex = idx + 1;
      showToast('已複製第 ' + (idx + 1) + ' 頁');
    } else if (act === 'del') {
      if (pages.length <= 1) {
        showToast('最少要保留 1 頁試卷');
        return;
      }
      pages.splice(idx, 1);
      if (currentIndex >= pages.length) currentIndex = pages.length - 1;
      showToast('已刪除該頁');
    }
    renderStageAndStrip();
  }

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

    reprocessSinglePage(p);
    renderStageAndStrip();
  }

  // Image & PDF File Import Handlers
  function handleImageFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    showToast('正在載入並清理 ' + files.length + ' 張試卷相片...');
    var loaded = 0;
    files.forEach(function (file, idx) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var maxDim = 1800;
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
          addPageFromCanvas(c, file.name.replace(/\.[^.]+$/, ''));
          loaded++;
          if (loaded === files.length) {
            renderStageAndStrip();
            showToast('✅ 已成功匯入並自動清理 ' + files.length + ' 頁試卷！');
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
    var totalAdded = 0;
    for (var f = 0; f < files.length; f++) {
      var file = files[f];
      showToast('📄 正在拆解作業 PDF：' + file.name + ' ...', 5000);
      var arrayBuf = await file.arrayBuffer();
      var pdfDoc = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
      for (var pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        var pdfPage = await pdfDoc.getPage(pageNum);
        var viewport = pdfPage.getViewport({ scale: 2.0 });
        var c = document.createElement('canvas');
        c.width = Math.round(viewport.width);
        c.height = Math.round(viewport.height);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, c.width, c.height);
        await pdfPage.render({ canvasContext: ctx, viewport: viewport }).promise;
        addPageFromCanvas(c, file.name.replace(/\.pdf$/i, '') + ' P.' + pageNum);
        totalAdded++;
      }
    }
    renderStageAndStrip();
    showToast('✅ 已拆解並自動清答案：共匯入 ' + totalAdded + ' 頁 PDF 作業！');
  }

  // Canvas Pointer Drawing (Whiteout Box, Brush, Black Underline)
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

    function onEnd(e) {
      if (!isDrawing || !activeStroke) return;
      isDrawing = false;
      var p = pages[currentIndex];
      p.strokes.push(activeStroke);
      activeStroke = null;
      reprocessSinglePage(p);
      renderStageAndStrip();
    }

    els.editorCanvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    els.editorCanvas.addEventListener('touchstart', onStart, { passive: false });
    els.editorCanvas.addEventListener('touchmove', onMove, { passive: false });
    els.editorCanvas.addEventListener('touchend', onEnd);
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

    els.btnLoadDemo.addEventListener('click', function () {
      var demoC = window.DemoSheetGenerator.createDemoPage1Canvas();
      addPageFromCanvas(demoC, '示範卷 P3 英文小測', {
        autoWhiten: true,
        whitenStrength: 68,
        removeColorInk: true,
        colorSensitivity: 62,
        removePencil: true,
        pencilThreshold: 145,
        autoHeaderMask: true,
        headerMaskRatio: 9.0
      });
      renderStageAndStrip();
      showToast('✨ 已載入「試用示範卷」並自動清走藍筆答案、紅筆 88 分、鉛筆字同頂部學生名！');
    });

    els.btnMagicAll.addEventListener('click', function () {
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
      renderStageAndStrip();
      showToast('⚡ 超級一鍵全清完成！已清走全部紅藍筆答案、鉛筆字、黑影並遮蓋頂部學生名！');
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
      renderStageAndStrip();
    });
    els.btnRotateRight.addEventListener('click', function () {
      var p = pages[currentIndex];
      if (!p) return;
      p.settings.rotation = (p.settings.rotation + 90) % 360;
      reprocessSinglePage(p);
      renderStageAndStrip();
    });

    els.btnApplyAllPages.addEventListener('click', function () {
      var cur = pages[currentIndex];
      if (!cur) return;
      pages.forEach(function (p) {
        p.settings = Object.assign({}, cur.settings);
        reprocessSinglePage(p);
      });
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
      renderStageAndStrip();
      showToast('已還原呢頁做未清理原圖');
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
      renderStageAndStrip();
    });

    els.btnClearStrokes.addEventListener('click', function () {
      var p = pages[currentIndex];
      if (!p) return;
      p.strokes = [];
      reprocessSinglePage(p);
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

    els.btnClearAllPages.addEventListener('click', function () {
      pages = [];
      var demoC = window.DemoSheetGenerator.createDemoPage1Canvas();
      addPageFromCanvas(demoC, '示範卷 P3 英文小測');
      renderStageAndStrip();
      showToast('已重設工作區');
    });

    els.selGrade.addEventListener('change', updateAutoFilename);
    els.selSubject.addEventListener('change', updateAutoFilename);

    els.btnDownloadPdf.addEventListener('click', function () {
      if (!pages.length) return;
      var fname = (els.inpFilename.value || '空白練習卷.pdf').trim();
      if (!/\.pdf$/i.test(fname)) fname += '.pdf';
      showToast('⬇️ 正在合成高清 A4 PDF（共 ' + pages.length + ' 頁）...');
      setTimeout(function () {
        var items = pages.map(function (p) {
          return { canvas: p.processedCanvas, marginPt: 12, quality: 0.92 };
        });
        var blob = window.LocalPdfGenerator.generateA4PdfBlob(items);
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1500);
        showToast('✅ 已下載 A4 PDF：' + fname + '（無浮水印・即印即用）');
      }, 60);
    });

    els.btnPrint.addEventListener('click', function () {
      if (!pages.length) return;
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

    // Auto-load demo page on launch so Jessie can immediately see Before vs After
    var demoCanvas = window.DemoSheetGenerator.createDemoPage1Canvas();
    addPageFromCanvas(demoCanvas, '示範卷 P3 英文小測', {
      autoWhiten: true,
      whitenStrength: 68,
      removeColorInk: true,
      colorSensitivity: 62,
      removePencil: true,
      pencilThreshold: 145,
      autoHeaderMask: true,
      headerMaskRatio: 9.0
    });
    renderStageAndStrip();
  });
})();
