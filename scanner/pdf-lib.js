/**
 * 100% 本地瀏覽器多頁高清 A4 PDF 生成器 (Zero-dependency, 無浮水印, 無頁數限制)
 * 支援直接將多個 HTMLCanvasElement 打包成標準 A4 (595.28 x 841.89 pt) PDF 二進位檔 (Blob)
 */
(function (global) {
  function stringToBytes(str) {
    var bytes = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function dataUrlToUint8Array(dataUrl) {
    var base64 = dataUrl.split(',')[1];
    var bin = atob(base64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * 由多個 Canvas 生成一份 A4 PDF Blob
   * @param {Array<{canvas: HTMLCanvasElement, marginPt?: number, quality?: number}>} pageItems
   * @returns {Blob}
   */
  function generateA4PdfBlob(pageItems) {
    var chunks = [];
    var offset = 0;
    var offsets = [0]; // 1-indexed object offsets

    function pushBytes(u8) {
      chunks.push(u8);
      offset += u8.length;
    }

    function pushStr(str) {
      pushBytes(stringToBytes(str));
    }

    // PDF Header with binary comment
    pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    var numPages = pageItems.length;
    // Object numbering plan:
    // 1: Catalog
    // 2: Pages
    // For each page i (0 .. numPages-1):
    //   pageObjId  = 3 + i * 3
    //   contentObj = 4 + i * 3
    //   imageObj   = 5 + i * 3

    // Object 1: Catalog
    offsets[1] = offset;
    pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    // Object 2: Pages
    var kidsRefs = [];
    for (var i = 0; i < numPages; i++) {
      kidsRefs.push((3 + i * 3) + ' 0 R');
    }
    offsets[2] = offset;
    pushStr('2 0 obj\n<< /Type /Pages /Kids [ ' + kidsRefs.join(' ') + ' ] /Count ' + numPages + ' >>\nendobj\n');

    // A4 standard dimensions in points (72 dpi)
    var A4_W = 595.28;
    var A4_H = 841.89;

    for (var p = 0; p < numPages; p++) {
      var item = pageItems[p];
      var canvas = item.canvas;
      var quality = item.quality || 0.92;
      var margin = typeof item.marginPt === 'number' ? item.marginPt : 14;

      // Ensure white background on exported JPEG
      var exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      var ectx = exportCanvas.getContext('2d');
      ectx.fillStyle = '#FFFFFF';
      ectx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      ectx.drawImage(canvas, 0, 0);

      var jpegDataUrl = exportCanvas.toDataURL('image/jpeg', quality);
      var jpegBytes = dataUrlToUint8Array(jpegDataUrl);

      var imgW = exportCanvas.width;
      var imgH = exportCanvas.height;

      // Fit image inside A4 printable box preserving aspect ratio
      var availW = A4_W - margin * 2;
      var availH = A4_H - margin * 2;
      var scale = Math.min(availW / imgW, availH / imgH);
      var drawW = imgW * scale;
      var drawH = imgH * scale;
      var drawX = (A4_W - drawW) / 2;
      var drawY = (A4_H - drawH) / 2;

      var pageObjId = 3 + p * 3;
      var contentObjId = 4 + p * 3;
      var imageObjId = 5 + p * 3;
      var imgName = '/Im' + (p + 1);

      // Page Object
      offsets[pageObjId] = offset;
      pushStr(
        pageObjId + ' 0 obj\n' +
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + A4_W.toFixed(2) + ' ' + A4_H.toFixed(2) + '] ' +
        '/Resources << /XObject << ' + imgName + ' ' + imageObjId + ' 0 R >> >> ' +
        '/Contents ' + contentObjId + ' 0 R >>\n' +
        'endobj\n'
      );

      // Content Stream Object
      var contentCmd =
        'q\n' +
        drawW.toFixed(2) + ' 0 0 ' + drawH.toFixed(2) + ' ' + drawX.toFixed(2) + ' ' + drawY.toFixed(2) + ' cm\n' +
        imgName + ' Do\n' +
        'Q\n';
      var contentBytes = stringToBytes(contentCmd);
      offsets[contentObjId] = offset;
      pushStr(
        contentObjId + ' 0 obj\n' +
        '<< /Length ' + contentBytes.length + ' >>\n' +
        'stream\n'
      );
      pushBytes(contentBytes);
      pushStr('\nendstream\nendobj\n');

      // Image XObject
      offsets[imageObjId] = offset;
      pushStr(
        imageObjId + ' 0 obj\n' +
        '<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegBytes.length + ' >>\n' +
        'stream\n'
      );
      pushBytes(jpegBytes);
      pushStr('\nendstream\nendobj\n');
    }

    var totalObjs = 2 + numPages * 3;
    var xrefOffset = offset;
    pushStr('xref\n0 ' + (totalObjs + 1) + '\n');
    pushStr('0000000000 65535 f \n');
    for (var k = 1; k <= totalObjs; k++) {
      var offStr = String(offsets[k]);
      while (offStr.length < 10) offStr = '0' + offStr;
      pushStr(offStr + ' 00000 n \n');
    }

    pushStr(
      'trailer\n' +
      '<< /Size ' + (totalObjs + 1) + ' /Root 1 0 R >>\n' +
      'startxref\n' +
      xrefOffset + '\n' +
      '%%EOF\n'
    );

    return new Blob(chunks, { type: 'application/pdf' });
  }

  global.LocalPdfGenerator = {
    generateA4PdfBlob: generateA4PdfBlob
  };
})(window);
