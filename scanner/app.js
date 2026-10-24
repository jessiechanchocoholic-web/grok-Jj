(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
  }

  // =========================================================================
  // State
  // =========================================================================
  var docs = [];          // Array of Document objects stored in IndexedDB
  var activeDoc = null;   // Currently open Document object
  var currentIndex = 0;   // Current page index inside activeDoc.pages
  var showingOrig = false;
  var drawModeOpen = false;
  var currentTool = 'rect'; // 'rect' | 'brush' | 'line' | 'maskbar'
  var isDrawing = false;
  var activeStroke = null;

  // Crop state
  var cropModeOpen = false;
  var tempCorners = [
    { x: 0.03, y: 0.03 },
    { x: 0.97, y: 0.03 },
    { x: 0.97, y: 0.97 },
    { x: 0.03, y: 0.97 }
  ];
  var draggingCornerIdx = -1;

  // Camera state
  var mediaStream = null;
  var camSimTimer = null;

  // Export state
  var exportVersion = 'cleaned'; // 'cleaned' | 'original' | 'both'
  var exportTargetDoc = null;
  var renameTargetDoc = null;
  var currentPdfBlobUrl = null;

  // =========================================================================
  // IndexedDB Multi-Document Unlimited Storage
  // =========================================================================
  var DB_NAME = 'GrokCamScannerDB_v3';
  var STORE_NAME = 'documents_store';
  var dbPromise = null;

  function openDB() {
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

  function serializeDoc(doc) {
    return {
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt || Date.now(),
      pages: (doc.pages || []).map(function (p) {
        if (!p.originalDataUrl && p.originalCanvas) {
          p.originalDataUrl = p.originalCanvas.toDataURL('image/jpeg', 0.9);
        }
        return {
          id: p.id,
          label: p.label,
          originalDataUrl: p.originalDataUrl,
          thumbUrl: p.thumbUrl || '',
          settings: p.settings,
          strokes: p.strokes || []
        };
      })
    };
  }

  function saveDocToDB(doc) {
    if (!doc) return Promise.resolve();
    doc.updatedAt = Date.now();
    return openDB().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(serializeDoc(doc));
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        } catch (e) {
          resolve();
        }
      });
    });
  }

  function deleteDocFromDB(docId) {
    return openDB().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(docId);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        } catch (e) {
          resolve();
        }
      });
    });
  }

  function loadAllDocsFromDB() {
    return openDB().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = function () {
            var list = (req.result || []).sort(function (a, b) {
              return (b.updatedAt || 0) - (a.updatedAt || 0);
            });
            resolve(list);
          };
          req.onerror = function () { resolve([]); };
        } catch (e) {
          resolve([]);
        }
      });
    });
  }

  // Hydrate canvases for a document when opened or exported
  function hydrateDocPages(doc) {
    var promises = (doc.pages || []).map(function (p) {
      if (p.originalCanvas && p.processedCanvas) {
        return Promise.resolve(p);
      }
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0);
          p.originalCanvas = c;
          reprocessSinglePage(p);
          resolve(p);
        };
        img.onerror = function () { resolve(p); };
        img.src = p.originalDataUrl;
      });
    });
    return Promise.all(promises).then(function () {
      return doc;
    });
  }

  function defaultSettings() {
    return {
      filterMode: 'cleanAnswer', // 'original' | 'magicColor' | 'bw' | 'cleanAnswer'
      autoWhiten: true,
      whitenStrength: 70,
      removeColorInk: true,
      colorSensitivity: 64,
      removePencil: true,
      pencilThreshold: 146,
      autoHeaderMask: true,
      headerMaskRatio: 9.0,
      cropPercent: 0,
      cropCorners: null,
      rotation: 0
    };
  }

  function generateDefaultDocTitle() {
    var now = new Date();
    var m = now.getMonth() + 1;
    var d = now.getDate();
    var seq = docs.length + 1;
    return '試卷_' + m + '月' + d + '日_' + seq;
  }

  function createNewDoc(customTitle) {
    var doc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: customTitle || generateDefaultDocTitle(),
      updatedAt: Date.now(),
      pages: []
    };
    docs.unshift(doc);
    return doc;
  }

  // =========================================================================
  // DOM Elements
  // =========================================================================
  var els = {};
  function initElements() {
    var ids = [
      'cameraFallbackInput', 'importFilesInput', 'statusToast',
      'screenHome', 'screenCamera', 'screenEditor',
      'docCountBadge', 'btnQuickDemo', 'docListContainer', 'homeEmptyState', 'docList',
      'btnStartCamera', 'btnImportFiles',
      'btnCloseCamera', 'btnNativeCamFallback', 'camViewfinder', 'camVideo', 'camSimCanvas',
      'camFlash', 'btnCamImport', 'btnShutter', 'btnCameraDone', 'camThumbImg', 'camSnapBadge', 'camSnapCount',
      'editorTopBar', 'btnBackToHome', 'btnAddMorePages', 'btnPrevPage', 'pageCounterText', 'btnNextPage', 'btnDeletePage',
      'stageArea', 'editorCanvas', 'btnToggleHeaderMask', 'btnCompareOrig',
      'drawFloatingBar', 'toolRect', 'toolBrush', 'toolLine', 'toolMaskbar', 'btnUndoStroke',
      'cropOverlay', 'cropSvg', 'cropPoly', 'cropCorner0', 'cropCorner1', 'cropCorner2', 'cropCorner3',
      'btnCropAuto', 'btnCropFull', 'btnCropCancel', 'btnCropApply',
      'editorBottomDock', 'fltOriginal', 'fltMagicColor', 'fltBw', 'fltCleanAnswer',
      'btnOpenCrop', 'btnToggleDraw', 'btnRotate', 'btnOpenExportSheet',
      'exportSheetBackdrop', 'exportSheet', 'inpDocTitle', 'btnCloseExportSheet',
      'verCleaned', 'verOriginal', 'verBoth',
      'btnSharePdf', 'btnPreviewPdf', 'btnDownloadPdfFile', 'downloadWhereHint',
      'pdfViewerModal', 'btnClosePdfViewer', 'pdfViewerTitle', 'btnPrintFromViewer', 'lnkOpenPdfNewTab', 'pdfViewerFrame',
      'renameModalBackdrop', 'inpRenameDoc', 'btnCancelRename', 'btnConfirmRename',
      'printContainer'
    ];
    ids.forEach(function (id) {
      els[id] = document.getElementById(id);
    });
  }

  var toastTimer = null;
  function showToast(msg, duration) {
    if (!els.statusToast) return;
    els.statusToast.textContent = msg;
    els.statusToast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.statusToast.classList.remove('show');
    }, duration || 2400);
  }

  function switchScreen(screenId) {
    ['screenHome', 'screenCamera', 'screenEditor'].forEach(function (id) {
      if (els[id]) {
        els[id].classList.toggle('active', id === screenId);
      }
    });
    if (screenId !== 'screenCamera') {
      stopCameraStream();
    }
    if (screenId === 'screenHome') {
      renderHomeDocList();
    } else if (screenId === 'screenEditor') {
      renderEditor();
    }
  }

  // =========================================================================
  // Page Processing & Management
  // =========================================================================
  function reprocessSinglePage(pageObj) {
    var res = window.ScannerProcessor.processPageCanvas(
      pageObj.originalCanvas,
      pageObj.settings,
      pageObj.strokes,
      pageObj
    );
    pageObj.beforeCanvas = res.beforeCanvas;
    pageObj.processedCanvas = res.afterCanvas;

    var tc = document.createElement('canvas');
    var tw = 140;
    var th = Math.round((res.afterCanvas.height / res.afterCanvas.width) * tw);
    tc.width = tw;
    tc.height = th;
    tc.getContext('2d').drawImage(res.afterCanvas, 0, 0, tw, th);
    pageObj.thumbUrl = tc.toDataURL('image/jpeg', 0.72);
  }

  function addCanvasToActiveDoc(srcCanvas, label) {
    if (!activeDoc) {
      activeDoc = createNewDoc();
    }
    var pageObj = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      label: label || ('第 ' + (activeDoc.pages.length + 1) + ' 頁'),
      originalCanvas: srcCanvas,
      originalDataUrl: srcCanvas.toDataURL('image/jpeg', 0.9),
      beforeCanvas: null,
      processedCanvas: null,
      thumbUrl: '',
      settings: defaultSettings(),
      strokes: [],
      _filterCacheKey: null,
      _beforeCanvas: null,
      _filteredBaseCanvas: null
    };
    reprocessSinglePage(pageObj);
    activeDoc.pages.push(pageObj);
    currentIndex = activeDoc.pages.length - 1;
    return pageObj;
  }

  // =========================================================================
  // SCREEN A1: Home Document Library
  // =========================================================================
  function formatTime(ts) {
    var d = new Date(ts || Date.now());
    var mo = d.getMonth() + 1;
    var da = d.getDate();
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return mo + '/' + da + ' ' + hh + ':' + mm;
  }

  function renderHomeDocList() {
    // Filter out empty docs
    docs = docs.filter(function (d) { return d.pages && d.pages.length > 0; });
    els.docCountBadge.textContent = docs.length + ' 份';

    if (docs.length === 0) {
      els.homeEmptyState.hidden = false;
      els.docList.innerHTML = '';
      return;
    }

    els.homeEmptyState.hidden = true;
    els.docList.innerHTML = '';

    docs.forEach(function (doc) {
      var firstThumb = (doc.pages[0] && (doc.pages[0].thumbUrl || doc.pages[0].originalDataUrl)) || './icon.svg';
      var card = document.createElement('div');
      card.className = 'doc-card';
      card.setAttribute('data-doc-id', doc.id);
      card.innerHTML =
        '<img class="doc-thumb" src="' + firstThumb + '" alt="" />' +
        '<div class="doc-info">' +
          '<div class="doc-name-row">' +
            '<span class="doc-name">' + escapeHtml(doc.title) + '</span>' +
          '</div>' +
          '<div class="doc-meta">' +
            '<span class="doc-page-pill">' + doc.pages.length + ' 頁</span>' +
            '<span>' + formatTime(doc.updatedAt) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="doc-actions">' +
          '<button type="button" class="doc-act-btn rename" data-act="rename" title="改名">✏️</button>' +
          '<button type="button" class="doc-act-btn share" data-act="share" title="分享/匯出 PDF">📤</button>' +
          '<button type="button" class="doc-act-btn del" data-act="del" title="刪除">🗑️</button>' +
        '</div>';

      card.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (btn) {
          e.stopPropagation();
          var act = btn.getAttribute('data-act');
          if (act === 'rename') {
            openRenameModal(doc);
          } else if (act === 'share') {
            hydrateDocPages(doc).then(function () {
              openExportSheetForDoc(doc);
            });
          } else if (act === 'del') {
            docs = docs.filter(function (x) { return x.id !== doc.id; });
            if (activeDoc && activeDoc.id === doc.id) activeDoc = null;
            deleteDocFromDB(doc.id);
            renderHomeDocList();
            showToast('🗑️ 已刪除試卷文檔');
          }
          return;
        }
        // Open document in Screen B
        hydrateDocPages(doc).then(function () {
          activeDoc = doc;
          currentIndex = 0;
          switchScreen('screenEditor');
        });
      });

      els.docList.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function openRenameModal(doc) {
    renameTargetDoc = doc;
    els.inpRenameDoc.value = doc.title;
    els.renameModalBackdrop.hidden = false;
    setTimeout(function () { els.inpRenameDoc.focus(); }, 40);
  }

  // =========================================================================
  // SCREEN A2: Full-Screen Continuous Camera Mode
  // =========================================================================
  function openCameraMode(startNewDoc) {
    if (startNewDoc || !activeDoc) {
      activeDoc = createNewDoc();
    }
    updateCameraSnapUI();
    switchScreen('screenCamera');
    startCameraStream();
  }

  function startCameraStream() {
    stopCameraStream();
    drawSimCameraPreview();

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1440 }
        },
        audio: false
      }).then(function (stream) {
        mediaStream = stream;
        els.camVideo.srcObject = stream;
        els.camVideo.style.display = 'block';
        els.camSimCanvas.style.display = 'none';
      }).catch(function () {
        // Fallback: keep synthetic viewfinder visible and ready for instant shutter or native camera
        els.camVideo.style.display = 'none';
        els.camSimCanvas.style.display = 'block';
      });
    } else {
      els.camVideo.style.display = 'none';
      els.camSimCanvas.style.display = 'block';
    }
  }

  function stopCameraStream() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (t) { t.stop(); });
      mediaStream = null;
    }
    if (camSimTimer) {
      clearInterval(camSimTimer);
      camSimTimer = null;
    }
  }

  function drawSimCameraPreview() {
    if (!window.DemoSheetGenerator) return;
    var demo = window.DemoSheetGenerator.createDemoPage1Canvas();
    els.camSimCanvas.width = demo.width;
    els.camSimCanvas.height = demo.height;
    els.camSimCanvas.getContext('2d').drawImage(demo, 0, 0);
  }

  function captureShutterFrame() {
    // White flash feedback
    els.camFlash.classList.add('flash');
    setTimeout(function () {
      els.camFlash.classList.remove('flash');
    }, 130);

    var c = document.createElement('canvas');
    if (mediaStream && els.camVideo.videoWidth > 0) {
      var vw = els.camVideo.videoWidth;
      var vh = els.camVideo.videoHeight;
      var maxDim = 1480;
      var scale = Math.min(1, maxDim / Math.max(vw, vh));
      c.width = Math.round(vw * scale);
      c.height = Math.round(vh * scale);
      c.getContext('2d').drawImage(els.camVideo, 0, 0, c.width, c.height);
    } else {
      var demo = window.DemoSheetGenerator.createDemoPage1Canvas();
      c.width = demo.width;
      c.height = demo.height;
      c.getContext('2d').drawImage(demo, 0, 0);
    }

    var p = addCanvasToActiveDoc(c, '快拍第 ' + ((activeDoc ? activeDoc.pages.length : 0) + 1) + ' 頁');
    saveDocToDB(activeDoc);
    updateCameraSnapUI(p);
    showToast('📸 已連拍第 ' + activeDoc.pages.length + ' 張（0 秒繼續拍）', 1200);
  }

  function updateCameraSnapUI(latestPage) {
    var count = activeDoc && activeDoc.pages ? activeDoc.pages.length : 0;
    els.camSnapCount.textContent = count;
    els.camSnapBadge.textContent = count;
    var p = latestPage || (activeDoc && activeDoc.pages[count - 1]);
    if (p && p.thumbUrl) {
      els.camThumbImg.src = p.thumbUrl;
      els.camThumbImg.hidden = false;
    } else {
      els.camThumbImg.hidden = true;
    }
  }

  // =========================================================================
  // SCREEN B: Full-Screen Preview & Editor
  // =========================================================================
  function renderEditor() {
    if (!activeDoc || !activeDoc.pages || activeDoc.pages.length === 0) {
      switchScreen('screenHome');
      return;
    }
    if (currentIndex >= activeDoc.pages.length) {
      currentIndex = activeDoc.pages.length - 1;
    }
    if (currentIndex < 0) currentIndex = 0;

    var p = activeDoc.pages[currentIndex];
    if (!p.processedCanvas || !p.beforeCanvas) {
      reprocessSinglePage(p);
    }

    els.pageCounterText.textContent = '第 ' + (currentIndex + 1) + ' / ' + activeDoc.pages.length + ' 頁';

    // Update filter buttons active state
    var mode = p.settings.filterMode || 'cleanAnswer';
    ['fltOriginal', 'fltMagicColor', 'fltBw', 'fltCleanAnswer'].forEach(function (id) {
      var btn = els[id];
      if (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === mode);
      }
    });

    // Show/hide header mask pill when in cleanAnswer mode
    els.btnToggleHeaderMask.hidden = (mode !== 'cleanAnswer') || cropModeOpen;
    els.btnToggleHeaderMask.classList.toggle('active', !!p.settings.autoHeaderMask);
    els.btnToggleHeaderMask.textContent = p.settings.autoHeaderMask ? '🛡️ 遮頂部名: 開' : '🛡️ 遮頂部名: 關';

    // Draw target canvas
    var srcToShow = showingOrig ? p.beforeCanvas : p.processedCanvas;
    if (cropModeOpen) {
      srcToShow = p.originalCanvas;
    }
    els.editorCanvas.width = srcToShow.width;
    els.editorCanvas.height = srcToShow.height;
    els.editorCanvas.getContext('2d').drawImage(srcToShow, 0, 0);

    els.btnCompareOrig.classList.toggle('showing-orig', showingOrig);
    els.btnCompareOrig.textContent = showingOrig ? '👁️ 原圖顯示中' : '👁️ 按住睇原圖';

    if (cropModeOpen) {
      updateCropOverlayGeometry();
    }
  }

  function setFilterMode(mode) {
    if (!activeDoc || !activeDoc.pages[currentIndex]) return;
    var p = activeDoc.pages[currentIndex];
    p.settings.filterMode = mode;
    if (mode === 'cleanAnswer') {
      p.settings.autoWhiten = true;
      p.settings.removeColorInk = true;
      p.settings.removePencil = true;
    } else if (mode === 'bw' || mode === 'magicColor') {
      p.settings.autoWhiten = true;
      p.settings.removeColorInk = false;
      p.settings.removePencil = false;
    } else {
      p.settings.autoWhiten = false;
      p.settings.removeColorInk = false;
      p.settings.removePencil = false;
    }
    showingOrig = false;
    reprocessSinglePage(p);
    saveDocToDB(activeDoc);
    renderEditor();
  }

  // =========================================================================
  // 4-Corner Perspective Crop (✂️ 裁切拉直)
  // =========================================================================
  function openCropMode() {
    if (!activeDoc || !activeDoc.pages[currentIndex]) return;
    var p = activeDoc.pages[currentIndex];
    drawModeOpen = false;
    els.drawFloatingBar.hidden = true;
    els.btnToggleDraw.classList.remove('active');

    cropModeOpen = true;
    els.cropOverlay.hidden = false;
    els.btnOpenCrop.classList.add('active');

    if (p.settings.cropCorners && p.settings.cropCorners.length === 4) {
      tempCorners = p.settings.cropCorners.map(function (c) { return { x: c.x, y: c.y }; });
    } else {
      tempCorners = window.ScannerProcessor.autoDetectCorners(p.originalCanvas);
    }
    renderEditor();
  }

  function closeCropMode() {
    cropModeOpen = false;
    els.cropOverlay.hidden = true;
    els.btnOpenCrop.classList.remove('active');
    renderEditor();
  }

  function updateCropOverlayGeometry() {
    var stageRect = els.stageArea.getBoundingClientRect();
    var canvasRect = els.editorCanvas.getBoundingClientRect();
    var offX = canvasRect.left - stageRect.left;
    var offY = canvasRect.top - stageRect.top;
    var cw = canvasRect.width;
    var ch = canvasRect.height;

    els.cropSvg.setAttribute('viewBox', '0 0 ' + stageRect.width + ' ' + stageRect.height);
    var polyPts = [];

    for (var i = 0; i < 4; i++) {
      var px = offX + tempCorners[i].x * cw;
      var py = offY + tempCorners[i].y * ch;
      polyPts.push(px.toFixed(1) + ',' + py.toFixed(1));
      var handle = els['cropCorner' + i];
      if (handle) {
        handle.style.left = px + 'px';
        handle.style.top = py + 'px';
      }
    }
    els.cropPoly.setAttribute('points', polyPts.join(' '));
  }

  function bindCropEvents() {
    [0, 1, 2, 3].forEach(function (idx) {
      var h = els['cropCorner' + idx];
      function startDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        draggingCornerIdx = idx;
      }
      h.addEventListener('mousedown', startDrag);
      h.addEventListener('touchstart', startDrag, { passive: false });
    });

    function moveDrag(e) {
      if (draggingCornerIdx < 0 || !cropModeOpen) return;
      e.preventDefault();
      var canvasRect = els.editorCanvas.getBoundingClientRect();
      var clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
      var nx = Math.max(0.01, Math.min(0.99, (clientX - canvasRect.left) / Math.max(1, canvasRect.width)));
      var ny = Math.max(0.01, Math.min(0.99, (clientY - canvasRect.top) / Math.max(1, canvasRect.height)));
      tempCorners[draggingCornerIdx] = { x: nx, y: ny };
      updateCropOverlayGeometry();
    }

    function endDrag() {
      draggingCornerIdx = -1;
    }

    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', moveDrag, { passive: false });
    window.addEventListener('touchend', endDrag);

    els.btnCropAuto.addEventListener('click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      tempCorners = window.ScannerProcessor.autoDetectCorners(activeDoc.pages[currentIndex].originalCanvas);
      updateCropOverlayGeometry();
      showToast('📐 已自動貼合試卷邊緣');
    });

    els.btnCropFull.addEventListener('click', function () {
      tempCorners = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ];
      updateCropOverlayGeometry();
    });

    els.btnCropCancel.addEventListener('click', function () {
      closeCropMode();
    });

    els.btnCropApply.addEventListener('click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      var p = activeDoc.pages[currentIndex];
      p.settings.cropCorners = tempCorners.map(function (c) { return { x: c.x, y: c.y }; });
      cropModeOpen = false;
      els.cropOverlay.hidden = true;
      els.btnOpenCrop.classList.remove('active');
      reprocessSinglePage(p);
      saveDocToDB(activeDoc);
      renderEditor();
      showToast('✂️ 已完成透視拉直裁切！');
    });
  }

  // =========================================================================
  // Manual Touch Draw & Swipe Navigation on Stage
  // =========================================================================
  function getCanvasCoords(e) {
    var rect = els.editorCanvas.getBoundingClientRect();
    var scaleX = els.editorCanvas.width / Math.max(1, rect.width);
    var scaleY = els.editorCanvas.height / Math.max(1, rect.height);
    var clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY)
    };
  }

  function bindStageEvents() {
    var swipeStartX = 0;
    var swipeStartY = 0;
    var isSwiping = false;

    function onStart(e) {
      if (!activeDoc || !activeDoc.pages[currentIndex] || cropModeOpen) return;
      if (!drawModeOpen) {
        // Swipe gesture tracking for page navigation
        var t = e.touches && e.touches[0] ? e.touches[0] : e;
        swipeStartX = t.clientX;
        swipeStartY = t.clientY;
        isSwiping = true;
        return;
      }
      e.preventDefault();
      isDrawing = true;
      showingOrig = false;
      var pt = getCanvasCoords(e);
      if (currentTool === 'brush') {
        activeStroke = { tool: 'brush', size: 28, points: [pt] };
      } else if (currentTool === 'maskbar') {
        activeStroke = { tool: 'maskbar', size: 36, x1: pt.x, y1: pt.y, x2: pt.x + 180, y2: pt.y + 36 };
      } else {
        activeStroke = { tool: currentTool, size: 24, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
      }
    }

    function onMove(e) {
      if (!drawModeOpen) return;
      if (!isDrawing || !activeStroke) return;
      e.preventDefault();
      var pt = getCanvasCoords(e);
      if (activeStroke.tool === 'brush') {
        activeStroke.points.push(pt);
      } else {
        activeStroke.x2 = pt.x;
        activeStroke.y2 = pt.y;
      }
      var p = activeDoc.pages[currentIndex];
      var ctx = els.editorCanvas.getContext('2d');
      ctx.drawImage(p.processedCanvas, 0, 0);
      window.ScannerProcessor.renderStroke(ctx, activeStroke);
      if (activeStroke.tool === 'rect' || activeStroke.tool === 'maskbar') {
        ctx.save();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          Math.min(activeStroke.x1, activeStroke.x2),
          Math.min(activeStroke.y1, activeStroke.y2),
          Math.abs(activeStroke.x2 - activeStroke.x1),
          Math.max(activeStroke.tool === 'maskbar' ? 34 : 0, Math.abs(activeStroke.y2 - activeStroke.y1))
        );
        ctx.restore();
      }
    }

    function onEnd(e) {
      if (!drawModeOpen && isSwiping) {
        isSwiping = false;
        var t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
        if (t && typeof t.clientX === 'number') {
          var dx = t.clientX - swipeStartX;
          var dy = t.clientY - swipeStartY;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0 && currentIndex < activeDoc.pages.length - 1) {
              currentIndex++;
              renderEditor();
            } else if (dx > 0 && currentIndex > 0) {
              currentIndex--;
              renderEditor();
            }
          }
        }
        return;
      }
      if (!isDrawing || !activeStroke) return;
      isDrawing = false;
      var p = activeDoc.pages[currentIndex];
      p.strokes.push(activeStroke);
      activeStroke = null;
      reprocessSinglePage(p);
      saveDocToDB(activeDoc);
      renderEditor();
    }

    els.editorCanvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    els.editorCanvas.addEventListener('touchstart', onStart, { passive: false });
    els.editorCanvas.addEventListener('touchmove', onMove, { passive: false });
    els.editorCanvas.addEventListener('touchend', onEnd);
  }

  // =========================================================================
  // File Import (Images & PDFs)
  // =========================================================================
  async function handleImportedFiles(fileList, startNewDoc) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (startNewDoc || !activeDoc) {
      var firstBase = files[0].name.replace(/\.[^.]+$/, '');
      activeDoc = createNewDoc(firstBase || generateDefaultDocTitle());
    }
    showToast('⚡ 正在載入 ' + files.length + ' 個檔案...');

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
        await importSinglePdfFile(f);
      } else if (f.type.indexOf('image/') === 0 || /\.(jpe?g|png|webp|heic|bmp)$/i.test(f.name)) {
        await importSingleImageFile(f);
      }
    }

    await saveDocToDB(activeDoc);
    switchScreen('screenEditor');
    showToast('✅ 已載入共 ' + activeDoc.pages.length + ' 頁試卷！');
  }

  function importSingleImageFile(file) {
    return new Promise(function (resolve) {
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
          addCanvasToActiveDoc(c, file.name.replace(/\.[^.]+$/, ''));
          resolve();
        };
        img.onerror = function () { resolve(); };
        img.src = ev.target.result;
      };
      reader.onerror = function () { resolve(); };
      reader.readAsDataURL(file);
    });
  }

  async function importSinglePdfFile(file) {
    if (!window.pdfjsLib) return;
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
      addCanvasToActiveDoc(c, file.name.replace(/\.pdf$/i, '') + ' P.' + pageNum);
    }
  }

  // =========================================================================
  // Export Bottom Sheet (Web Share API + In-Screen PDF Preview + Download)
  // =========================================================================
  function openExportSheetForDoc(doc) {
    exportTargetDoc = doc || activeDoc;
    if (!exportTargetDoc || !exportTargetDoc.pages.length) {
      showToast('請先影相或匯入試卷');
      return;
    }
    els.inpDocTitle.value = exportTargetDoc.title || '試卷';
    els.exportSheetBackdrop.hidden = false;
  }

  function closeExportSheet() {
    els.exportSheetBackdrop.hidden = true;
  }

  function syncExportDocTitle() {
    if (!exportTargetDoc) return '試卷';
    var v = (els.inpDocTitle.value || '').trim().replace(/\.pdf$/i, '');
    if (v && v !== exportTargetDoc.title) {
      exportTargetDoc.title = v;
      saveDocToDB(exportTargetDoc);
      if (els.screenHome.classList.contains('active')) {
        renderHomeDocList();
      }
    }
    return exportTargetDoc.title || '試卷';
  }

  function buildPdfBundlesForTarget(ver) {
    var doc = exportTargetDoc || activeDoc;
    var baseTitle = syncExportDocTitle();
    var bundles = [];

    if (ver === 'cleaned' || ver === 'both') {
      var cleanItems = doc.pages.map(function (p) {
        if (!p.processedCanvas) reprocessSinglePage(p);
        return { canvas: p.processedCanvas, marginPt: 12, quality: 0.92 };
      });
      var cleanBlob = window.LocalPdfGenerator.generateA4PdfBlob(cleanItems);
      var cleanName = baseTitle + '_已清答案版.pdf';
      bundles.push({ blob: cleanBlob, filename: cleanName });
    }

    if (ver === 'original' || ver === 'both') {
      var origItems = doc.pages.map(function (p) {
        if (!p.beforeCanvas) reprocessSinglePage(p);
        return { canvas: p.beforeCanvas || p.originalCanvas, marginPt: 12, quality: 0.92 };
      });
      var origBlob = window.LocalPdfGenerator.generateA4PdfBlob(origItems);
      var origName = baseTitle + '_Original原圖版.pdf';
      bundles.push({ blob: origBlob, filename: origName });
    }

    return bundles;
  }

  async function handleWebSharePdf() {
    var bundles = buildPdfBundlesForTarget(exportVersion);
    if (!bundles.length) return;

    try {
      var files = bundles.map(function (b) {
        return new File([b.blob], b.filename, { type: 'application/pdf' });
      });
      if (navigator.canShare && navigator.canShare({ files: files })) {
        await navigator.share({
          files: files,
          title: bundles[0].filename
        });
        showToast('✅ 已打開系統分享選單！');
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }

    // Fallback when browser doesn't support File Web Share: open in-screen PDF preview directly
    openInAppPdfPreview(bundles[0].blob, bundles[0].filename);
    showToast('📖 此瀏覽器未支援直接傳檔，已為你直接打開 PDF 預覽！');
  }

  function openInAppPdfPreview(blob, filename) {
    if (currentPdfBlobUrl) {
      URL.revokeObjectURL(currentPdfBlobUrl);
    }
    currentPdfBlobUrl = URL.createObjectURL(blob);
    els.pdfViewerTitle.textContent = filename;
    els.pdfViewerFrame.src = currentPdfBlobUrl;
    els.lnkOpenPdfNewTab.href = currentPdfBlobUrl;
    els.pdfViewerModal.hidden = false;
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
    }, 2500);
  }

  // =========================================================================
  // Bind All UI Events
  // =========================================================================
  function bindEvents() {
    // Home Screen actions
    els.btnStartCamera.addEventListener('click', function () {
      openCameraMode(true);
    });

    els.btnImportFiles.addEventListener('click', function () {
      activeDoc = null;
      els.importFilesInput.click();
    });

    els.btnQuickDemo.addEventListener('click', function () {
      var doc = createNewDoc('示範試卷_P3英文');
      activeDoc = doc;
      var demoC = window.DemoSheetGenerator.createDemoPage1Canvas();
      addCanvasToActiveDoc(demoC, 'P3 英文小測');
      saveDocToDB(doc).then(function () {
        switchScreen('screenEditor');
        showToast('✨ 已載入示範試卷並自動清答案！');
      });
    });

    // File inputs
    els.cameraFallbackInput.addEventListener('change', function (e) {
      handleImportedFiles(e.target.files, false);
      e.target.value = '';
    });

    els.importFilesInput.addEventListener('change', function (e) {
      var fromHome = els.screenHome.classList.contains('active');
      handleImportedFiles(e.target.files, fromHome);
      e.target.value = '';
    });

    // Camera Screen actions
    els.btnCloseCamera.addEventListener('click', function () {
      if (activeDoc && activeDoc.pages.length > 0) {
        switchScreen('screenEditor');
      } else {
        switchScreen('screenHome');
      }
    });

    els.btnNativeCamFallback.addEventListener('click', function () {
      els.cameraFallbackInput.click();
    });

    els.btnCamImport.addEventListener('click', function () {
      els.importFilesInput.click();
    });

    els.btnShutter.addEventListener('click', function () {
      captureShutterFrame();
    });

    els.btnCameraDone.addEventListener('click', function () {
      if (!activeDoc || activeDoc.pages.length === 0) {
        captureShutterFrame();
      }
      switchScreen('screenEditor');
    });

    // Editor Top Bar
    els.btnBackToHome.addEventListener('click', function () {
      cropModeOpen = false;
      els.cropOverlay.hidden = true;
      drawModeOpen = false;
      els.drawFloatingBar.hidden = true;
      saveDocToDB(activeDoc).then(function () {
        switchScreen('screenHome');
      });
    });

    els.btnAddMorePages.addEventListener('click', function () {
      openCameraMode(false);
    });

    els.btnPrevPage.addEventListener('click', function () {
      if (!activeDoc || currentIndex <= 0) return;
      currentIndex--;
      renderEditor();
    });

    els.btnNextPage.addEventListener('click', function () {
      if (!activeDoc || currentIndex >= activeDoc.pages.length - 1) return;
      currentIndex++;
      renderEditor();
    });

    els.btnDeletePage.addEventListener('click', function () {
      if (!activeDoc || !activeDoc.pages.length) return;
      activeDoc.pages.splice(currentIndex, 1);
      if (activeDoc.pages.length === 0) {
        docs = docs.filter(function (d) { return d.id !== activeDoc.id; });
        deleteDocFromDB(activeDoc.id);
        activeDoc = null;
        switchScreen('screenHome');
        showToast('🗑️ 已刪除此試卷');
        return;
      }
      if (currentIndex >= activeDoc.pages.length) {
        currentIndex = activeDoc.pages.length - 1;
      }
      saveDocToDB(activeDoc);
      renderEditor();
      showToast('🗑️ 已刪除此頁');
    });

    // Floating Stage Pills
    els.btnToggleHeaderMask.addEventListener('click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      var p = activeDoc.pages[currentIndex];
      p.settings.autoHeaderMask = !p.settings.autoHeaderMask;
      reprocessSinglePage(p);
      saveDocToDB(activeDoc);
      renderEditor();
      showToast(p.settings.autoHeaderMask ? '🛡️ 已開啟遮頂部校名/姓名' : '🛡️ 已關閉遮頂部名');
    });

    // Hold or Click to compare Original
    var holdActive = false;
    els.btnCompareOrig.addEventListener('mousedown', function () {
      holdActive = true;
      showingOrig = true;
      renderEditor();
    });
    window.addEventListener('mouseup', function () {
      if (holdActive) {
        holdActive = false;
        showingOrig = false;
        if (els.screenEditor.classList.contains('active')) renderEditor();
      }
    });
    els.btnCompareOrig.addEventListener('touchstart', function (e) {
      e.preventDefault();
      showingOrig = !showingOrig;
      renderEditor();
    }, { passive: false });
    els.btnCompareOrig.addEventListener('click', function () {
      showingOrig = !showingOrig;
      renderEditor();
    });

    // Bottom Strip: 4 Filters
    ['fltOriginal', 'fltMagicColor', 'fltBw', 'fltCleanAnswer'].forEach(function (id) {
      els[id].addEventListener('click', function () {
        if (cropModeOpen) closeCropMode();
        setFilterMode(els[id].getAttribute('data-filter'));
      });
    });

    // Crop button
    els.btnOpenCrop.addEventListener('click', function () {
      if (cropModeOpen) {
        closeCropMode();
      } else {
        openCropMode();
      }
    });

    // Manual Touch Draw toggle & sub-tools
    els.btnToggleDraw.addEventListener('click', function () {
      if (cropModeOpen) closeCropMode();
      drawModeOpen = !drawModeOpen;
      els.drawFloatingBar.hidden = !drawModeOpen;
      els.btnToggleDraw.classList.toggle('active', drawModeOpen);
      if (drawModeOpen) {
        showToast('🖌️ 請直接喺試卷上拉白框／塗改／補橫線');
      }
    });

    function selectDrawTool(toolName) {
      currentTool = toolName;
      ['toolRect', 'toolBrush', 'toolLine', 'toolMaskbar'].forEach(function (id) {
        var map = { toolRect: 'rect', toolBrush: 'brush', toolLine: 'line', toolMaskbar: 'maskbar' };
        els[id].classList.toggle('active', map[id] === toolName);
      });
    }
    els.toolRect.addEventListener('click', function () { selectDrawTool('rect'); });
    els.toolBrush.addEventListener('click', function () { selectDrawTool('brush'); });
    els.toolLine.addEventListener('click', function () { selectDrawTool('line'); });
    els.toolMaskbar.addEventListener('click', function () { selectDrawTool('maskbar'); });

    els.btnUndoStroke.addEventListener('click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      var p = activeDoc.pages[currentIndex];
      if (!p.strokes.length) return;
      p.strokes.pop();
      reprocessSinglePage(p);
      saveDocToDB(activeDoc);
      renderEditor();
      showToast('↩️ 已復原上一步');
    });

    // Rotate button
    els.btnRotate.addEventListener('click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      if (cropModeOpen) closeCropMode();
      var p = activeDoc.pages[currentIndex];
      p.settings.rotation = ((p.settings.rotation || 0) + 90) % 360;
      reprocessSinglePage(p);
      saveDocToDB(activeDoc);
      renderEditor();
    });

    // Export Sheet open/close
    els.btnOpenExportSheet.addEventListener('click', function () {
      openExportSheetForDoc(activeDoc);
    });
    els.btnCloseExportSheet.addEventListener('click', closeExportSheet);
    els.exportSheetBackdrop.addEventListener('click', function (e) {
      if (e.target === els.exportSheetBackdrop) closeExportSheet();
    });

    // Version Tabs inside Export Sheet
    ['verCleaned', 'verOriginal', 'verBoth'].forEach(function (id) {
      els[id].addEventListener('click', function () {
        exportVersion = els[id].getAttribute('data-ver');
        ['verCleaned', 'verOriginal', 'verBoth'].forEach(function (other) {
          els[other].classList.toggle('active', other === id);
        });
      });
    });

    // 3 Big Export Actions
    els.btnSharePdf.addEventListener('click', function () {
      handleWebSharePdf();
    });

    els.btnPreviewPdf.addEventListener('click', function () {
      var bundles = buildPdfBundlesForTarget(exportVersion);
      if (!bundles.length) return;
      openInAppPdfPreview(bundles[0].blob, bundles[0].filename);
    });

    els.btnDownloadPdfFile.addEventListener('click', function () {
      var bundles = buildPdfBundlesForTarget(exportVersion);
      if (!bundles.length) return;
      bundles.forEach(function (b, idx) {
        setTimeout(function () {
          triggerBlobDownload(b.blob, b.filename);
        }, idx * 280);
      });
      showToast('⬇️ 已下載 PDF！請睇下方提示搵返檔案', 3600);
    });

    // In-App PDF Viewer actions
    els.btnClosePdfViewer.addEventListener('click', function () {
      els.pdfViewerModal.hidden = true;
    });

    els.btnPrintFromViewer.addEventListener('click', function () {
      var doc = exportTargetDoc || activeDoc;
      if (!doc || !doc.pages.length) return;
      els.printContainer.innerHTML = '';
      doc.pages.forEach(function (p) {
        var div = document.createElement('div');
        div.className = 'print-page';
        var img = document.createElement('img');
        var c = exportVersion === 'original' ? (p.beforeCanvas || p.originalCanvas) : p.processedCanvas;
        img.src = c.toDataURL('image/jpeg', 0.94);
        div.appendChild(img);
        els.printContainer.appendChild(div);
      });
      setTimeout(function () { window.print(); }, 150);
    });

    // Rename Modal actions
    els.btnCancelRename.addEventListener('click', function () {
      els.renameModalBackdrop.hidden = true;
    });
    els.btnConfirmRename.addEventListener('click', function () {
      if (renameTargetDoc) {
        var v = els.inpRenameDoc.value.trim();
        if (v) {
          renameTargetDoc.title = v;
          saveDocToDB(renameTargetDoc);
          renderHomeDocList();
          showToast('✅ 已更新試卷名稱');
        }
      }
      els.renameModalBackdrop.hidden = true;
    });
  }

  // =========================================================================
  // Init
  // =========================================================================
  window.addEventListener('DOMContentLoaded', function () {
    initElements();
    bindEvents();
    bindStageEvents();
    bindCropEvents();

    loadAllDocsFromDB().then(function (savedDocs) {
      docs = savedDocs || [];
      renderHomeDocList();
    });
  });
})();
