/**
 * 試卷影像處理與清答案核心引擎 v3.0 (CamScanner Full Engine)
 * 支援：
 * 1. 四點透視拉直裁切 (4-Corner Homography Perspective Warp + 自動紙張邊緣偵測)
 * 2. 四大濾鏡模式：
 *    - 'original'    (📷 原圖)
 *    - 'magicColor'  (🪄 增亮魔術色：去黑影漂白紙底＋保留鮮明彩色與黑字)
 *    - 'bw'          (✨ 高清黑白：去黑影純黑白高對比)
 *    - 'cleanAnswer' (🧹 自動清答案：去紅藍筆批改手寫＋濾鉛筆字＋去黑影＋可選遮頂部校名學生名)
 * 3. 手動塗改工具：⬜ 拉白框 (rect)、🖌️ 塗改筆 (brush)、📏 補橫線 (line)、🏷️ 遮名條 (maskbar)
 */
(function (global) {
  /**
   * 解 8x8 線性方程組以求透視變換矩陣 (Homography)
   */
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

  /**
   * 根據目標矩形 (0,0)-(dstW,dstH) 映射到原圖四個角點 [TL, TR, BR, BL] (normalized 0..1)
   * 進行雙線性插值透視拉直 (Inverse Homography Mapping)
   */
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

    // Check if corners are essentially full rectangle (skip warp for speed)
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

    // Map dst (u,v) -> src (x,y)
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
   * 自動偵測紙張四隻角（若背景有深色檯面則收縮至紙張邊界，否則預設向內縮 4% 切走黑邊）
   */
  function autoDetectCorners(srcCanvas) {
    var w = srcCanvas.width;
    var h = srcCanvas.height;
    var ctx = srcCanvas.getContext('2d');
    var data = ctx.getImageData(0, 0, w, h).data;
    var minX = w, minY = h, maxX = 0, maxY = 0;
    var stepX = Math.max(2, Math.floor(w / 80));
    var stepY = Math.max(2, Math.floor(h / 80));
    var found = 0;

    for (var y = 0; y < h; y += stepY) {
      for (var x = 0; x < w; x += stepX) {
        var idx = (y * w + x) << 2;
        var lum = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
        if (lum > 145) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found++;
        }
      }
    }

    if (found < 20 || (maxX - minX > w * 0.94 && maxY - minY > h * 0.94)) {
      return [
        { x: 0.03, y: 0.03 },
        { x: 0.97, y: 0.03 },
        { x: 0.97, y: 0.97 },
        { x: 0.03, y: 0.97 }
      ];
    }

    var x0 = Math.max(0.01, minX / w);
    var y0 = Math.max(0.01, minY / h);
    var x1 = Math.min(0.99, maxX / w);
    var y1 = Math.min(0.99, maxY / h);
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 }
    ];
  }

  function prepareGeometryCanvas(srcCanvas, rotation, cropPercent, cropCorners) {
    var base = srcCanvas;
    if (cropCorners && cropCorners.length === 4) {
      base = warpPerspectiveCanvas(srcCanvas, cropCorners);
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
      settings.filterMode || 'cleanAnswer',
      settings.rotation || 0,
      settings.cropPercent || 0,
      cStr,
      settings.autoWhiten ? 1 : 0,
      settings.whitenStrength || 68,
      settings.removeColorInk ? 1 : 0,
      settings.colorSensitivity || 62,
      settings.removePencil ? 1 : 0,
      settings.pencilThreshold || 145,
      settings.autoHeaderMask ? 1 : 0,
      settings.headerMaskRatio || 9.0
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

        var autoWhiten = mode === 'bw' || mode === 'magicColor' || !!settings.autoWhiten;
        var whitenStrength = Number(settings.whitenStrength || 68);
        var removeColorInk = mode === 'cleanAnswer' && !!settings.removeColorInk;
        var colorSens = Number(settings.colorSensitivity || 62);
        var removePencil = mode === 'cleanAnswer' && !!settings.removePencil;
        var pencilThresh = Number(settings.pencilThreshold || 145);

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
                if (lumArr[pos] > 70) {
                  colorMask[pos] = 2;
                }
              }
            }
          }
        }

        var bgMap = buildFastBgMap(lumArr, w, h);
        var bgTolerance = 12 + (whitenStrength * 0.48);
        var whiteCut = 255 - bgTolerance;
        var pencilCut = 255 - pencilThresh;

        var contrastLut = new Uint8Array(256);
        for (var nv = 0; nv < 256; nv++) {
          if (nv >= whiteCut) {
            contrastLut[nv] = 255;
          } else {
            var ratio = nv / Math.max(1, whiteCut);
            var gamma = mode === 'bw' ? 2.2 : 1.85;
            contrastLut[nv] = Math.max(0, Math.floor(Math.pow(ratio, gamma) * 205));
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

            if (colorMask && colorMask[pIdx]) {
              data[di] = 255;
              data[di + 1] = 255;
              data[di + 2] = 255;
              continue;
            }

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

            if (removePencil && normLum >= pencilCut) {
              data[di] = 255;
              data[di + 1] = 255;
              data[di + 2] = 255;
              continue;
            }

            if (mode === 'magicColor') {
              // Magic Color: bleach background to white, boost saturation & contrast of foreground ink
              if (normLum >= whiteCut) {
                data[di] = 255;
                data[di + 1] = 255;
                data[di + 2] = 255;
              } else {
                var scale = (contrastLut[normLum] + 15) / Math.max(20, lumVal);
                var rr = Math.min(255, Math.max(0, (data[di] * scale) | 0));
                var gg = Math.min(255, Math.max(0, (data[di + 1] * scale) | 0));
                var bb = Math.min(255, Math.max(0, (data[di + 2] * scale) | 0));
                var avg = (rr + gg + bb) / 3;
                data[di] = Math.min(255, Math.max(0, (avg + (rr - avg) * 1.45) | 0));
                data[di + 1] = Math.min(255, Math.max(0, (avg + (gg - avg) * 1.45) | 0));
                data[di + 2] = Math.min(255, Math.max(0, (avg + (bb - avg) * 1.45) | 0));
              }
            } else if (autoWhiten) {
              var outGray = contrastLut[normLum];
              data[di] = outGray;
              data[di + 1] = outGray;
              data[di + 2] = outGray;
            }
          }
        }

        fctx.putImageData(imgData, 0, 0);

        if (mode === 'cleanAnswer' && settings.autoHeaderMask) {
          var maskRatio = Number(settings.headerMaskRatio || 9.0) / 100;
          var maskH = Math.round(h * maskRatio);
          fctx.fillStyle = '#FFFFFF';
          fctx.fillRect(0, 0, w, maskH);
        }
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
      if (st.tool === 'maskbar' && rh < 28) rh = 34;
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
      ctx.lineTo(st.x2, targetY);
      ctx.stroke();
    }
    ctx.restore();
  }

  global.ScannerProcessor = {
    prepareGeometryCanvas: prepareGeometryCanvas,
    warpPerspectiveCanvas: warpPerspectiveCanvas,
    autoDetectCorners: autoDetectCorners,
    processPageCanvas: processPageCanvas,
    renderStroke: renderStroke
  };
})(window);
