(function () {
  'use strict';

  if (window.__scannerAppInitialized) return;
  window.__scannerAppInitialized = true;

  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
  }

  // =========================================================================
  // Safe Fallback Guards (in case an older cached script is loaded)
  // =========================================================================
  function ensureDependencies() {
    var proc = window.ScannerProcessor || window.ExamProcessor || {};
    if (!proc.autoDetectCorners) {
      proc.autoDetectCorners = function () {
        return [
          { x: 0.03, y: 0.03 },
          { x: 0.97, y: 0.03 },
          { x: 0.97, y: 0.97 },
          { x: 0.03, y: 0.97 }
        ];
      };
    }
    if (!proc.rotateStrokes90CW) {
      proc.rotateStrokes90CW = function (strokes, oldW, oldH) {
        if (!strokes || !strokes.length || !oldW || !oldH) return strokes || [];
        return strokes.map(function (st) {
          if (!st) return st;
          if (st.tool === 'brush') {
            return {
              tool: 'brush',
              size: st.size || 28,
              points: (st.points || []).map(function (pt) {
                return { x: Math.round(oldH - pt.y), y: Math.round(pt.x) };
              })
            };
          }
          if (st.tool === 'rect' || st.tool === 'maskbar') {
            var rx = Math.min(st.x1, st.x2);
            var ry = Math.min(st.y1, st.y2);
            var rw = Math.abs(st.x2 - st.x1);
            var rh = Math.abs(st.y2 - st.y1);
            if (st.tool === 'maskbar' && rh < 28 && rw >= rh) rh = 34;
            return {
              tool: 'rect',
              size: st.size || 24,
              x1: Math.round(oldH - (ry + rh)),
              y1: Math.round(rx),
              x2: Math.round(oldH - ry),
              y2: Math.round(rx + rw)
            };
          }
          if (st.tool === 'line') {
            var dy = Math.abs(st.y2 - st.y1);
            var dx = Math.abs(st.x2 - st.x1);
            var x2 = (dy > dx * 3) ? st.x1 : st.x2;
            var y2 = (dx > dy * 3) ? st.y1 : st.y2;
            return {
              tool: 'line',
              size: st.size || 18,
              x1: Math.round(oldH - st.y1),
              y1: Math.round(st.x1),
              x2: Math.round(oldH - y2),
              y2: Math.round(x2)
            };
          }
          return st;
        });
      };
    }
    window.ScannerProcessor = proc;
    window.ExamProcessor = proc;

    if (!window.DemoSheetGenerator || !window.DemoSheetGenerator.createDemoPage1Canvas) {
      window.DemoSheetGenerator = {
        createDemoPage1Canvas: function () {
          var c = document.createElement('canvas');
          c.width = 1000;
          c.height = 1414;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.fillStyle = '#111827';
          ctx.font = 'bold 32px sans-serif';
          ctx.fillText('P.3 English Grammar Quiz', 80, 140);
          return c;
        }
      };
    }
  }
  ensureDependencies();

  // Null-safe event listener helper
  function on(el, evt, fn, opts) {
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener(evt, fn, opts || false);
    }
  }

  // =========================================================================
  // State
  // =========================================================================
  var docs = [];          // Array of Document objects stored in IndexedDB / memory
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

  // Expose state for automated inspection
  window.__scannerAppState = {
    get showingOrig() { return showingOrig; },
    get comparingOriginal() { return showingOrig; },
    get activeDoc() { return activeDoc; },
    get currentIndex() { return currentIndex; },
    get docs() { return docs; }
  };

  // =========================================================================
  // IndexedDB Multi-Document Unlimited Storage (with 800ms iOS Timeout Guard)
  // =========================================================================
  var DB_NAME = 'GrokCamScannerDB_v3';
  var STORE_NAME = 'documents_store';
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var settled = false;
      function done(val) {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      }
      var timer = setTimeout(function () {
        done(null);
      }, 800);

      if (!window.indexedDB) {
        clearTimeout(timer);
        done(null);
        return;
      }
      try {
        var req = window.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function (e) {
          try {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
          } catch (err) {}
        };
        req.onsuccess = function (e) {
          clearTimeout(timer);
          done(e.target.result);
        };
        req.onerror = function () {
          clearTimeout(timer);
          done(null);
        };
        req.onblocked = function () {
          clearTimeout(timer);
          done(null);
        };
      } catch (e) {
        clearTimeout(timer);
        done(null);
      }
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
        var timer = setTimeout(resolve, 600);
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(serializeDoc(doc));
          tx.oncomplete = function () { clearTimeout(timer); resolve(); };
          tx.onerror = function () { clearTimeout(timer); resolve(); };
        } catch (e) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  function deleteDocFromDB(docId) {
    return openDB().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        var timer = setTimeout(resolve, 600);
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(docId);
          tx.oncomplete = function () { clearTimeout(timer); resolve(); };
          tx.onerror = function () { clearTimeout(timer); resolve(); };
        } catch (e) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  function loadAllDocsFromDB() {
    return openDB().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve) {
        var timer = setTimeout(function () { resolve([]); }, 800);
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = function () {
            clearTimeout(timer);
            var list = (req.result || []).sort(function (a, b) {
              return (b.updatedAt || 0) - (a.updatedAt || 0);
            });
            resolve(list);
          };
          req.onerror = function () { clearTimeout(timer); resolve([]); };
        } catch (e) {
          clearTimeout(timer);
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
      'btnCloseCamera', 'btnNativeCamFallback', 'btnCamFallbackBig', 'camViewfinder', 'camVideo', 'camSimCanvas',
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
    if (!els.docCountBadge || !els.homeEmptyState || !els.docList) return;
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

      on(card, 'click', function (e) {
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
    if (els.inpRenameDoc) els.inpRenameDoc.value = doc.title;
    if (els.renameModalBackdrop) els.renameModalBackdrop.hidden = false;
    setTimeout(function () { if (els.inpRenameDoc) els.inpRenameDoc.focus(); }, 40);
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
    if (els.btnCamFallbackBig) els.btnCamFallbackBig.hidden = false;

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
        if (els.camVideo) {
          els.camVideo.srcObject = stream;
          els.camVideo.style.display = 'block';
        }
        if (els.camSimCanvas) els.camSimCanvas.style.display = 'none';
        if (els.btnCamFallbackBig) els.btnCamFallbackBig.hidden = true;
      }).catch(function () {
        if (els.camVideo) els.camVideo.style.display = 'none';
        if (els.camSimCanvas) els.camSimCanvas.style.display = 'block';
        if (els.btnCamFallbackBig) els.btnCamFallbackBig.hidden = false;
      });
    } else {
      if (els.camVideo) els.camVideo.style.display = 'none';
      if (els.camSimCanvas) els.camSimCanvas.style.display = 'block';
      if (els.btnCamFallbackBig) els.btnCamFallbackBig.hidden = false;
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
    if (!window.DemoSheetGenerator || !els.camSimCanvas) return;
    var demo = window.DemoSheetGenerator.createDemoPage1Canvas();
    els.camSimCanvas.width = demo.width;
    els.camSimCanvas.height = demo.height;
    els.camSimCanvas.getContext('2d').drawImage(demo, 0, 0);
  }

  function captureShutterFrame() {
    if (els.camFlash) {
      els.camFlash.classList.add('flash');
      setTimeout(function () {
        els.camFlash.classList.remove('flash');
      }, 130);
    }

    var c = document.createElement('canvas');
    if (mediaStream && els.camVideo && els.camVideo.videoWidth > 0) {
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
    if (els.camSnapCount) els.camSnapCount.textContent = count;
    if (els.camSnapBadge) els.camSnapBadge.textContent = count;
    var p = latestPage || (activeDoc && activeDoc.pages[count - 1]);
    if (els.camThumbImg) {
      if (p && p.thumbUrl) {
        els.camThumbImg.src = p.thumbUrl;
        els.camThumbImg.hidden = false;
      } else {
        els.camThumbImg.hidden = true;
      }
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

    if (els.pageCounterText) {
      els.pageCounterText.textContent = '第 ' + (currentIndex + 1) + ' / ' + activeDoc.pages.length + ' 頁';
    }

    var mode = p.settings.filterMode || 'cleanAnswer';
    ['fltOriginal', 'fltMagicColor', 'fltBw', 'fltCleanAnswer'].forEach(function (id) {
      var btn = els[id];
      if (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === mode);
      }
    });

    if (els.btnToggleHeaderMask) {
      els.btnToggleHeaderMask.hidden = (mode !== 'cleanAnswer') || cropModeOpen;
      els.btnToggleHeaderMask.classList.toggle('active', !!p.settings.autoHeaderMask);
      els.btnToggleHeaderMask.textContent = p.settings.autoHeaderMask ? '🛡️ 遮頂部名: 開' : '🛡️ 遮頂部名: 關';
    }

    var srcToShow = showingOrig ? p.beforeCanvas : p.processedCanvas;
    if (cropModeOpen) {
      srcToShow = p.originalCanvas;
    }
    if (els.editorCanvas && srcToShow) {
      els.editorCanvas.width = srcToShow.width;
      els.editorCanvas.height = srcToShow.height;
      els.editorCanvas.getContext('2d').drawImage(srcToShow, 0, 0);
    }

    if (els.btnCompareOrig) {
      els.btnCompareOrig.classList.toggle('showing-orig', showingOrig);
      els.btnCompareOrig.textContent = showingOrig ? '👁️ 原圖顯示中' : '👁️ 按住睇原圖';
    }

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
    if (els.drawFloatingBar) els.drawFloatingBar.hidden = true;
    if (els.btnToggleDraw) els.btnToggleDraw.classList.remove('active');

    cropModeOpen = true;
    if (els.cropOverlay) els.cropOverlay.hidden = false;
    if (els.btnOpenCrop) els.btnOpenCrop.classList.add('active');

    if (p.settings.cropCorners && p.settings.cropCorners.length === 4) {
      tempCorners = p.settings.cropCorners.map(function (c) { return { x: c.x, y: c.y }; });
    } else {
      tempCorners = window.ScannerProcessor.autoDetectCorners(p.originalCanvas);
    }
    renderEditor();
  }

  function closeCropMode() {
    cropModeOpen = false;
    if (els.cropOverlay) els.cropOverlay.hidden = true;
    if (els.btnOpenCrop) els.btnOpenCrop.classList.remove('active');
    renderEditor();
  }

  function updateCropOverlayGeometry() {
    if (!els.stageArea || !els.editorCanvas || !els.cropSvg || !els.cropPoly) return;
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
      on(h, 'mousedown', startDrag);
      on(h, 'touchstart', startDrag, { passive: false });
    });

    function moveDrag(e) {
      if (draggingCornerIdx < 0 || !cropModeOpen || !els.editorCanvas) return;
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

    on(window, 'mousemove', moveDrag);
    on(window, 'mouseup', endDrag);
    on(window, 'touchmove', moveDrag, { passive: false });
    on(window, 'touchend', endDrag);

    on(els.btnCropAuto, 'click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      tempCorners = window.ScannerProcessor.autoDetectCorners(activeDoc.pages[currentIndex].originalCanvas);
      updateCropOverlayGeometry();
      showToast('📐 已自動貼合試卷邊緣');
    });

    on(els.btnCropFull, 'click', function () {
      tempCorners = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ];
      updateCropOverlayGeometry();
    });

    on(els.btnCropCancel, 'click', function () {
      closeCropMode();
    });

    on(els.btnCropApply, 'click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      var p = activeDoc.pages[currentIndex];
      p.settings.cropCorners = tempCorners.map(function (c) { return { x: c.x, y: c.y }; });
      cropModeOpen = false;
      if (els.cropOverlay) els.cropOverlay.hidden = true;
      if (els.btnOpenCrop) els.btnOpenCrop.classList.remove('active');
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
    if (!els.editorCanvas) return;
    var swipeStartX = 0;
    var swipeStartY = 0;
    var isSwiping = false;

    function onStart(e) {
      if (!activeDoc || !activeDoc.pages[currentIndex] || cropModeOpen) return;
      if (!drawModeOpen) {
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

    on(els.editorCanvas, 'mousedown', onStart);
    on(window, 'mousemove', onMove);
    on(window, 'mouseup', onEnd);
    on(els.editorCanvas, 'touchstart', onStart, { passive: false });
    on(els.editorCanvas, 'touchmove', onMove, { passive: false });
    on(els.editorCanvas, 'touchend', onEnd);
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
    if (els.inpDocTitle) els.inpDocTitle.value = exportTargetDoc.title || '試卷';
    if (els.exportSheetBackdrop) els.exportSheetBackdrop.hidden = false;
  }

  function closeExportSheet() {
    if (els.exportSheetBackdrop) els.exportSheetBackdrop.hidden = true;
  }

  function syncExportDocTitle() {
    if (!exportTargetDoc) return '試卷';
    var v = (els.inpDocTitle ? els.inpDocTitle.value : '').trim().replace(/\.pdf$/i, '');
    if (v && v !== exportTargetDoc.title) {
      exportTargetDoc.title = v;
      saveDocToDB(exportTargetDoc);
      if (els.screenHome && els.screenHome.classList.contains('active')) {
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

    openInAppPdfPreview(bundles[0].blob, bundles[0].filename);
    showToast('📖 此瀏覽器未支援直接傳檔，已為你直接打開 PDF 預覽！');
  }

  function openInAppPdfPreview(blob, filename) {
    if (currentPdfBlobUrl) {
      URL.revokeObjectURL(currentPdfBlobUrl);
    }
    currentPdfBlobUrl = URL.createObjectURL(blob);
    if (els.pdfViewerTitle) els.pdfViewerTitle.textContent = filename;
    if (els.pdfViewerFrame) els.pdfViewerFrame.src = currentPdfBlobUrl;
    if (els.lnkOpenPdfNewTab) els.lnkOpenPdfNewTab.href = currentPdfBlobUrl;
    if (els.pdfViewerModal) els.pdfViewerModal.hidden = false;
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
  // Bind All UI Events (Null-Safe & Synchronous Before IndexedDB)
  // =========================================================================
  function bindEvents() {
    // Home Screen actions
    on(els.btnStartCamera, 'click', function () {
      openCameraMode(true);
    });

    // Note: els.btnImportFiles, els.btnCamImport, els.btnNativeCamFallback, els.btnCamFallbackBig
    // are native <label for="..."> elements so iOS Safari opens the file/camera picker natively!
    // We only bind keyboard Enter/Space for accessibility (never call input.click() on label click).
    [
      { label: els.btnImportFiles, input: els.importFilesInput },
      { label: els.btnCamImport, input: els.importFilesInput },
      { label: els.btnNativeCamFallback, input: els.cameraFallbackInput },
      { label: els.btnCamFallbackBig, input: els.cameraFallbackInput }
    ].forEach(function (pair) {
      on(pair.label, 'keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (pair.input) pair.input.click();
        }
      });
    });

    on(els.btnQuickDemo, 'click', function () {
      var doc = createNewDoc('示範試卷_P3英文');
      activeDoc = doc;
      var demoC = window.DemoSheetGenerator.createDemoPage1Canvas();
      addCanvasToActiveDoc(demoC, 'P3 英文小測');
      switchScreen('screenEditor');
      showToast('✨ 已載入示範試卷並自動清答案！');
      saveDocToDB(doc);
    });

    // File inputs change handlers
    on(els.cameraFallbackInput, 'change', function (e) {
      var fromHome = els.screenHome && els.screenHome.classList.contains('active');
      handleImportedFiles(e.target.files, fromHome);
      e.target.value = '';
    });

    on(els.importFilesInput, 'change', function (e) {
      var fromHome = els.screenHome && els.screenHome.classList.contains('active');
      handleImportedFiles(e.target.files, fromHome);
      e.target.value = '';
    });

    // Camera Screen actions
    on(els.btnCloseCamera, 'click', function () {
      if (activeDoc && activeDoc.pages.length > 0) {
        switchScreen('screenEditor');
      } else {
        switchScreen('screenHome');
      }
    });

    on(els.btnShutter, 'click', function () {
      captureShutterFrame();
    });

    on(els.btnCameraDone, 'click', function () {
      if (!activeDoc || activeDoc.pages.length === 0) {
        captureShutterFrame();
      }
      switchScreen('screenEditor');
    });

    // Editor Top Bar
    on(els.btnBackToHome, 'click', function () {
      cropModeOpen = false;
      if (els.cropOverlay) els.cropOverlay.hidden = true;
      drawModeOpen = false;
      if (els.drawFloatingBar) els.drawFloatingBar.hidden = true;
      switchScreen('screenHome');
      saveDocToDB(activeDoc);
    });

    on(els.btnAddMorePages, 'click', function () {
      openCameraMode(false);
    });

    on(els.btnPrevPage, 'click', function () {
      if (!activeDoc || currentIndex <= 0) return;
      currentIndex--;
      renderEditor();
    });

    on(els.btnNextPage, 'click', function () {
      if (!activeDoc || currentIndex >= activeDoc.pages.length - 1) return;
      currentIndex++;
      renderEditor();
    });

    on(els.btnDeletePage, 'click', function () {
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
    on(els.btnToggleHeaderMask, 'click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      var p = activeDoc.pages[currentIndex];
      p.settings.autoHeaderMask = !p.settings.autoHeaderMask;
      reprocessSinglePage(p);
      saveDocToDB(activeDoc);
      renderEditor();
      showToast(p.settings.autoHeaderMask ? '🛡️ 已開啟遮頂部校名/姓名' : '🛡️ 已關閉遮頂部名');
    });

    // Hold to compare Original (pointerdown -> show original, pointerup/pointercancel/pointerleave -> restore cleaned)
    var pointerHoldingOrig = false;
    function startHoldOrig(e) {
      if (e && e.type === 'touchstart') e.preventDefault();
      pointerHoldingOrig = true;
      showingOrig = true;
      renderEditor();
    }
    function endHoldOrig() {
      if (!pointerHoldingOrig && !showingOrig) return;
      pointerHoldingOrig = false;
      showingOrig = false;
      if (els.screenEditor && els.screenEditor.classList.contains('active')) {
        renderEditor();
      }
    }
    on(els.btnCompareOrig, 'pointerdown', startHoldOrig);
    on(els.btnCompareOrig, 'pointerup', endHoldOrig);
    on(els.btnCompareOrig, 'pointercancel', endHoldOrig);
    on(els.btnCompareOrig, 'pointerleave', endHoldOrig);
    on(els.btnCompareOrig, 'mousedown', startHoldOrig);
    on(els.btnCompareOrig, 'touchstart', startHoldOrig, { passive: false });
    on(els.btnCompareOrig, 'touchend', endHoldOrig);
    on(els.btnCompareOrig, 'touchcancel', endHoldOrig);
    on(window, 'mouseup', function () {
      if (pointerHoldingOrig) endHoldOrig();
    });
    on(window, 'pointerup', function () {
      if (pointerHoldingOrig) endHoldOrig();
    });
    on(els.btnCompareOrig, 'keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showingOrig = !showingOrig;
        renderEditor();
      }
    });

    // Bottom Strip: 4 Filters
    ['fltOriginal', 'fltMagicColor', 'fltBw', 'fltCleanAnswer'].forEach(function (id) {
      on(els[id], 'click', function () {
        if (cropModeOpen) closeCropMode();
        setFilterMode(els[id].getAttribute('data-filter'));
      });
    });

    // Crop button
    on(els.btnOpenCrop, 'click', function () {
      if (cropModeOpen) {
        closeCropMode();
      } else {
        openCropMode();
      }
    });

    // Manual Touch Draw toggle & sub-tools
    on(els.btnToggleDraw, 'click', function () {
      if (cropModeOpen) closeCropMode();
      drawModeOpen = !drawModeOpen;
      if (els.drawFloatingBar) els.drawFloatingBar.hidden = !drawModeOpen;
      if (els.btnToggleDraw) els.btnToggleDraw.classList.toggle('active', drawModeOpen);
      if (drawModeOpen) {
        showToast('🖌️ 請直接喺試卷上拉白框／塗改／補橫線');
      }
    });

    function selectDrawTool(toolName) {
      currentTool = toolName;
      ['toolRect', 'toolBrush', 'toolLine', 'toolMaskbar'].forEach(function (id) {
        var map = { toolRect: 'rect', toolBrush: 'brush', toolLine: 'line', toolMaskbar: 'maskbar' };
        if (els[id]) els[id].classList.toggle('active', map[id] === toolName);
      });
    }
    on(els.toolRect, 'click', function () { selectDrawTool('rect'); });
    on(els.toolBrush, 'click', function () { selectDrawTool('brush'); });
    on(els.toolLine, 'click', function () { selectDrawTool('line'); });
    on(els.toolMaskbar, 'click', function () { selectDrawTool('maskbar'); });

    on(els.btnUndoStroke, 'click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      var p = activeDoc.pages[currentIndex];
      if (!p.strokes.length) return;
      p.strokes.pop();
      reprocessSinglePage(p);
      saveDocToDB(activeDoc);
      renderEditor();
      showToast('↩️ 已復原上一步');
    });

    // Rotate 90° CW button (also rotates existing strokes 90° CW so manual edits stay aligned!)
    on(els.btnRotate, 'click', function () {
      if (!activeDoc || !activeDoc.pages[currentIndex]) return;
      if (cropModeOpen) closeCropMode();
      var p = activeDoc.pages[currentIndex];
      var oldW = (p.processedCanvas && p.processedCanvas.width) || (p.beforeCanvas && p.beforeCanvas.width) || (p.originalCanvas && p.originalCanvas.width) || 0;
      var oldH = (p.processedCanvas && p.processedCanvas.height) || (p.beforeCanvas && p.beforeCanvas.height) || (p.originalCanvas && p.originalCanvas.height) || 0;
      if (p.strokes && p.strokes.length > 0 && oldW > 0 && oldH > 0) {
        p.strokes = window.ScannerProcessor.rotateStrokes90CW(p.strokes, oldW, oldH);
      }
      p.settings.rotation = ((p.settings.rotation || 0) + 90) % 360;
      reprocessSinglePage(p);
      saveDocToDB(activeDoc);
      renderEditor();
    });

    // Export Sheet open/close
    on(els.btnOpenExportSheet, 'click', function () {
      openExportSheetForDoc(activeDoc);
    });
    on(els.btnCloseExportSheet, 'click', closeExportSheet);
    on(els.exportSheetBackdrop, 'click', function (e) {
      if (e.target === els.exportSheetBackdrop) closeExportSheet();
    });

    // Version Tabs inside Export Sheet
    ['verCleaned', 'verOriginal', 'verBoth'].forEach(function (id) {
      on(els[id], 'click', function () {
        exportVersion = els[id].getAttribute('data-ver');
        ['verCleaned', 'verOriginal', 'verBoth'].forEach(function (other) {
          if (els[other]) els[other].classList.toggle('active', other === id);
        });
      });
    });

    // 3 Big Export Actions
    on(els.btnSharePdf, 'click', function () {
      handleWebSharePdf();
    });

    on(els.btnPreviewPdf, 'click', function () {
      var bundles = buildPdfBundlesForTarget(exportVersion);
      if (!bundles.length) return;
      openInAppPdfPreview(bundles[0].blob, bundles[0].filename);
    });

    on(els.btnDownloadPdfFile, 'click', function () {
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
    on(els.btnClosePdfViewer, 'click', function () {
      if (els.pdfViewerModal) els.pdfViewerModal.hidden = true;
    });

    on(els.btnPrintFromViewer, 'click', function () {
      var doc = exportTargetDoc || activeDoc;
      if (!doc || !doc.pages.length || !els.printContainer) return;
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
    on(els.btnCancelRename, 'click', function () {
      if (els.renameModalBackdrop) els.renameModalBackdrop.hidden = true;
    });
    on(els.btnConfirmRename, 'click', function () {
      if (renameTargetDoc && els.inpRenameDoc) {
        var v = els.inpRenameDoc.value.trim();
        if (v) {
          renameTargetDoc.title = v;
          saveDocToDB(renameTargetDoc);
          renderHomeDocList();
          showToast('✅ 已更新試卷名稱');
        }
      }
      if (els.renameModalBackdrop) els.renameModalBackdrop.hidden = true;
    });
  }

  // =========================================================================
  // Init (ReadyState-Safe + Synchronous Event Binding Before IndexedDB)
  // =========================================================================
  function initApp() {
    initElements();
    bindEvents();
    bindStageEvents();
    bindCropEvents();
    renderHomeDocList();

    loadAllDocsFromDB().then(function (savedDocs) {
      if (savedDocs && savedDocs.length > 0 && docs.length === 0) {
        docs = savedDocs;
        if (els.screenHome && els.screenHome.classList.contains('active')) {
          renderHomeDocList();
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp, { once: true });
  } else {
    initApp();
  }
})();
