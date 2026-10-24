/**
 * 內置「試用示範卷」生成器
 * 生成逼真嘅手機拍攝試卷（帶有枱面漸變黑影、頂部學校名同學生姓名、
 * 藍色原子筆手寫答案、鉛筆草稿字、老師紅筆剔號/交叉/88分批改），
 * 等 Jessie 一開 App 唔使搵真卷都可以即刻體驗「一鍵清答案＋去黑影」！
 */
(function (global) {
  function createDemoPage1Canvas() {
    var w = 1000;
    var h = 1414; // Standard A4 ratio (1 : 1.414)
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');

    // 1. Simulate phone photo uneven gray/warm lighting shadow across paper
    var bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#e6e4de');
    bgGrad.addColorStop(0.45, '#dad8d0');
    bgGrad.addColorStop(1, '#c5c2b8');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle corner shadow vignette (typical iPad/phone shadow when taking photo)
    var radGrad = ctx.createRadialGradient(w * 0.82, h * 0.85, 60, w * 0.75, h * 0.8, 700);
    radGrad.addColorStop(0, 'rgba(145, 142, 132, 0.42)');
    radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Printed Header (School + Student Info + Printed Title in dark neutral ink)
    ctx.fillStyle = '#1e2022';
    ctx.strokeStyle = '#1e2022';

    // Top student info box (to demonstrate privacy header masking or erasing)
    ctx.font = 'bold 24px "PingFang HK", "Noto Sans TC", sans-serif';
    ctx.fillText('聖公會示範小學 (2026-2027 年度 上學期評估一)', 70, 68);
    ctx.font = '22px "PingFang HK", "Noto Sans TC", sans-serif';
    ctx.fillText('姓名：____________    班別：_______    學號：(    )    日期：24/10/2026', 70, 112);

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(65, 132);
    ctx.lineTo(w - 65, 132);
    ctx.stroke();

    // Main Worksheet Title
    ctx.font = 'bold 34px Arial, "PingFang HK", sans-serif';
    ctx.fillText('P.3 English Grammar & Reading Quiz (Unit 1–2)', 70, 192);

    // Section A: Fill in the blanks with Verbs
    ctx.font = 'bold 25px Arial, "PingFang HK", sans-serif';
    ctx.fillText('Part A: Fill in the blanks with the correct form of the verbs. (40%)', 70, 252);

    var partAQuestions = [
      { num: '1.', pre: 'Tom always ', blankW: 210, post: ' (play) football on Sundays.', ans: 'plays', correct: true },
      { num: '2.', pre: 'Look! The children ', blankW: 240, post: ' (sing) in the music room.', ans: 'are singing', correct: true },
      { num: '3.', pre: 'My mother ', blankW: 220, post: ' (buy) some apples yesterday.', ans: 'buyed', corrText: 'bought', correct: false },
      { num: '4.', pre: 'We ', blankW: 220, post: ' (not / like) eating spicy food.', ans: 'do not like', correct: true }
    ];

    ctx.font = '25px Arial, sans-serif';
    var startY = 322;
    var rowGap = 86;
    var blankCoordsA = [];

    for (var i = 0; i < partAQuestions.length; i++) {
      var q = partAQuestions[i];
      var y = startY + i * rowGap;
      ctx.fillStyle = '#1b1d1f';
      ctx.font = 'bold 25px Arial, sans-serif';
      ctx.fillText(q.num, 75, y);

      ctx.font = '25px Arial, sans-serif';
      var preX = 120;
      ctx.fillText(q.pre, preX, y);
      var preW = ctx.measureText(q.pre).width;

      // Printed black underline for blank
      var lineX1 = preX + preW + 6;
      var lineX2 = lineX1 + q.blankW;
      ctx.strokeStyle = '#1b1d1f';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(lineX1, y + 6);
      ctx.lineTo(lineX2, y + 6);
      ctx.stroke();

      ctx.fillText(q.post, lineX2 + 10, y);
      blankCoordsA.push({ x: lineX1, y: y, w: q.blankW, q: q });
    }

    // Section B: Reading & Prepositions (Chinese / Bilingual instructions)
    var secBY = 685;
    ctx.fillStyle = '#1b1d1f';
    ctx.font = 'bold 25px "PingFang HK", Arial, sans-serif';
    ctx.fillText('Part B: 閱讀短文並回答問題 / Fill in the correct prepositions (in / on / at). (60%)', 70, secBY);

    // Reading passage box
    ctx.strokeStyle = '#22252a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(70, secBY + 22, w - 140, 145);
    ctx.font = '22px Arial, sans-serif';
    ctx.fillText('Mary gets up at seven o\'clock every morning. She goes to school by bus.', 92, secBY + 68);
    ctx.fillText('In the afternoon, she reads storybooks with her brother in the library.', 92, secBY + 108);
    ctx.fillText('On Friday evenings, they watch cartoons at home happily.', 92, secBY + 146);

    var partBQuestions = [
      { num: '5.', pre: 'Mary wakes up ', blankW: 150, post: ' seven o\'clock every day.', ans: 'at', correct: true },
      { num: '6.', pre: 'She reads books ', blankW: 150, post: ' the afternoon.', ans: 'in', correct: true },
      { num: '7.', pre: 'They watch cartoons ', blankW: 150, post: ' Friday evenings.', ans: 'on', correct: true },
      { num: '8.', pre: 'Where does Mary read storybooks? Answer: ', blankW: 290, post: '', ans: 'In the library.', correct: true }
    ];

    var startBY = secBY + 235;
    var blankCoordsB = [];
    for (var j = 0; j < partBQuestions.length; j++) {
      var qb = partBQuestions[j];
      var yb = startBY + j * 86;
      ctx.fillStyle = '#1b1d1f';
      ctx.font = 'bold 25px Arial, sans-serif';
      ctx.fillText(qb.num, 75, yb);
      ctx.font = '25px Arial, sans-serif';
      var preBX = 120;
      ctx.fillText(qb.pre, preBX, yb);
      var preBW = ctx.measureText(qb.pre).width;
      var lx1 = preBX + preBW + 6;
      var lx2 = lx1 + qb.blankW;
      ctx.strokeStyle = '#1b1d1f';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(lx1, yb + 6);
      ctx.lineTo(lx2, yb + 6);
      ctx.stroke();
      if (qb.post) ctx.fillText(qb.post, lx2 + 10, yb);
      blankCoordsB.push({ x: lx1, y: yb, w: qb.blankW, q: qb });
    }

    // Footer printed
    ctx.fillStyle = '#22252a';
    ctx.font = '20px "PingFang HK", sans-serif';
    ctx.fillText('— 全卷完 (Page 1 of 1) — 請細心檢查答案', 310, h - 55);

    // =========================================================================
    // 3. HANDWRITTEN STUDENT ANSWERS (Blue Pen + Light Pencil Notes)
    //    & TEACHER GRADING MARKS (Red Pen Score "88", Checkmarks, Corrections)
    // =========================================================================

    // Student Name & Class written in Blue Ballpoint Pen at top
    ctx.save();
    ctx.fillStyle = '#1d4ed8';
    ctx.font = 'italic bold 28px "PingFang HK", cursive, sans-serif';
    ctx.fillText('陳小明 Chan Siu Ming', 145, 108);
    ctx.fillText('3A', 435, 108);
    ctx.fillText('12', 596, 108);
    ctx.restore();

    // Teacher Big Red Score at Top Right: "88 / 100" + Double Underline + "Good!"
    ctx.save();
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#dc2626';
    ctx.font = 'bold italic 68px Arial, sans-serif';
    ctx.fillText('88', w - 220, 102);
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillText('Good!', w - 125, 98);
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(w - 230, 114);
    ctx.lineTo(w - 130, 106);
    ctx.moveTo(w - 228, 124);
    ctx.lineTo(w - 128, 116);
    ctx.stroke();
    ctx.restore();

    // Draw Blue Handwritten Answers & Red Teacher Ticks for Part A & Part B
    var allBlanks = blankCoordsA.concat(blankCoordsB);
    for (var k = 0; k < allBlanks.length; k++) {
      var item = allBlanks[k];
      // Blue pen answer slightly above the black underline so it looks natural
      ctx.save();
      ctx.fillStyle = '#1e40af';
      ctx.font = 'italic bold 30px "Comic Sans MS", "PingFang HK", cursive, sans-serif';
      ctx.fillText(item.q.ans, item.x + 18, item.y - 4);
      ctx.restore();

      // Red teacher grading mark
      ctx.save();
      ctx.strokeStyle = '#dc2626';
      ctx.fillStyle = '#dc2626';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var markX = item.x + item.w - 30;
      var markY = item.y - 16;
      if (item.q.correct) {
        // Red Checkmark ✓
        ctx.beginPath();
        ctx.moveTo(markX, markY);
        ctx.lineTo(markX + 14, markY + 15);
        ctx.lineTo(markX + 44, markY - 22);
        ctx.stroke();
      } else {
        // Red Cross ✗ + Red correction word
        ctx.beginPath();
        ctx.moveTo(markX, markY - 14);
        ctx.lineTo(markX + 28, markY + 14);
        ctx.moveTo(markX + 28, markY - 14);
        ctx.lineTo(markX, markY + 14);
        ctx.stroke();
        ctx.font = 'bold 26px Arial, sans-serif';
        ctx.fillText(item.q.corrText, item.x + 115, item.y - 34);
      }
      ctx.restore();
    }

    // Light gray pencil margin notes & grammar reminders written by student
    ctx.save();
    ctx.fillStyle = '#787c82';
    ctx.strokeStyle = '#787c82';
    ctx.font = 'italic 22px "PingFang HK", sans-serif';
    ctx.fillText('(*鉛筆筆記：第三人稱單數記得加 s / 過去式要背不規則動詞表)', 75, 635);
    ctx.fillText('(鉛筆草稿：at + 時間點, on + 星期幾, in + 上下午)', 75, h - 115);
    ctx.restore();

    return canvas;
  }

  global.DemoSheetGenerator = {
    createDemoPage1Canvas: createDemoPage1Canvas
  };
})(window);
