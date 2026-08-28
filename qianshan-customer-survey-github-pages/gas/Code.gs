/**
 * 千山淨水 服務滿意度問卷 - Google Apps Script 後端
 *
 * 部署步驟：
 * 1. 打開你的 Google Sheet -> 上方選單「擴充功能」->「Apps Script」
 * 2. 把編輯器裡原本的範例程式碼全部刪除，貼上這個檔案的內容
 * 3. 左側「專案設定」(齒輪圖示) -> 指令碼屬性 -> 新增屬性：
 *      屬性：SURVEY_ADMIN_SECRET
 *      值：自己設一組密碼（例如一串隨機字串），之後建立問卷連結時要用
 * 4. 右上角「部署」->「新增部署作業」-> 類型選「網頁應用程式」
 *      執行身分：我 (你自己的帳號)
 *      具有存取權的使用者：所有人
 *    按下「部署」，第一次會跳出 Google 授權畫面，這是「你自己」在授權「你自己的指令碼」
 *    存取「你自己的」Google Sheet，不會經過或交給任何第三方。
 * 5. 複製部署後拿到的網址（結尾是 /exec），這就是前端要打的 API 網址。
 *
 * 資料會自動建立兩個工作表：
 * - Invitations：一次性問卷連結的核發紀錄（token 雜湊、客戶代號、電話末四碼、建立時間、使用時間）
 * - Responses：問卷送出結果（時間、客戶代號、評分、意見）
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "createInvitation") {
      return handleCreateInvitation(body);
    }
    if (body.action === "submitSurvey") {
      return handleSubmitSurvey(body);
    }
    return jsonResponse({ error: "未知的操作" });
  } catch (err) {
    return jsonResponse({ error: "伺服器發生錯誤: " + err.message });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var token = e.parameter.token;
  if (!token) return jsonResponse({ valid: false });

  var row = findInvitationRow(hashToken(token));
  if (!row || row.usedAt) return jsonResponse({ valid: false });
  return jsonResponse({ valid: true });
}

function handleCreateInvitation(body) {
  var expected = PropertiesService.getScriptProperties().getProperty("SURVEY_ADMIN_SECRET");
  if (!expected || body.adminSecret !== expected) {
    return jsonResponse({ error: "未授權" });
  }

  var customerCode = (body.customerCode || "").toString().trim();
  var phone = (body.phone || "").toString().replace(/\D/g, "");
  if (!customerCode || phone.length < 8) {
    return jsonResponse({ error: "請提供客戶代號與有效電話" });
  }

  var token = Utilities.getUuid() + Utilities.getUuid();
  var sheet = getSheet("Invitations");
  sheet.appendRow([hashToken(token), customerCode, phone.slice(-4), new Date(), ""]);

  var base = (body.baseUrl || "").toString().replace(/\/$/, "");
  var url = base ? base + "/?token=" + token : token;

  return jsonResponse({
    ok: true,
    token: token,
    url: url,
    smsText: "您好，請點擊連結填寫服務滿意度問卷：" + url,
  });
}

function handleSubmitSurvey(body) {
  var rating = body.rating;
  var comment = (body.comment || "").toString().trim().slice(0, 300);
  var token = (body.token || "").toString();
  var customerCode = (body.customerCode || "").toString().trim();
  var phone = (body.phone || "").toString().replace(/\D/g, "");

  if (rating !== "satisfied" && rating !== "unsatisfied") {
    return jsonResponse({ error: "請選擇滿意或不滿意" });
  }
  if (!token) {
    return jsonResponse({ error: "問卷連結無效或已使用" });
  }

  var sheet = getSheet("Invitations");
  var data = sheet.getDataRange().getValues();
  var tokenHash = hashToken(token);
  var rowIndex = -1;
  var invitation = null;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === tokenHash) {
      rowIndex = i;
      invitation = { customerCode: data[i][1], phoneLast4: data[i][2], usedAt: data[i][4] };
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ error: "問卷連結無效或已使用" });
  }
  if (
    (customerCode && customerCode !== invitation.customerCode) ||
    (phone && phone.slice(-4) !== invitation.phoneLast4)
  ) {
    return jsonResponse({ error: "問卷資料不相符" });
  }
  if (invitation.usedAt) {
    return jsonResponse({ error: "這份問卷已完成，無法再次填寫" });
  }

  // 欄位順序: TokenHash, CustomerCode, PhoneLast4, CreatedAt, UsedAt -> UsedAt 是第 5 欄
  sheet.getRange(rowIndex + 1, 5).setValue(new Date());

  var responses = getSheet("Responses");
  responses.appendRow([new Date(), invitation.customerCode, rating, comment]);

  return jsonResponse({ ok: true });
}

function findInvitationRow(tokenHash) {
  var sheet = getSheet("Invitations");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === tokenHash) {
      return { usedAt: data[i][4] };
    }
  }
  return null;
}

function hashToken(token) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  return bytes
    .map(function (b) {
      return (b < 0 ? b + 256 : b).toString(16).padStart(2, "0");
    })
    .join("");
}

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === "Invitations") {
      sheet.appendRow(["TokenHash", "CustomerCode", "PhoneLast4", "CreatedAt", "UsedAt"]);
    } else if (name === "Responses") {
      sheet.appendRow(["Timestamp", "CustomerCode", "Rating", "Comment"]);
    }
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
