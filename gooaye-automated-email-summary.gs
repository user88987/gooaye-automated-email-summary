// ============================================================
//  Gooaye Automated Morning Note System
//  Flow: RSS Feed → AssemblyAI Transcription → Gemini Analysis → Gmail
// ============================================================

var CONFIG = {
  ASSEMBLYAI_API_KEY: '',   // Get from assemblyai.com
  GEMINI_API_KEY:     '',   // Get from aistudio.google.com
  EMAIL_ADDRESS:      '',   // Your Gmail address
  SHEET_ID:           '',   // Google Sheet ID (the string between /d/ and /edit in the URL)
  RSS_URL:            'https://feeds.soundon.fm/podcasts/954689a5-3096-43a4-a80b-7810b219cef3.xml'
};

// ------------------------------------------------------------
//  FUNCTION A: startTranscription
//  Trigger: Every Wednesday & Saturday (set in GAS Triggers)
//  1. Fetch latest episode title + audio URL from RSS
//  2. Submit audio to AssemblyAI for transcription
//  3. Save transcriptId + status to Google Sheet log
// ------------------------------------------------------------
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

// ------------------------------------------------------------
//  FUNCTION B: checkAndSendReport
//  Trigger: Every 5 minutes (set in GAS Triggers)
//  1. Find rows with status "processing" in the log sheet
//  2. Poll AssemblyAI for transcription status
//  3. When complete: send to Gemini → format as HTML → send email
// ------------------------------------------------------------
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

// ------------------------------------------------------------
//  HELPER: callGemini
//  Sends transcript to Gemini and returns formatted HTML report
// ------------------------------------------------------------
function callGemini(title, transcript) {
  var truncatedTranscript = transcript.length > 20000
    ? transcript.substring(0, 20000) + '\n\n[...content truncated...]'
    : transcript;

  var prompt =
    '你是一位資深且嚴謹的證券研究員。以下是股癌 Podcast 最新一集的完整逐字稿，' +
    '請幫我整理出一份詳盡的重點筆記。\n\n' +
    '【極重要格式要求】請直接輸出 HTML 程式碼（CSS inline-style）。' +
    '請勿使用 Markdown（如 ### 或 **）。' +
    '請勿在開頭或結尾加上 ```html 等標記，直接給純 HTML 內容。\n\n' +
    '請嚴格依照以下 HTML 結構輸出，不得省略任何區塊：\n\n' +

    '<div style="font-family: \'PingFang TC\', \'Microsoft JhengHei\', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; background: #f9f9f9;">\n' +
    '<h1 style="color: #1a1a2e; font-size: 20px; border-bottom: 2px solid #e63946; padding-bottom: 8px;">【股癌晨報】' + title + '</h1>\n\n' +

    '<h2 style="color: #e63946; font-size: 16px; margin-top: 24px;">一、提及公司整理</h2>\n' +
    '<ul style="line-height: 1.8;">\n' +
    '<li><b>美股：</b> [內容]</li>\n' +
    '<li><b>台股：</b> [內容]</li>\n' +
    '<li><b>日股：</b> [內容]</li>\n' +
    '<li><b>其他：</b> [內容]</li>\n' +
    '</ul>\n\n' +

    '<h2 style="color: #e63946; font-size: 16px; margin-top: 24px;">二、本集重點摘要</h2>\n' +
    '<ol style="line-height: 1.8;">\n' +
    '<li>[摘要 1]</li>\n' +
    '<li>[摘要 2]</li>\n' +
    '<li>[摘要 3]</li>\n' +
    '</ol>\n\n' +

    '<h2 style="color: #e63946; font-size: 16px; margin-top: 24px;">三、重點詳細說明</h2>\n' +
    '<p style="line-height: 1.8;">[針對重點摘要進行詳細解釋，重要數據或關鍵字用 <b>粗體字</b> 標示，善用 <ul><li> 條列說明]</p>\n\n' +

    '<h2 style="color: #e63946; font-size: 16px; margin-top: 24px;">四、QA 聽眾問答</h2>\n' +
    '<div style="background: #fff8e1; border-left: 4px solid #f4a261; padding: 12px 16px; margin-bottom: 12px; border-radius: 4px;">\n' +
    '<b>Q: [聽眾提問]</b><br>\n' +
    'A: [謙虛老師的回答，條列重點]\n' +
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

// ------------------------------------------------------------
//  TEST: testFullFlow
//  Run this manually to test the full pipeline end-to-end
// ------------------------------------------------------------
function testFullFlow() {
  Logger.log('=== Starting test: submitting transcription job ===');
  startTranscription();
  Logger.log('=== Job submitted. Wait ~10 minutes, then run checkAndSendReport ===');
}
