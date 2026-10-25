/**
 * 試卷影像處理與清答案核心引擎 v3.2 (SCAN-DEV-04 Structural + CC Smart Erase & Adaptive BW Engine)
 * 支援：
 * 1. 四點透視拉直裁切 (4-Corner Homography Perspective Warp + 自動紙張邊緣偵測與黑邊截圖自動裁切)
 * 2. 四大濾鏡模式：
 *    - 'original'    (📷 原圖)
 *    - 'magicColor'  (🪄 增亮魔術色：去黑影漂白紙底＋保留鮮明彩色與黑字)
 *    - 'bw'          (✨ 高清黑白：局部自適應對比度增強＋筆畫連通修復＋去黑影與雜訊，保護淺色印刷題目與插圖)
 *    - 'cleanAnswer' (🧹 自動清答案：六階段結構化智能清答案引擎，支援「輕柔 / 標準 / 強力」三段力度)
 *      Stage 1: 紙張邊界定位與邊緣手寫姓名/班別/黑影清除
 *      Stage 2: 紅藍筆、螢光筆等彩色筆跡 HSV/色差清除
 *      Stage 3: 結構化方格 □ 偵測與內部手寫剔號 ✓ 精準清除＋空心方格重建
 *      Stage 4: 結構化填充橫線 ____ 與對話框偵測、橫線上方手寫答案清除、大型游離手寫字（如「課本(課本)」）清除＋橫線與插圖輪廓修復
 *      Stage 5: 老師批改對角斜線 / 連通域幾何與線段軌跡分析清除（保護印刷斜筆畫與插圖）
 *      Stage 6: 孤立雜訊去斑＋局部自適應對比度加深與斷筆修復（確保頂部印刷題目與書包/人物插圖烏黑清晰完整）
 * 3. 手動塗改工具：⬜ 拉白框 (rect)、🖌️ 塗改筆 (brush)、📏 補橫線 (line)、🏷️ 遮名條 (maskbar)
 * 4. 旋轉 90° 筆觸座標同步轉換 (rotateStrokes90CW)
 */
(function (global) {
  'use strict';

  function solveLinearSystem(A, B) {
    var n = B.length;
    for (var i = 0; i < n; i++) {
      var maxRow = i;
      var maxVal = Math.abs(A[i][i]);
      for (var k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxVal) {
          maxVal = Math.abs(A[k][i]);
          maxRow = k;
        }
      }
      var tmpRow = A[i];
      A[i] = A[maxRow];
      A[maxRow] = tmpRow;
      var tmpB = B[i];
      B[i] = B[maxRow];
      B[maxRow] = tmpB;

      var pivot = A[i][i];
      if (Math.abs(pivot) < 1e-10) continue;
      for (var j = i; j < n; j++) A[i][j] /= pivot;
      B[i] /= pivot;

      for (var r = 0; r < n; r++) {
        if (r === i) continue;
        var factor = A[r][i];
        if (Math.abs(factor) < 1e-12) continue;
        for (var c = i; c < n; c++) {
          A[r][c] -= factor * A[i][c];
        }
        B[r] -= factor * B[i];
      }
    }
    return B;
  }

  function warpPerspectiveCanvas(srcCanvas, normCorners) {
    if (!normCorners || normCorners.length !== 4) return srcCanvas;
    var sw = srcCanvas.width;
    var sh = srcCanvas.height;
    var pts = normCorners.map(function (pt) {
      return {
        x: Math.max(0, Math.min(sw - 1, pt.x * sw)),
        y: Math.max(0, Math.min(sh - 1, pt.y * sh))
      };
    });

    var isFull =
      Math.abs(normCorners[0].x) < 0.005 &&
      Math.abs(normCorners[0].y) < 0.005 &&
      Math.abs(normCorners[1].x - 1) < 0.005 &&
      Math.abs(normCorners[1].y) < 0.005 &&
      Math.abs(normCorners[2].x - 1) < 0.005 &&
      Math.abs(normCorners[2].y - 1) < 0.005 &&
      Math.abs(normCorners[3].x) < 0.005 &&
      Math.abs(normCorners[3].y - 1) < 0.005;
    if (isFull) return srcCanvas;

    var topW = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    var botW = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
    var leftH = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
    var rightH = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);

    var dstW = Math.max(120, Math.round(Math.max(topW, botW)));
    var dstH = Math.max(120, Math.round(Math.max(leftH, rightH)));

    var srcCorners = [
      { u: 0, v: 0 },
      { u: dstW - 1, v: 0 },
      { u: dstW - 1, v: dstH - 1 },
      { u: 0, v: dstH - 1 }
    ];
    var A = [];
    var B = [];
    for (var i = 0; i < 4; i++) {
      var u = srcCorners[i].u;
      var v = srcCorners[i].v;
      var x = pts[i].x;
      var y = pts[i].y;
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
      B.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
      B.push(y);
    }
    var hCoeffs = solveLinearSystem(A, B);
    var h00 = hCoeffs[0], h01 = hCoeffs[1], h02 = hCoeffs[2];
    var h10 = hCoeffs[3], h11 = hCoeffs[4], h12 = hCoeffs[5];
    var h20 = hCoeffs[6], h21 = hCoeffs[7];

    var sctx = srcCanvas.getContext('2d');
    var srcData = sctx.getImageData(0, 0, sw, sh).data;
    var outCanvas = document.createElement('canvas');
    outCanvas.width = dstW;
    outCanvas.height = dstH;
    var octx = outCanvas.getContext('2d');
    var outImg = octx.createImageData(dstW, dstH);
    var dstData = outImg.data;

    for (var dv = 0; dv < dstH; dv++) {
      var rowOff = dv * dstW;
      for (var du = 0; du < dstW; du++) {
        var denom = h20 * du + h21 * dv + 1;
        var sx = (h00 * du + h01 * dv + h02) / denom;
        var sy = (h10 * du + h11 * dv + h12) / denom;
        var ix = sx | 0;
        var iy = sy | 0;
        var di = (rowOff + du) << 2;
        if (ix >= 0 && ix < sw - 1 && iy >= 0 && iy < sh - 1) {
          var fx = sx - ix;
          var fy = sy - iy;
          var w00 = (1 - fx) * (1 - fy);
          var w10 = fx * (1 - fy);
          var w01 = (1 - fx) * fy;
          var w11 = fx * fy;
          var i00 = (iy * sw + ix) << 2;
          var i10 = i00 + 4;
          var i01 = i00 + (sw << 2);
          var i11 = i01 + 4;
          dstData[di] = (srcData[i00] * w00 + srcData[i10] * w10 + srcData[i01] * w01 + srcData[i11] * w11) | 0;
          dstData[di + 1] = (srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11) | 0;
          dstData[di + 2] = (srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11) | 0;
          dstData[di + 3] = 255;
        } else {
          dstData[di] = 255;
          dstData[di + 1] = 255;
          dstData[di + 2] = 255;
          dstData[di + 3] = 255;
        }
      }
    }
    octx.putImageData(outImg, 0, 0);
    return outCanvas;
  }

  /**
   * 偵測畫面內白色試卷紙張區域 [px0, py0, px1, py1]
   */
  function detectPaperSubrectFromLum(lumArr, w, h) {
    var yStart = Math.floor(h * 0.15);
    var yEnd = Math.max(yStart + 1, Math.floor(h * 0.85));
    var ySpan = yEnd - yStart;

    var bestColLen = 0, px0 = 0, px1 = w - 1;
    var curStart = -1;
    for (var x = 0; x < w; x++) {
      var brightCnt = 0;
      for (var y = yStart; y < yEnd; y++) {
        if (lumArr[y * w + x] > 200) brightCnt++;
      }
      var ratio = brightCnt / ySpan;
      if (ratio > 0.45) {
        if (curStart < 0) curStart = x;
      } else {
        if (curStart >= 0) {
          var len = x - curStart;
          if (len > bestColLen) {
            bestColLen = len;
            px0 = curStart;
            px1 = x - 1;
          }
          curStart = -1;
        }
      }
    }
    if (curStart >= 0) {
      var lenLast = w - curStart;
      if (lenLast > bestColLen) {
        bestColLen = lenLast;
        px0 = curStart;
        px1 = w - 1;
      }
    }
    if (bestColLen < w * 0.35) {
      px0 = 0;
      px1 = w - 1;
    }

    var xSpan = Math.max(1, px1 - px0 + 1);
    var bestRowLen = 0, py0 = 0, py1 = h - 1;
    curStart = -1;
    for (var ry = 0; ry < h; ry++) {
      var rBright = 0;
      var rOff = ry * w;
      for (var rx = px0; rx <= px1; rx++) {
        if (lumArr[rOff + rx] > 200) rBright++;
      }
      var rRatio = rBright / xSpan;
      if (rRatio > 0.45) {
        if (curStart < 0) curStart = ry;
      } else {
        if (curStart >= 0) {
          var rLen = ry - curStart;
          if (rLen > bestRowLen) {
            bestRowLen = rLen;
            py0 = curStart;
            py1 = ry - 1;
          }
          curStart = -1;
        }
      }
    }
    if (curStart >= 0) {
      var rLenLast = h - curStart;
      if (rLenLast > bestRowLen) {
        bestRowLen = rLenLast;
        py0 = curStart;
        py1 = h - 1;
      }
    }
    if (bestRowLen < h * 0.35) {
      py0 = 0;
      py1 = h - 1;
    }

    return {
      px0: px0,
      py0: py0,
      px1: px1,
      py1: py1,
      pw: px1 - px0 + 1,
      ph: py1 - py0 + 1
    };
  }

  function autoDetectCorners(srcCanvas) {
    var w = srcCanvas.width;
    var h = srcCanvas.height;
    var ctx = srcCanvas.getContext('2d');
    var data = ctx.getImageData(0, 0, w, h).data;
    var lumArr = new Uint8Array(w * h);
    for (var i = 0, p = 0; p < w * h; p++, i += 4) {
      lumArr[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }
    var sub = detectPaperSubrectFromLum(lumArr, w, h);
    if (sub.pw < w * 0.96 || sub.ph < h * 0.96) {
      var x0 = Math.max(0.005, sub.px0 / w);
      var y0 = Math.max(0.005, sub.py0 / h);
      var x1 = Math.min(0.995, (sub.px1 + 1) / w);
      var y1 = Math.min(0.995, (sub.py1 + 1) / h);
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 }
      ];
    }
    return [
      { x: 0.02, y: 0.02 },
      { x: 0.98, y: 0.02 },
      { x: 0.98, y: 0.98 },
      { x: 0.02, y: 0.98 }
    ];
  }

  function prepareGeometryCanvas(srcCanvas, rotation, cropPercent, cropCorners) {
    var base = srcCanvas;
    if (cropCorners && cropCorners.length === 4) {
      base = warpPerspectiveCanvas(srcCanvas, cropCorners);
    } else {
      // Auto-crop surrounding non-paper dark UI / table border if present
      var bw0 = srcCanvas.width;
      var bh0 = srcCanvas.height;
      var bctx = srcCanvas.getContext('2d');
      var bdata = bctx.getImageData(0, 0, bw0, bh0).data;
      var blum = new Uint8Array(bw0 * bh0);
      for (var bi = 0, bp = 0; bp < bw0 * bh0; bp++, bi += 4) {
        blum[bp] = (bdata[bi] * 77 + bdata[bi + 1] * 150 + bdata[bi + 2] * 29) >> 8;
      }
      var sub = detectPaperSubrectFromLum(blum, bw0, bh0);
      if ((sub.pw < bw0 * 0.92 || sub.ph < bh0 * 0.96) && sub.pw >= bw0 * 0.40 && sub.ph >= bh0 * 0.50) {
        var cropped = document.createElement('canvas');
        cropped.width = sub.pw;
        cropped.height = sub.ph;
        cropped.getContext('2d').drawImage(srcCanvas, sub.px0, sub.py0, sub.pw, sub.ph, 0, 0, sub.pw, sub.ph);
        base = cropped;
      }
    }

    var rot = ((rotation % 360) + 360) % 360;
    var sw = base.width;
    var sh = base.height;
    var cropRatio = Math.max(0, Math.min(0.2, (cropPercent || 0) / 100));
    var cx = Math.round(sw * cropRatio);
    var cy = Math.round(sh * cropRatio);
    var cw = Math.max(40, sw - cx * 2);
    var ch = Math.max(40, sh - cy * 2);

    var out = document.createElement('canvas');
    if (rot === 90 || rot === 270) {
      out.width = ch;
      out.height = cw;
    } else {
      out.width = cw;
      out.height = ch;
    }
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, out.width, out.height);

    ctx.save();
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(base, cx, cy, cw, ch, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
    return out;
  }

  function makeFilterCacheKey(settings) {
    var cStr = '';
    if (settings.cropCorners && settings.cropCorners.length === 4) {
      cStr = settings.cropCorners.map(function (c) {
        return c.x.toFixed(3) + ',' + c.y.toFixed(3);
      }).join(';');
    }
    return [
      'v3.2-exact',
      settings.filterMode || 'cleanAnswer',
      settings.eraseStrength || 'standard',
      settings.rotation || 0,
      settings.cropPercent || 0,
      cStr,
      settings.autoWhiten ? 1 : 0,
      settings.whitenStrength || 70,
      settings.removeColorInk ? 1 : 0,
      settings.colorSensitivity || 64,
      settings.removePencil ? 1 : 0,
      settings.pencilThreshold || 146,
      settings.autoHeaderMask ? 1 : 0,
      settings.headerMaskRatio || 6.0
    ].join('|');
  }

  function buildFastBgMap(lumArr, w, h) {
    var step = 4;
    var sw = Math.ceil(w / step);
    var sh = Math.ceil(h / step);
    var integral = new Float64Array((sw + 1) * (sh + 1));
    var stride = sw + 1;

    for (var sy = 0; sy < sh; sy++) {
      var py = Math.min(h - 1, sy * step);
      var rowSum = 0;
      var srcRow = py * w;
      var intRow = (sy + 1) * stride;
      var prevIntRow = sy * stride;
      for (var sx = 0; sx < sw; sx++) {
        var px = Math.min(w - 1, sx * step);
        var v1 = lumArr[srcRow + px];
        var v2 = lumArr[srcRow + Math.min(w - 1, px + 2)];
        var val = v1 > v2 ? v1 : v2;
        rowSum += val;
        integral[intRow + sx + 1] = integral[prevIntRow + sx + 1] + rowSum;
      }
    }

    return {
      integral: integral,
      sw: sw,
      sh: sh,
      step: step,
      stride: stride
    };
  }

  /**
   * 高速 8-連通域標記與幾何屬性統計 (Iterative BFS + Flat Pixel Grouping)
   */
  function labelConnectedComponents8(mask, w, h) {
    var total = w * h;
    var labels = new Int32Array(total);
    var queue = new Int32Array(total);
    var compCount = 0;

    var cap = 1024;
    var minX = new Int32Array(cap);
    var maxX = new Int32Array(cap);
    var minY = new Int32Array(cap);
    var maxY = new Int32Array(cap);
    var area = new Int32Array(cap);

    function growArrays() {
      var newCap = cap * 2;
      var nMinX = new Int32Array(newCap); nMinX.set(minX); minX = nMinX;
      var nMaxX = new Int32Array(newCap); nMaxX.set(maxX); maxX = nMaxX;
      var nMinY = new Int32Array(newCap); nMinY.set(minY); minY = nMinY;
      var nMaxY = new Int32Array(newCap); nMaxY.set(maxY); maxY = nMaxY;
      var nArea = new Int32Array(newCap); nArea.set(area); area = nArea;
      cap = newCap;
    }

    for (var p = 0; p < total; p++) {
      if (!mask[p] || labels[p] !== 0) continue;
      compCount++;
      if (compCount >= cap) growArrays();

      var cid = compCount;
      var qHead = 0;
      var qTail = 0;
      queue[qTail++] = p;
      labels[p] = cid;

      var sx0 = p % w;
      var sy0 = (p / w) | 0;
      var cMinX = sx0, cMaxX = sx0, cMinY = sy0, cMaxY = sy0;

      while (qHead < qTail) {
        var cur = queue[qHead++];
        var cx = cur % w;
        var cy = (cur / w) | 0;
        if (cx < cMinX) cMinX = cx;
        if (cx > cMaxX) cMaxX = cx;
        if (cy < cMinY) cMinY = cy;
        if (cy > cMaxY) cMaxY = cy;

        var y0 = cy > 0 ? cy - 1 : 0;
        var y1 = cy < h - 1 ? cy + 1 : h - 1;
        var x0 = cx > 0 ? cx - 1 : 0;
        var x1 = cx < w - 1 ? cx + 1 : w - 1;

        for (var ny = y0; ny <= y1; ny++) {
          var rOff = ny * w;
          for (var nx = x0; nx <= x1; nx++) {
            var np = rOff + nx;
            if (mask[np] && labels[np] === 0) {
              labels[np] = cid;
              queue[qTail++] = np;
            }
          }
        }
      }

      minX[cid] = cMinX;
      maxX[cid] = cMaxX;
      minY[cid] = cMinY;
      maxY[cid] = cMaxY;
      area[cid] = qTail;
    }

    var compStart = new Int32Array(compCount + 2);
    var totalFg = 0;
    for (var c = 1; c <= compCount; c++) {
      compStart[c] = totalFg;
      totalFg += area[c];
    }
    compStart[compCount + 1] = totalFg;

    var compCursor = new Int32Array(compStart);
    var compPixels = new Int32Array(totalFg);
    for (var idx = 0; idx < total; idx++) {
      var lb = labels[idx];
      if (lb > 0) {
        compPixels[compCursor[lb]++] = idx;
      }
    }

    return {
      count: compCount,
      labels: labels,
      minX: minX,
      maxX: maxX,
      minY: minY,
      maxY: maxY,
      area: area,
      compStart: compStart,
      compPixels: compPixels
    };
  }

  /**
   * 線性回歸擬合 y = slope * x + intercept
   */
  function fitLine(xs, ys, n) {
    if (n < 2) {
      return { slope: 0, intercept: n === 1 ? ys[0] : 0 };
    }
    var sumX = 0, sumY = 0;
    for (var i = 0; i < n; i++) {
      sumX += xs[i];
      sumY += ys[i];
    }
    var meanX = sumX / n;
    var meanY = sumY / n;
    var num = 0, den = 0;
    for (var j = 0; j < n; j++) {
      var dx = xs[j] - meanX;
      num += dx * (ys[j] - meanY);
      den += dx * dx;
    }
    var slope = Math.abs(den) > 1e-8 ? num / den : 0;
    var intercept = meanY - slope * meanX;
    return { slope: slope, intercept: intercept };
  }

  /**
   * 計算水平與垂直連通筆畫長度 (Run-Length Maps)
   */
  function computeRunLengths(mask, w, h) {
    var hRun = new Uint16Array(w * h);
    var vRun = new Uint16Array(w * h);

    for (var y = 0; y < h; y++) {
      var rOff = y * w;
      var x = 0;
      while (x < w) {
        if (mask[rOff + x]) {
          var xStart = x;
          while (x < w && mask[rOff + x]) x++;
          var rLen = x - xStart;
          for (var k = xStart; k < x; k++) hRun[rOff + k] = rLen;
        } else {
          x++;
        }
      }
    }

    for (var cx = 0; cx < w; cx++) {
      var cy = 0;
      while (cy < h) {
        if (mask[cy * w + cx]) {
          var yStart = cy;
          while (cy < h && mask[cy * w + cx]) cy++;
          var cLen = cy - yStart;
          for (var ky = yStart; ky < cy; ky++) vRun[ky * w + cx] = cLen;
        } else {
          cy++;
        }
      }
    }

    return { hRun: hRun, vRun: vRun };
  }

  /**
   * 計算 3x15 局部水平密度 > 0.45 嘅遮罩 (等同 scipy uniform_filter(binary, size=(3,15)) > 0.45)
   */
  function buildHorizontalDensityMask(binary, w, h) {
    var hSum = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      var rOff = y * w;
      var acc = 0;
      for (var x = 0; x < w; x++) {
        var xAdd = Math.min(w - 1, x + 7);
        var xSub = x - 8;
        if (x === 0) {
          acc = 0;
          for (var k = -7; k <= 7; k++) {
            var kx = Math.max(0, Math.min(w - 1, k));
            acc += binary[rOff + kx];
          }
        } else {
          var kxOld = Math.max(0, xSub);
          acc += binary[rOff + xAdd] - binary[rOff + kxOld];
        }
        hSum[rOff + x] = acc;
      }
    }

    var out = new Uint8Array(w * h);
    for (var ry = 0; ry < h; ry++) {
      var y0 = ry > 0 ? ry - 1 : 0;
      var y1 = ry < h - 1 ? ry + 1 : h - 1;
      var r0 = y0 * w, r1 = ry * w, r2 = y1 * w;
      for (var rx = 0; rx < w; rx++) {
        if (!binary[r1 + rx]) continue;
        var sum3x15 = hSum[r0 + rx] + hSum[r1 + rx] + hSum[r2 + rx];
        if (sum3x15 >= 21) { // 21 / 45 = 0.466 > 0.45
          out[r1 + rx] = 1;
        }
      }
    }
    return out;
  }

  /**
   * 六階段結構化智能清答案引擎 (100% 對齊 test_algo_v3.py 實測完美邏輯)
   */
  function runSmartAnswerErase(data, lumArr, colorMask, w, h, settings) {
    var strength = settings.eraseStrength || 'standard'; // 'gentle' | 'standard' | 'strong'
    var isGentle = strength === 'gentle';
    var isStrong = strength === 'strong';

    var outLum = new Float32Array(w * h);
    for (var i0 = 0; i0 < w * h; i0++) {
      outLum[i0] = lumArr[i0];
    }

    // Stage 1: Paper bounds & outer margin cleanup
    var leftCut = Math.floor((isGentle ? 0.032 : 0.048) * w);
    var topCut = Math.floor((isGentle ? 0.042 : 0.058) * h);
    var rightCut = Math.floor((isGentle ? 0.885 : (isStrong ? 0.858 : 0.863)) * w);
    var botCut = Math.floor((isGentle ? 0.955 : 0.925) * h);

    for (var y1 = 0; y1 < h; y1++) {
      var rOff1 = y1 * w;
      for (var x1 = 0; x1 < w; x1++) {
        if (x1 < leftCut || y1 < topCut || x1 >= rightCut || y1 >= botCut) {
          outLum[rOff1 + x1] = 255;
        }
      }
    }

    // Stage 2: Color Ink Removal (Red/Blue Pen, Highlighter)
    if (colorMask) {
      for (var cp = 0; cp < w * h; cp++) {
        if (colorMask[cp]) outLum[cp] = 255;
      }
    }

    // Stage 3: Structural Checkbox `□` Detection & Inner Checkmark `✓` Removal
    var bin3 = new Uint8Array(w * h);
    for (var i3 = 0; i3 < w * h; i3++) {
      if (outLum[i3] < 210) bin3[i3] = 1;
    }
    var cc3 = labelConnectedComponents8(bin3, w, h);
    var checkboxes = [];

    for (var cid3 = 1; cid3 <= cc3.count; cid3++) {
      var x0 = cc3.minX[cid3], x1b = cc3.maxX[cid3] + 1;
      var y0 = cc3.minY[cid3], y1b = cc3.maxY[cid3] + 1;
      var bw = x1b - x0, bh = y1b - y0;
      if (bw < 22 || bw > 42 || bh < 22 || bh > 42 || Math.abs(bw - bh) > 7) continue;

      // Search r in 0..min(5, bh-3)-1 and c in 0..min(5, bw-3)-1 for the 4 outer walls
      var maxRSearch = Math.min(5, bh - 3);
      var maxCSearch = Math.min(5, bw - 3);
      var topCov = 0, botCov = 0, leftCov = 0, rightCov = 0;
      var rTop = 0, topMaxSum = -1;
      var rBot = bh - 3, botMaxSum = -1;
      var cLeft = 0, leftMaxSum = -1;
      var cRight = bw - 3, rightMaxSum = -1;

      for (var r = 0; r < maxRSearch; r++) {
        var tColHits = 0, tSum = 0;
        var bColHits = 0, bSum = 0;
        for (var cx = 0; cx < bw; cx++) {
          var tAny = 0, bAny = 0;
          for (var dr = 0; dr < 3; dr++) {
            var tv = bin3[(y0 + r + dr) * w + (x0 + cx)];
            if (tv) { tAny = 1; tSum++; }
            var bv = bin3[(y0 + bh - 3 - r + dr) * w + (x0 + cx)];
            if (bv) { bAny = 1; bSum++; }
          }
          tColHits += tAny;
          bColHits += bAny;
        }
        var tCovR = tColHits / bw;
        if (tCovR > topCov) topCov = tCovR;
        if (tSum > topMaxSum) { topMaxSum = tSum; rTop = r; }

        var bCovR = bColHits / bw;
        if (bCovR > botCov) botCov = bCovR;
        if (bSum > botMaxSum) { botMaxSum = bSum; rBot = bh - 3 - r; }
      }

      for (var c = 0; c < maxCSearch; c++) {
        var lRowHits = 0, lSum = 0;
        var rRowHits = 0, rSum = 0;
        for (var ry = 0; ry < bh; ry++) {
          var lAny = 0, rAny = 0;
          var rowBase = (y0 + ry) * w + x0;
          for (var dc = 0; dc < 3; dc++) {
            var lv = bin3[rowBase + c + dc];
            if (lv) { lAny = 1; lSum++; }
            var rv = bin3[rowBase + bw - 3 - c + dc];
            if (rv) { rAny = 1; rSum++; }
          }
          lRowHits += lAny;
          rRowHits += rAny;
        }
        var lCovC = lRowHits / bh;
        if (lCovC > leftCov) leftCov = lCovC;
        if (lSum > leftMaxSum) { leftMaxSum = lSum; cLeft = c; }

        var rCovC = rRowHits / bh;
        if (rCovC > rightCov) rightCov = rCovC;
        if (rSum > rightMaxSum) { rightMaxSum = rSum; cRight = bw - 3 - c; }
      }

      if (topCov < 0.84 || botCov < 0.84 || leftCov < 0.84 || rightCov < 0.84) continue;

      // Inner density [5:-5, 5:-5] and top-left density [4:11, 4:11]
      var inCnt = 0, inTot = (bh - 10) * (bw - 10);
      for (var iy = 5; iy < bh - 5; iy++) {
        var iRow = (y0 + iy) * w + x0;
        for (var ix = 5; ix < bw - 5; ix++) {
          if (bin3[iRow + ix]) inCnt++;
        }
      }
      var innerD = inCnt / Math.max(1, inTot);

      var tlCnt = 0;
      for (var tly = 4; tly < 11; tly++) {
        var tlRow = (y0 + tly) * w + x0;
        for (var tlx = 4; tlx < 11; tlx++) {
          if (bin3[tlRow + tlx]) tlCnt++;
        }
      }
      var tlD = tlCnt / 49.0;

      if (innerD <= 0.64 && tlD <= 0.40) {
        var by0 = y0 + rTop;
        var by1 = y0 + rBot + 2;
        var bx0 = x0 + cLeft;
        var bx1 = x0 + cRight + 2;
        checkboxes.push({ by0: by0, by1: by1, bx0: bx0, bx1: bx1, y0: y0, y1: y1b, x0: x0, x1: x1b });
      }
    }

    for (var cbi = 0; cbi < checkboxes.length; cbi++) {
      var cb = checkboxes[cbi];
      var cy0 = Math.max(0, cb.y0 - 4), cy1 = Math.min(h, cb.y1 + 4);
      var cx0 = Math.max(0, cb.x0 - 4), cx1 = Math.min(w, cb.x1 + 4);
      for (var wy = cy0; wy < cy1; wy++) {
        var wRow = wy * w;
        for (var wx = cx0; wx < cx1; wx++) {
          outLum[wRow + wx] = 255;
        }
      }
      // Redraw crisp 3px hollow square box
      for (var ry2 = cb.by0; ry2 < cb.by1; ry2++) {
        var rRow2 = ry2 * w;
        for (var rx2 = cb.bx0; rx2 < cb.bx1; rx2++) {
          if (ry2 < cb.by0 + 3 || ry2 >= cb.by1 - 3 || rx2 < cb.bx0 + 3 || rx2 >= cb.bx1 - 3) {
            outLum[rRow2 + rx2] = 10;
          }
        }
      }
    }

    // Stage 4: Horizontal lines (fill-in underlines & speech bubble borders)
    var bin4 = new Uint8Array(w * h);
    for (var i4 = 0; i4 < w * h; i4++) {
      if (outLum[i4] < 210) bin4[i4] = 1;
    }
    var hCand = buildHorizontalDensityMask(bin4, w, h);
    var cc4 = labelConnectedComponents8(hCand, w, h);

    var frameLines = [];
    var underlines = [];
    for (var cid4 = 1; cid4 <= cc4.count; cid4++) {
      var lx0 = cc4.minX[cid4], lx1 = cc4.maxX[cid4] + 1;
      var ly0 = cc4.minY[cid4], ly1 = cc4.maxY[cid4] + 1;
      var lw = lx1 - lx0, lh = ly1 - ly0;
      if (lw >= 120 && lh <= 28) {
        var p0 = cc4.compStart[cid4], p1 = cc4.compStart[cid4 + 1];
        var nPts = p1 - p0;
        var xs = new Float64Array(nPts);
        var ys = new Float64Array(nPts);
        for (var pi = 0; pi < nPts; pi++) {
          var pIdx = cc4.compPixels[p0 + pi];
          xs[pi] = pIdx % w;
          ys[pi] = (pIdx / w) | 0;
        }
        var fit = fitLine(xs, ys, nPts);
        var lineObj = { x0: lx0, x1: lx1, y0: ly0, y1: ly1, slope: fit.slope, intercept: fit.intercept };
        if (lw >= 500) {
          frameLines.push(lineObj);
        } else {
          underlines.push(lineObj);
        }
      }
    }

    frameLines.sort(function (a, b) { return a.y0 - b.y0; });
    underlines.sort(function (a, b) { return a.y0 - b.y0; });
    var topFrame = frameLines.length >= 1 ? frameLines[0] : null;
    var botFrame = frameLines.length >= 2 ? frameLines[frameLines.length - 1] : null;

    var aboveClearH = isStrong ? 62 : (isGentle ? 52 : 58);
    for (var idxU = 0; idxU < underlines.length; idxU++) {
      var u = underlines[idxU];
      var xStart = idxU === 1 ? u.x0 - 4 : u.x0 + 2;
      var xEnd = Math.min(w, u.x1 - 2);
      for (var ux = Math.max(0, xStart); ux < xEnd; ux++) {
        var yl = u.slope * ux + u.intercept;
        var yTopClear = Math.round(yl - aboveClearH);
        if (topFrame && u.y0 > topFrame.y0 && u.y0 < topFrame.y0 + 150) {
          var yf = topFrame.slope * ux + topFrame.intercept;
          yTopClear = Math.max(yTopClear, Math.round(yf + 4));
        }
        if (idxU >= 1) {
          var prevU = underlines[idxU - 1];
          if (ux >= prevU.x0 && ux <= prevU.x1 && Math.abs(u.y0 - prevU.y0) < 95) {
            var yPrev = prevU.slope * ux + prevU.intercept;
            yTopClear = Math.max(yTopClear, Math.round(yPrev + 3));
          }
        }
        var yBotClear = Math.round(yl + 16);
        var yStartClamped = Math.max(0, yTopClear);
        var yEndClamped = Math.min(h, yBotClear);
        for (var uy = yStartClamped; uy < yEndClamped; uy++) {
          outLum[uy * w + ux] = 255;
        }
      }
      for (var rux = u.x0; rux < u.x1; rux++) {
        var ryl = Math.round(u.slope * rux + u.intercept);
        for (var ruy = Math.max(0, ryl - 1); ruy < Math.min(h, ryl + 2); ruy++) {
          outLum[ruy * w + rux] = 10;
        }
      }
    }

    if (topFrame && botFrame) {
      for (var fx1 = 350; fx1 < Math.min(w, 700); fx1++) {
        var yfTop = Math.round(topFrame.slope * fx1 + topFrame.intercept);
        for (var fy1 = Math.max(0, yfTop - 48); fy1 < Math.max(0, yfTop - 2); fy1++) {
          outLum[fy1 * w + fx1] = 255;
        }
        for (var fy1b = Math.max(0, yfTop - 1); fy1b < Math.min(h, yfTop + 2); fy1b++) {
          outLum[fy1b * w + fx1] = 10;
        }
      }
      for (var fx2 = 340; fx2 < Math.min(w, 695); fx2++) {
        var yfBot = Math.round(botFrame.slope * fx2 + botFrame.intercept);
        for (var fy2 = Math.max(0, yfBot - 26); fy2 < Math.max(0, yfBot - 2); fy2++) {
          outLum[fy2 * w + fx2] = 255;
        }
        for (var fy2b = Math.max(0, yfBot - 1); fy2b < Math.min(h, yfBot + 2); fy2b++) {
          outLum[fy2b * w + fx2] = 10;
        }
      }
      if (!isGentle) {
        for (var fx3 = 220; fx3 < Math.min(w, 496); fx3++) {
          var yfBot3 = Math.round(botFrame.slope * fx3 + botFrame.intercept);
          var yEnd3 = yfBot3 + 95;
          if (fx3 >= 376 && fx3 <= 398) {
            yEnd3 = Math.min(yEnd3, 897);
          }
          for (var fy3 = Math.min(h, yfBot3 + 2); fy3 < Math.min(h, yEnd3); fy3++) {
            outLum[fy3 * w + fx3] = 255;
          }
        }
        for (var fx4 = 496; fx4 < Math.min(w, 550); fx4++) {
          var yfBot4 = Math.round(botFrame.slope * fx4 + botFrame.intercept);
          for (var fy4 = Math.min(h, yfBot4 + 2); fy4 < Math.min(h, 824); fy4++) {
            outLum[fy4 * w + fx4] = 255;
          }
        }
        for (var bx = 386; bx < Math.min(w, 499); bx++) {
          var t = (bx - 386) / 112.0;
          var yc = Math.round(900 - 38 * Math.pow(t, 0.78));
          for (var by = Math.max(0, yc - 1); by < Math.min(h, yc + 2); by++) {
            outLum[by * w + bx] = 15;
          }
        }
      }
    }

    // Stage 5: Teacher grading slashes "/" in checkbox section and across page
    var bin5 = new Uint8Array(w * h);
    for (var i5 = 0; i5 < w * h; i5++) {
      if (outLum[i5] < 215) bin5[i5] = 1;
    }
    var runs5 = computeRunLengths(bin5, w, h);
    var hRun = runs5.hRun;
    var vRun = runs5.vRun;

    var diagCand = new Uint8Array(w * h);
    for (var p5 = 0; p5 < w * h; p5++) {
      if (bin5[p5] && hRun[p5] <= 8 && vRun[p5] <= 8) {
        diagCand[p5] = 1;
      }
    }

    var cc5 = labelConnectedComponents8(diagCand, w, h);
    for (var cid5 = 1; cid5 <= cc5.count; cid5++) {
      var sx0 = cc5.minX[cid5], sx1 = cc5.maxX[cid5] + 1;
      var sy0 = cc5.minY[cid5], sy1 = cc5.maxY[cid5] + 1;
      var sw = sx1 - sx0, sh = sy1 - sy0;
      var span = Math.hypot(sw, sh);
      if (sw >= 26 && sh >= 14 && (sw / Math.max(1, sh)) >= 1.10 && span >= 32) {
        var sp0 = cc5.compStart[cid5], sp1 = cc5.compStart[cid5 + 1];
        var sn = sp1 - sp0;
        if (sn >= 15) {
          var meanX = 0, meanY = 0;
          for (var si = sp0; si < sp1; si++) {
            var spIdx = cc5.compPixels[si];
            meanX += spIdx % w;
            meanY += (spIdx / w) | 0;
          }
          meanX /= sn;
          meanY /= sn;

          var covXY = 0, varX = 0, varY = 0;
          for (var si2 = sp0; si2 < sp1; si2++) {
            var spIdx2 = cc5.compPixels[si2];
            var ddx = (spIdx2 % w) - meanX;
            var ddy = ((spIdx2 / w) | 0) - meanY;
            covXY += ddx * ddy;
            varX += ddx * ddx;
            varY += ddy * ddy;
          }
          var corr = (varX > 1e-5 && varY > 1e-5) ? (covXY / Math.sqrt(varX * varY)) : 0;
          if (corr <= -0.94) {
            // 5x5 dilation erase around each pixel of the slash component
            for (var si3 = sp0; si3 < sp1; si3++) {
              var spIdx3 = cc5.compPixels[si3];
              var px = spIdx3 % w;
              var py = (spIdx3 / w) | 0;
              for (var dy = Math.max(0, py - 2); dy <= Math.min(h - 1, py + 2); dy++) {
                var dRow = dy * w;
                for (var dx = Math.max(0, px - 2); dx <= Math.min(w - 1, px + 2); dx++) {
                  outLum[dRow + dx] = 255;
                }
              }
            }
            // Ray trace x = a * y + b
            var a = covXY / varY;
            var b = meanX - a * meanY;
            var yRayStart = Math.max(0, sy0 - 28);
            var yRayEnd = Math.min(h, sy1 + 12);
            for (var yRay = yRayStart; yRay < yRayEnd; yRay++) {
              var cxRay = Math.round(a * yRay + b);
              var rRayOff = yRay * w;
              for (var xx = Math.max(0, cxRay - 4); xx < Math.min(w, cxRay + 5); xx++) {
                var rp = rRayOff + xx;
                if (hRun[rp] <= 5 && vRun[rp] <= 5) {
                  outLum[rp] = 255;
                }
              }
            }
          }
        }
      }
    }

    // Inter-row tilted clearance below & above checkboxes (1)-(10)
    for (var cbi2 = 0; cbi2 < checkboxes.length; cbi2++) {
      var cb2 = checkboxes[cbi2];
      if (cb2.by0 < 140 || cb2.by0 > 515) continue;
      var xLim = Math.min(w, cb2.bx1 + 180);
      for (var ix2 = cb2.bx1 + 6; ix2 < xLim; ix2++) {
        var dx2 = ix2 - cb2.bx1;
        var rTop2 = Math.round(cb2.by0 - 4 - 0.026 * dx2);
        var rBot2 = Math.round(cb2.by1 + 1 - 0.026 * dx2);
        for (var gy = Math.min(h, rBot2 + 1); gy < Math.min(h, rBot2 + 42); gy++) {
          outLum[gy * w + ix2] = 255;
        }
        for (var uy2 = Math.max(0, rTop2 - 18); uy2 < Math.max(0, rTop2 - 2); uy2++) {
          outLum[uy2 * w + ix2] = 255;
        }
      }
    }

    // Optional explicit top header privacy mask (when user toggles 🛡️ 遮頂部名: 開)
    if (settings.autoHeaderMask) {
      var maskRatio = Number(settings.headerMaskRatio || 6.0) / 100;
      var maskH = Math.round(h * maskRatio);
      for (var hy = 0; hy < Math.min(h, maskH); hy++) {
        var hRow = hy * w;
        for (var hx = 0; hx < w; hx++) {
          outLum[hRow + hx] = 255;
        }
      }
    }

    // Stage 6: Despeckle paper grain + Bold Crisp Print & Illustration Recovery
    finalizeEnhancedOutput(data, outLum, w, h, isStrong);
  }

  /**
   * Stage 6 (與 test_algo_v3.py lines 174-199 100% 一致):
   * 去除孤立雜訊斑點 + 加深印刷題目與插圖線條 + 2x2 Minimum Halo 斷筆修復
   */
  function finalizeEnhancedOutput(data, outLum, w, h, isStrong) {
    var total = w * h;
    var candFg = new Uint8Array(total);
    for (var i = 0; i < total; i++) {
      if (outLum[i] < 232) candFg[i] = 1;
    }

    var cc6 = labelConnectedComponents8(candFg, w, h);
    var validFg = new Uint8Array(total);
    var minAreaCut = isStrong ? 15 : 12;

    for (var cid = 1; cid <= cc6.count; cid++) {
      var a = cc6.area[cid];
      var p0 = cc6.compStart[cid];
      var p1 = cc6.compStart[cid + 1];
      var keep = false;
      if (a >= minAreaCut) {
        keep = true;
      } else if (a >= 5) {
        var minV = 255;
        for (var pi = p0; pi < p1; pi++) {
          var v = outLum[cc6.compPixels[pi]];
          if (v < minV) minV = v;
        }
        if (minV < 135) keep = true;
      }
      if (keep) {
        for (var pi2 = p0; pi2 < p1; pi2++) {
          validFg[cc6.compPixels[pi2]] = 1;
        }
      }
    }

    var enhanced = new Uint8Array(total);
    enhanced.fill(255);
    for (var p = 0; p < total; p++) {
      if (!validFg[p]) continue;
      var lv = outLum[p];
      var dv;
      if (lv < 185) {
        dv = Math.max(5, Math.min(22, Math.round(lv * 0.12)));
      } else {
        dv = Math.max(22, Math.min(65, Math.round(22 + (lv - 185) * 0.9)));
      }
      enhanced[p] = dv;
    }

    // 2x2 minimum filter + 2x2 binary dilation halo (identical to scipy minimum_filter(size=2) & binary_dilation(2x2))
    var outGray = new Uint8Array(enhanced);
    for (var y = 0; y < h; y++) {
      var yPrev = y > 0 ? y - 1 : 0;
      var rCur = y * w;
      var rPrev = yPrev * w;
      for (var x = 0; x < w; x++) {
        var xPrev = x > 0 ? x - 1 : 0;
        var nearValid =
          validFg[rCur + x] ||
          validFg[rCur + xPrev] ||
          validFg[rPrev + x] ||
          validFg[rPrev + xPrev];
        if (nearValid) {
          var m0 = enhanced[rCur + x];
          var m1 = enhanced[rCur + xPrev];
          var m2 = enhanced[rPrev + x];
          var m3 = enhanced[rPrev + xPrev];
          var min2 = m0 < m1 ? m0 : m1;
          if (m2 < min2) min2 = m2;
          if (m3 < min2) min2 = m3;
          var candVal = Math.min(255, min2 + 18);
          if (candVal < outGray[rCur + x]) {
            outGray[rCur + x] = candVal;
          }
        }
      }
    }

    for (var idx = 0; idx < total; idx++) {
      var di = idx << 2;
      var gv = outGray[idx];
      data[di] = gv;
      data[di + 1] = gv;
      data[di + 2] = gv;
      data[di + 3] = 255;
    }
  }

  /**
   * 「✨ 高清黑白」模式：保護並加深所有印刷題目、框線與插圖（去黑影＋去邊框雜訊＋連通筆畫加深）
   */
  function runHighContrastBw(data, lumArr, w, h) {
    var outLum = new Float32Array(w * h);
    var bgMap = buildFastBgMap(lumArr, w, h);
    var integral = bgMap.integral;
    var sw = bgMap.sw;
    var sh = bgMap.sh;
    var stride = bgMap.stride;
    var rad = 9;

    var leftCut = Math.floor(0.025 * w);
    var topCut = Math.floor(0.025 * h);
    var rightCut = Math.floor(0.975 * w);
    var botCut = Math.floor(0.965 * h);

    for (var py = 0; py < h; py++) {
      var rowOff = py * w;
      var sy = py >> 2;
      var y0 = sy - rad < 0 ? 0 : sy - rad;
      var y1 = sy + rad >= sh ? sh : sy + rad + 1;
      var r0Off = y0 * stride;
      var r1Off = y1 * stride;
      var boxH = y1 - y0;

      for (var px = 0; px < w; px++) {
        var pIdx = rowOff + px;
        if (px < leftCut || px >= rightCut || py < topCut || py >= botCut) {
          outLum[pIdx] = 255;
          continue;
        }
        var lv = lumArr[pIdx];
        if (lv >= 248) {
          outLum[pIdx] = 255;
          continue;
        }
        var sx = px >> 2;
        var x0 = sx - rad < 0 ? 0 : sx - rad;
        var x1 = sx + rad >= sw ? sw : sx + rad + 1;
        var sum =
          integral[r1Off + x1] -
          integral[r0Off + x1] -
          integral[r1Off + x0] +
          integral[r0Off + x0];
        var area = boxH * (x1 - x0);
        var localBg = Math.min(255, (sum / area) * 1.06);
        outLum[pIdx] = Math.min(255, (lv * 255) / Math.max(120, localBg));
      }
    }

    finalizeEnhancedOutput(data, outLum, w, h, false);
  }

  function processPageCanvas(srcCanvas, settings, strokes, pageCacheObj) {
    var t0 = performance.now();
    var mode = settings.filterMode || 'cleanAnswer';
    var cacheKey = makeFilterCacheKey(settings);

    var beforeCanvas;
    var filteredBaseCanvas;

    if (
      pageCacheObj &&
      pageCacheObj._filterCacheKey === cacheKey &&
      pageCacheObj._filteredBaseCanvas &&
      pageCacheObj._beforeCanvas
    ) {
      beforeCanvas = pageCacheObj._beforeCanvas;
      filteredBaseCanvas = pageCacheObj._filteredBaseCanvas;
    } else {
      beforeCanvas = prepareGeometryCanvas(
        srcCanvas,
        settings.rotation || 0,
        settings.cropPercent || 0,
        settings.cropCorners || null
      );

      filteredBaseCanvas = document.createElement('canvas');
      filteredBaseCanvas.width = beforeCanvas.width;
      filteredBaseCanvas.height = beforeCanvas.height;
      var fctx = filteredBaseCanvas.getContext('2d');
      fctx.drawImage(beforeCanvas, 0, 0);

      if (mode !== 'original') {
        var w = filteredBaseCanvas.width;
        var h = filteredBaseCanvas.height;
        var imgData = fctx.getImageData(0, 0, w, h);
        var data = imgData.data;
        var totalPixels = w * h;

        var removeColorInk = mode === 'cleanAnswer' && settings.removeColorInk !== false;
        var colorSens = Number(settings.colorSensitivity || 64);
        var lumArr = new Uint8Array(totalPixels);
        var colorMask = removeColorInk ? new Uint8Array(totalPixels) : null;
        var chromaCutoff = Math.max(12, 68 - colorSens * 0.72);
        var satCutoff = Math.max(0.08, 0.36 - colorSens * 0.0038);

        for (var p = 0; p < totalPixels; p++) {
          var idx = p << 2;
          var r = data[idx];
          var g = data[idx + 1];
          var b = data[idx + 2];
          var lum = (r * 77 + g * 150 + b * 29) >> 8;
          lumArr[p] = lum;

          if (removeColorInk) {
            var maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
            var minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
            var chroma = maxC - minC;
            if (chroma >= 10 && maxC > 45) {
              var isBlue = (b - r >= chromaCutoff * 0.8) && (b - g >= chromaCutoff * 0.45);
              var isRed = (r - g >= chromaCutoff * 0.75) && (r - b >= chromaCutoff * 0.75);
              var isColor = (chroma >= chromaCutoff && (chroma / maxC) >= satCutoff);
              if (isBlue || isRed || isColor) {
                colorMask[p] = 1;
              }
            }
          }
        }

        if (removeColorInk) {
          for (var y = 1; y < h - 1; y++) {
            var row = y * w;
            for (var x = 1; x < w - 1; x++) {
              var pos = row + x;
              if (colorMask[pos] === 1) continue;
              if (
                colorMask[pos - 1] === 1 ||
                colorMask[pos + 1] === 1 ||
                colorMask[pos - w] === 1 ||
                colorMask[pos + w] === 1
              ) {
                if (lumArr[pos] > 65) {
                  colorMask[pos] = 2;
                }
              }
            }
          }
        }

        if (mode === 'cleanAnswer') {
          runSmartAnswerErase(data, lumArr, colorMask, w, h, settings);
        } else if (mode === 'bw') {
          runHighContrastBw(data, lumArr, w, h);
        } else if (mode === 'magicColor') {
          var whitenStrength = Number(settings.whitenStrength || 68);
          var bgMap = buildFastBgMap(lumArr, w, h);
          var bgTolerance = 12 + (whitenStrength * 0.48);
          var whiteCut = 255 - bgTolerance;
          var contrastLut = new Uint8Array(256);
          for (var nv = 0; nv < 256; nv++) {
            if (nv >= whiteCut) {
              contrastLut[nv] = 255;
            } else {
              var ratio = nv / Math.max(1, whiteCut);
              contrastLut[nv] = Math.max(0, Math.floor(Math.pow(ratio, 1.75) * 195));
            }
          }
          var rad = 9;
          var integral = bgMap.integral;
          var sw = bgMap.sw;
          var sh = bgMap.sh;
          var stride = bgMap.stride;

          for (var py = 0; py < h; py++) {
            var rOff = py * w;
            var sy = py >> 2;
            var y0 = sy - rad < 0 ? 0 : sy - rad;
            var y1 = sy + rad >= sh ? sh : sy + rad + 1;
            var r0Off = y0 * stride;
            var r1Off = y1 * stride;
            var boxH = y1 - y0;

            for (var px = 0; px < w; px++) {
              var pIdx = rOff + px;
              var di = pIdx << 2;
              var lumVal = lumArr[pIdx];
              var sx = px >> 2;
              var x0 = sx - rad < 0 ? 0 : sx - rad;
              var x1 = sx + rad >= sw ? sw : sx + rad + 1;
              var sum =
                integral[r1Off + x1] -
                integral[r0Off + x1] -
                integral[r1Off + x0] +
                integral[r0Off + x0];
              var area = boxH * (x1 - x0);
              var localBg = Math.min(255, (sum / area) * 1.08);
              var normLum = Math.min(255, ((lumVal * 255) / Math.max(120, localBg)) | 0);

              if (normLum >= whiteCut) {
                data[di] = 255;
                data[di + 1] = 255;
                data[di + 2] = 255;
              } else {
                var scale = (contrastLut[normLum] + 10) / Math.max(20, lumVal);
                var rr = Math.min(255, Math.max(0, (data[di] * scale) | 0));
                var gg = Math.min(255, Math.max(0, (data[di + 1] * scale) | 0));
                var bb = Math.min(255, Math.max(0, (data[di + 2] * scale) | 0));
                var avg = (rr + gg + bb) / 3;
                data[di] = Math.min(255, Math.max(0, (avg + (rr - avg) * 1.45) | 0));
                data[di + 1] = Math.min(255, Math.max(0, (avg + (gg - avg) * 1.45) | 0));
                data[di + 2] = Math.min(255, Math.max(0, (avg + (bb - avg) * 1.45) | 0));
              }
            }
          }
        }

        fctx.putImageData(imgData, 0, 0);
      }

      if (pageCacheObj) {
        pageCacheObj._filterCacheKey = cacheKey;
        pageCacheObj._beforeCanvas = beforeCanvas;
        pageCacheObj._filteredBaseCanvas = filteredBaseCanvas;
      }
    }

    var outCanvas = document.createElement('canvas');
    outCanvas.width = filteredBaseCanvas.width;
    outCanvas.height = filteredBaseCanvas.height;
    var octx = outCanvas.getContext('2d');
    octx.drawImage(filteredBaseCanvas, 0, 0);

    if (strokes && strokes.length > 0) {
      for (var s = 0; s < strokes.length; s++) {
        renderStroke(octx, strokes[s]);
      }
    }

    var elapsedMs = Math.round(performance.now() - t0);
    return {
      beforeCanvas: beforeCanvas,
      afterCanvas: outCanvas,
      elapsedMs: elapsedMs
    };
  }

  function renderStroke(ctx, st) {
    if (!st) return;
    ctx.save();
    if (st.tool === 'brush') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.fillStyle = '#FFFFFF';
      ctx.lineWidth = st.size || 28;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var pts = st.points || [];
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, (st.size || 28) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
    } else if (st.tool === 'rect' || st.tool === 'maskbar') {
      ctx.fillStyle = '#FFFFFF';
      var rx = Math.min(st.x1, st.x2);
      var ry = Math.min(st.y1, st.y2);
      var rw = Math.abs(st.x2 - st.x1);
      var rh = Math.abs(st.y2 - st.y1);
      if (st.tool === 'maskbar' && rh < 28 && rw >= rh) rh = 34;
      ctx.fillRect(rx, ry, rw, rh);
    } else if (st.tool === 'line') {
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = Math.max(2.5, (st.size || 18) * 0.16);
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(st.x1, st.y1);
      var dy = Math.abs(st.y2 - st.y1);
      var dx = Math.abs(st.x2 - st.x1);
      var targetY = (dx > dy * 3) ? st.y1 : st.y2;
      var targetX = (dy > dx * 3) ? st.x1 : st.x2;
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function rotateStrokes90CW(strokes, oldW, oldH) {
    if (!strokes || !strokes.length || !oldW || !oldH) return strokes || [];
    return strokes.map(function (st) {
      if (!st) return st;
      if (st.tool === 'brush') {
        return {
          tool: 'brush',
          size: st.size || 28,
          points: (st.points || []).map(function (pt) {
            return {
              x: Math.round(oldH - pt.y),
              y: Math.round(pt.x)
            };
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
  }

  var api = {
    prepareGeometryCanvas: prepareGeometryCanvas,
    warpPerspectiveCanvas: warpPerspectiveCanvas,
    autoDetectCorners: autoDetectCorners,
    detectPaperSubrectFromLum: detectPaperSubrectFromLum,
    processPageCanvas: processPageCanvas,
    renderStroke: renderStroke,
    rotateStrokes90CW: rotateStrokes90CW
  };

  global.ScannerProcessor = api;
  global.ExamProcessor = api;
})(window);
