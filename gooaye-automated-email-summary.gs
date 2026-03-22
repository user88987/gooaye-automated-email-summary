var CONFIG = {
  ASSEMBLYAI_API_KEY: '',
  GEMINI_API_KEY:     '',
  EMAIL_ADDRESS:      '',
  SHEET_ID:           '',
  RSS_URL:            'https://feeds.soundon.fm/podcasts/954689a5-3096-43a4-a80b-7810b219cef3.xml'
};
 
function startTranscription() {
  var xml = UrlFetchApp.fetch(CONFIG.RSS_URL).getContentText();
  var doc = XmlService.parse(xml);
  var root = doc.getRootElement();
  var channel = root.getChild('channel');
  var items = channel.getChildren('item');
  var latest = items[0];
 
  var title = latest.getChild('title').getText();
  var enclosure = latest.getChild('enclosure');
  var audioUrl = enclosure ? enclosure.getAttribute('url').getValue() : null;
 
  if (!audioUrl) {
    Logger.log('Audio URL not found');
    return;
  }
 
  Logger.log('Latest episode: ' + title);
  Logger.log('Audio URL: ' + audioUrl);
 
  var payload = {
    audio_url: audioUrl,
    speech_models: ['universal'],
    language_code: 'zh',
    punctuate: true,
    format_text: true
  };
 
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'authorization': CONFIG.ASSEMBLYAI_API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
 
  var response = UrlFetchApp.fetch('https://api.assemblyai.com/v2/transcript', options);
  var result = JSON.parse(response.getContentText());
 
  if (!result.id) {
    Logger.log('AssemblyAI submission failed: ' + response.getContentText());
    return;
  }
 
  Logger.log('Transcription submitted. ID: ' + result.id);
 
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('log');
  var timestamp = new Date().toISOString();
  sheet.appendRow([timestamp, title, result.id, 'processing']);
 
  Logger.log('Logged to sheet. Waiting for transcription to complete.');
}
 
function checkAndSendReport() {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('log');
  var data = sheet.getDataRange().getValues();
 
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var title        = row[1];
    var transcriptId = row[2];
    var status       = row[3];
 
    if (status !== 'processing') continue;
 
    Logger.log('Checking transcription status: ' + transcriptId);
 
    var checkOptions = {
      method: 'get',
      headers: { 'authorization': CONFIG.ASSEMBLYAI_API_KEY },
      muteHttpExceptions: true
    };
 
    var checkResponse = UrlFetchApp.fetch(
      'https://api.assemblyai.com/v2/transcript/' + transcriptId,
      checkOptions
    );
    var checkResult = JSON.parse(checkResponse.getContentText());
 
    Logger.log('Status: ' + checkResult.status);
 
    if (checkResult.status === 'completed') {
      var transcript = checkResult.text;
      Logger.log('Transcript received. Length: ' + transcript.length + ' chars');
 
      var htmlReport = callGemini(title, transcript);
 
      MailApp.sendEmail({
        to: CONFIG.EMAIL_ADDRESS,
        subject: '【股癌自動晨報】' + title,
        htmlBody: htmlReport
      });
 
      Logger.log('Email sent!');
      sheet.getRange(i + 1, 4).setValue('done');
 
    } else if (checkResult.status === 'error') {
      Logger.log('Transcription error: ' + checkResult.error);
      sheet.getRange(i + 1, 4).setValue('error: ' + checkResult.error);
    }
  }
}
 
function callGemini(title, transcript) {
  var truncatedTranscript = transcript.length > 20000
    ? transcript.substring(0, 20000) + '\n\n[...content truncated...]'
    : transcript;
 
  var prompt =
    '你是一位資深且嚴謹的證券研究員。以下是股癌 Podcast 最新一集的完整逐字稿，' +
    '請幫我整理出一份詳盡的重點筆記。節目主持人全程統一稱為「股癌」，不得使用「謙虛老師」、「主委」或「主持人」等稱呼。\n\n' +
    '【極重要格式要求】請直接輸出 HTML 程式碼（CSS inline-style）。' +
    '請勿使用 Markdown（如 ### 或 **）。' +
    '請勿在開頭或結尾加上 ```html 等標記，直接給純 HTML 內容。\n\n' +
    '【公司 Ticker 格式規則】在「一、提及公司整理」區塊中，每間公司名稱必須使用 <b>粗體</b>，' +
    '並在公司名稱後面加上正規 ticker，格式如下：\n' +
    '- 美股：使用標準美股 ticker，例如 <b>Micron</b> (MU)、<b>Bloom Energy</b> (BE)、<b>Apple</b> (AAPL)\n' +
    '- 台股：使用四位數字加 .TW，例如 <b>臻鼎</b> (4958.TW)、<b>元太</b> (8069.TW)\n' +
    '- 日股：使用四位數字加 .T，例如 <b>Toyota</b> (7203.T)\n' +
    '- 未上市公司（如 OpenAI、Anthropic）：只寫公司名，不加 ticker\n' +
    '- 括號內只放 ticker，不放任何中文描述、業務說明或補充文字\n\n' +
    '【QA 數量規則】在輸出「四、QA 聽眾問答」之前，必須先在逐字稿中仔細數清楚本集共有幾個 QA 問題。' +
    '請在內部確認總數後，輸出的 QA 數量必須與逐字稿完全一致，不得多也不得少。\n\n' +
    '【空分類規則】「一、提及公司整理」中，若某個市場分類（美股／台股／日股／其他）在本集完全未提及任何公司，' +
    '請直接省略該分類的 <li>，不要寫「無」或「無提及」。\n\n' +
    '請嚴格依照以下 HTML 結構輸出：\n\n' +
    '<div style="font-family: \'PingFang TC\', \'Microsoft JhengHei\', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; background: #f9f9f9;">\n' +
    '<h1 style="color: #1a1a2e; font-size: 20px; border-bottom: 2px solid #e63946; padding-bottom: 8px;">【股癌晨報】' + title + '</h1>\n\n' +
    '<h2 style="color: #e63946; font-size: 16px; margin-top: 24px;">一、提及公司整理</h2>\n' +
    '<ul style="line-height: 1.8;">\n' +
    '<li><b>美股：</b> <b>公司名</b> (TICKER), <b>公司名</b> (TICKER)</li>\n' +
    '<li><b>台股：</b> <b>公司名</b> (XXXX.TW), <b>公司名</b> (XXXX.TW)</li>\n' +
    '</ul>\n\n' +
    '<h2 style="color: #e63946; font-size: 16px; margin-top: 24px;">二、本集重點摘要</h2>\n' +
    '<ol style="line-height: 1.8;">\n' +
    '<li>[摘要 1]</li>\n' +
    '<li>[摘要 2]</li>\n' +
    '<li>[摘要 3]</li>\n' +
    '</ol>\n\n' +
    '<h2 style="color: #e63946; font-size: 16px; margin-top: 24px;">三、重點詳細說明</h2>\n' +
    '<p style="line-height: 1.8;">[針對重點摘要進行詳細解釋，重要數據或關鍵字用 <b>粗體字</b> 標示，善用 <ul><li> 條列說明。全程以「股癌」稱呼主持人]</p>\n\n' +
    '<h2 style="color: #e63946; font-size: 16px; margin-top: 24px;">四、QA 聽眾問答</h2>\n' +
    '<div style="background: #fff8e1; border-left: 4px solid #f4a261; padding: 12px 16px; margin-bottom: 12px; border-radius: 4px;">\n' +
    '<b>Q: [聽眾提問摘要]</b><br>\n' +
    'A: [股癌的回答重點，條列式]\n' +
    '</div>\n\n' +
    '<h2 style="color: #e63946; font-size: 16px; margin-top: 24px;">五、完整逐字稿</h2>\n' +
    '<div style="background: #ffffff; border: 1px solid #e0e0e0; padding: 16px; border-radius: 4px; font-size: 13px; line-height: 1.9; color: #444; white-space: pre-wrap; max-height: 400px; overflow-y: auto;">\n' +
    truncatedTranscript + '\n' +
    '</div>\n\n' +
    '<div style="margin-top: 32px; padding: 16px; background: #f0f0f0; border-radius: 4px; font-size: 11px; color: #888; line-height: 1.6;">\n' +
    '<b>免責聲明</b><br>\n' +
    '本晨報由 Google Apps Script 自動抓取股癌 Podcast 逐字稿，並透過 Google Gemini AI 整理生成，內容僅供參考，不構成任何投資建議或買賣依據。' +
    '所有提及之個股、市場分析與觀點均源自 Podcast 節目內容，不代表本系統立場。' +
    '投資人應自行判斷並承擔投資風險，買賣股票前請諮詢合格專業人士意見。' +
    'AI 生成內容可能存在錯誤或遺漏，請以原始節目內容為準。\n' +
    '<br>This report is auto-generated by AI for personal reference only. It does not constitute investment advice.\n' +
    '</div>\n' +
    '</div>\n\n' +
    '---\n' +
    '節目標題：' + title + '\n\n' +
    '完整逐字稿：\n' + truncatedTranscript + '\n\n' +
    '請忽略贊助商內容及贊助連結。';
 
  var apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + CONFIG.GEMINI_API_KEY;
 
  var payload = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };
 
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
 
  var response = UrlFetchApp.fetch(apiUrl, options);
  var result = JSON.parse(response.getContentText());
 
  if (result.error) {
    Logger.log('Gemini API error: ' + result.error.message);
    return '<p>Gemini analysis failed. Check GAS execution logs.</p>';
  }
 
  var aiSummary = result.candidates[0].content.parts[0].text;
  return aiSummary.replace(/```html/g, '').replace(/```/g, '').trim();
}
 
function testFullFlow() {
  Logger.log('Starting test: submitting transcription job');
  startTranscription();
  Logger.log('Job submitted. Wait ~10 minutes, then run checkAndSendReport');
}
 
