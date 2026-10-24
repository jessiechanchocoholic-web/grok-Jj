/**
 * 試卷影像處理與清答案核心引擎 (Processor Engine)
 * 1. 旋轉與裁邊 (Rotation & Edge Crop)
 * 2. 局部背景估算去黑影＋紙底漂白 (Adaptive Shadow Removal & Paper Bleaching)
 * 3. 一鍵去紅筆／藍筆／彩筆批改與手寫答案 (HSV/Chroma Color Ink Eraser + Halo Dilation)
 * 4. 淺色鉛筆／手寫草稿淡化濾鏡 (Pencil & Gray Handwriting Filter)
 * 5. 頂部學校名／學生姓名私隱遮罩 (Auto Top Header Privacy Mask)
 * 6. 手動塗改液、拉白框、補劃橫線 (Manual Strokes Renderer)
 */
(function (global) {
  function prepareGeometryCanvas(srcCanvas, rotation, cropPercent) {
    var rot = ((rotation % 360) + 360) % 360;
    var sw = srcCanvas.width;
    var sh = srcCanvas.height;
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
    ctx.drawImage(srcCanvas, cx, cy, cw, ch, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
    return out;
  }

  function computeLocalBgGrid(data, w, h, blockSize) {
    var gw = Math.ceil(w / blockSize);
    var gh = Math.ceil(h / blockSize);
    var grid = new Float32Array(gw * gh);

    for (var gy = 0; gy < gh; gy++) {
      var y0 = gy * blockSize;
      var y1 = Math.min(h, y0 + blockSize);
      for (var gx = 0; gx < gw; gx++) {
        var x0 = gx * blockSize;
        var x1 = Math.min(w, x0 + blockSize);
        var maxLum = 160;
        // Sample every 2nd pixel for speed
        for (var y = y0; y < y1; y += 2) {
          var rowOff = y * w;
          for (var x = x0; x < x1; x += 2) {
            var idx = (rowOff + x) * 4;
            var lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            if (lum > maxLum) maxLum = lum;
          }
        }
        grid[gy * gw + gx] = maxLum;
      }
    }
    return { grid: grid, gw: gw, gh: gh, blockSize: blockSize };
  }

  function sampleBg(bgObj, x, y) {
    var gx = Math.min(bgObj.gw - 1, Math.floor(x / bgObj.blockSize));
    var gy = Math.min(bgObj.gh - 1, Math.floor(y / bgObj.blockSize));
    return bgObj.grid[gy * bgObj.gw + gx];
  }

  function processPageCanvas(srcCanvas, settings, strokes) {
    var geomCanvas = prepareGeometryCanvas(
      srcCanvas,
      settings.rotation || 0,
      settings.cropPercent || 0
    );
    var w = geomCanvas.width;
    var h = geomCanvas.height;
    var ctx = geomCanvas.getContext('2d');
    var imgData = ctx.getImageData(0, 0, w, h);
    var data = imgData.data;

    var autoWhiten = !!settings.autoWhiten;
    var whitenStrength = Number(settings.whitenStrength || 68);
    var removeColorInk = !!settings.removeColorInk;
    var colorSens = Number(settings.colorSensitivity || 58);
    var removePencil = !!settings.removePencil;
    var pencilThresh = Number(settings.pencilThreshold || 145);

    var bgObj = null;
    if (autoWhiten || removePencil) {
      bgObj = computeLocalBgGrid(data, w, h, 36);
    }

    // Step 1: Identify chromatic (Red / Blue / Green / Coloured ink) mask
    var colorMask = null;
    if (removeColorInk) {
      colorMask = new Uint8Array(w * h);
      // Higher colorSens => lower chroma threshold needed to erase colored ink
      var chromaCutoff = Math.max(12, 68 - colorSens * 0.72);
      var satCutoff = Math.max(0.08, 0.36 - colorSens * 0.0038);

      for (var p = 0; p < w * h; p++) {
        var i = p * 4;
        var r = data[i];
        var g = data[i + 1];
        var b = data[i + 2];
        var maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
        var minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
        var chroma = maxC - minC;
        var sat = maxC > 0 ? chroma / maxC : 0;

        // Detect blue ink (B significantly higher than R/G), red ink (R significantly higher than G/B), or general saturated ink
        var isBlue = (b - r >= chromaCutoff * 0.8) && (b - g >= chromaCutoff * 0.45) && b > 45;
        var isRed = (r - g >= chromaCutoff * 0.75) && (r - b >= chromaCutoff * 0.75) && r > 50;
        var isColor = (chroma >= chromaCutoff && sat >= satCutoff && maxC > 52);

        if (isBlue || isRed || isColor) {
          colorMask[p] = 1;
        }
      }

      // Dilate colorMask by 1px to clean anti-aliased edges around red/blue strokes,
      // EXCEPT when the pixel is deep neutral black (protects black printed underlines!)
      var dilated = new Uint8Array(colorMask);
      for (var y = 1; y < h - 1; y++) {
        var row = y * w;
        for (var x = 1; x < w - 1; x++) {
          var pos = row + x;
          if (colorMask[pos]) continue;
          if (
            colorMask[pos - 1] || colorMask[pos + 1] ||
            colorMask[pos - w] || colorMask[pos + w] ||
            colorMask[pos - w - 1] || colorMask[pos - w + 1] ||
            colorMask[pos + w - 1] || colorMask[pos + w + 1]
          ) {
            var idx2 = pos * 4;
            var r2 = data[idx2], g2 = data[idx2 + 1], b2 = data[idx2 + 2];
            var lum2 = r2 * 0.299 + g2 * 0.587 + b2 * 0.114;
            var chr2 = Math.max(r2, g2, b2) - Math.min(r2, g2, b2);
            // Only erase halo pixel if it isn't deep neutral black printed ink
            if (lum2 > 68 || chr2 > 14) {
              dilated[pos] = 1;
            }
          }
        }
      }
      colorMask = dilated;
    }

    // Step 2: Per-pixel bleaching, color removal, pencil removal & text sharpening
    // whitenStrength (10..95): controls how close to local background becomes pure white
    var bgTolerance = 12 + (whitenStrength * 0.48); // e.g. 68 -> ~44.6

    for (var py = 0; py < h; py++) {
      var rOff = py * w;
      for (var px = 0; px < w; px++) {
        var pIdx = rOff + px;
        var di = pIdx * 4;

        // 2a. Erase colored ink to pure white
        if (colorMask && colorMask[pIdx]) {
          data[di] = 255;
          data[di + 1] = 255;
          data[di + 2] = 255;
          continue;
        }

        var r0 = data[di];
        var g0 = data[di + 1];
        var b0 = data[di + 2];
        var lum = r0 * 0.299 + g0 * 0.587 + b0 * 0.114;

        var localBg = bgObj ? sampleBg(bgObj, px, py) : 235;
        // Relative brightness normalized against local paper background (0..255)
        var normLum = Math.min(255, (lum / Math.max(120, localBg)) * 255);

        // 2b. Remove light/medium gray pencil marks if enabled
        if (removePencil && normLum >= (255 - pencilThresh)) {
          data[di] = 255;
          data[di + 1] = 255;
          data[di + 2] = 255;
          continue;
        }

        // 2c. Adaptive paper whitening & black text contrast boost
        if (autoWhiten) {
          var whiteCut = 255 - bgTolerance;
          if (normLum >= whiteCut) {
            data[di] = 255;
            data[di + 1] = 255;
            data[di + 2] = 255;
          } else {
            // Darken printed text for crisp laser-printer look
            var ratio = normLum / Math.max(1, whiteCut);
            var darkened = Math.max(0, Math.floor(Math.pow(ratio, 1.85) * 210));
            data[di] = darkened;
            data[di + 1] = darkened;
            data[di + 2] = darkened;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Step 3: Auto Top Header Privacy Mask (covers school name & student name band at top)
    if (settings.autoHeaderMask) {
      var maskRatio = Number(settings.headerMaskRatio || 9.2) / 100;
      var maskH = Math.round(h * maskRatio);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, maskH);
    }

    // Step 4: Render Manual Strokes (Brush Whiteout, White Privacy Box, Black Underline)
    if (strokes && strokes.length > 0) {
      for (var s = 0; s < strokes.length; s++) {
        renderStroke(ctx, strokes[s]);
      }
    }

    return {
      beforeCanvas: geomCanvas,
      afterCanvas: geomCanvas // Note: we also keep a clean copy of beforeCanvas if needed
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
    } else if (st.tool === 'rect') {
      ctx.fillStyle = '#FFFFFF';
      var rx = Math.min(st.x1, st.x2);
      var ry = Math.min(st.y1, st.y2);
      var rw = Math.abs(st.x2 - st.x1);
      var rh = Math.abs(st.y2 - st.y1);
      ctx.fillRect(rx, ry, rw, rh);
    } else if (st.tool === 'line') {
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = Math.max(2.5, (st.size || 12) * 0.16);
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(st.x1, st.y1);
      // Snap near-horizontal lines to horizontal for neat fill-in-the-blank lines
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
    processPageCanvas: processPageCanvas,
    renderStroke: renderStroke
  };
})(window);
