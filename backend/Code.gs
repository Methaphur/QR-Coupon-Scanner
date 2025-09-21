function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Coupons");
  
  // === Case 1: Update usage manually ===
  if (e.parameter.update) {
    var couponID = e.parameter.id;
    var used = parseInt(e.parameter.used);
    if (!couponID || isNaN(used)) {
      return ContentService.createTextOutput("⚠️ Invalid update request");
    }

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = row[4];
      var count = row[2];
      var name = row[0];

      if (id == couponID) {
        var remaining = count - used;
        if (remaining < 0) remaining = 0;
        sheet.getRange(i+1, 8).setValue(remaining);
        return ContentService.createTextOutput(
          "✅ Updated " + name + "'s Coupons" + " | Remaining: " + remaining + " / " + count
        );
      }
    }
    return ContentService.createTextOutput("❌ Coupon not found");
  }
  
  // === Case 2: Normal scan check ===
  var couponID = e.parameter.id;
  if (!couponID) return ContentService.createTextOutput("⚠️ No coupon ID provided");

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id = row[4];
    var count = row[2];
    var remaining = row[7];
    var slot = row[3];
    var name = row[0];


    if (slot instanceof Date) {
        slot = Utilities.formatDate(slot, Session.getScriptTimeZone(), "hh:mm a");
    }

    if (id == couponID) {
      if (remaining > 0) {
        sheet.getRange(i+1, 8).setValue(remaining - 1);
        return ContentService.createTextOutput(
         "✅" + name + "'s Coupon verified!\nTime Slot: " + slot +
          "\nRemaining: " + (remaining - 1) + " / " + count
        );
      } else {
        return ContentService.createTextOutput("❌ Coupon already used up!");
      }
    }
  }

  return ContentService.createTextOutput("❌ Invalid Coupon ID");
}


function generateCoupons() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Coupons");
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var couponId = row[4]; // CouponID column E
    var email = row[1];
    
    if (!couponId && email) {
      // Generate unique CouponID
      couponId = Utilities.getUuid().slice(0,8);
      sheet.getRange(i+1, 5).setValue(couponId);
      
      // Set Remaining = Count
      sheet.getRange(i+1, 8).setValue(row[2]);
      
      // QR = just the CouponID
      var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" 
                  + encodeURIComponent(couponId);
      sheet.getRange(i+1, 6).setFormula('=IMAGE("' + qrUrl + '")');
      
      // Mail Status = Not Sent
      sheet.getRange(i+1, 7).setValue("Not Sent");
    }
  }
}


function sendCoupons() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Coupons");
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var name = row[0];
    var email = row[1];
    var count = row[2];
    var slot = row[3];
    var couponId = row[4]; // Column E
    var status = row[6];   // Mail Status
    
    if (email && couponId && status !== "Sent") {
      // Format slot properly if it's a Date object
      if (slot instanceof Date) {
        slot = Utilities.formatDate(slot, Session.getScriptTimeZone(), "hh:mm a");
      }
      
      // QR URL only uses CouponID
      var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" 
                  + encodeURIComponent(couponId);
      var qrBlob = UrlFetchApp.fetch(qrUrl).getBlob().setName("coupon.png");
      
      var subject = "Happy Onam! 🎉 Your Food Coupon";
      var body = 
        "Dear " + name + ",\n\n" +
        "Wishing you a very Happy Onam.\n\n" +
        "Your food coupon for the event has been attached in this mail.\n\n" +
        "Please present the QR code to the volunteers at Community Center.\n" +
        "Your time slot is: " + slot + "\n\n" +
        "Your coupon can be scanned a maximum of " + count + " times, after which it will expire.\n\n" +
        "Warm Regards,\nOnam Organizing Committee";
      
      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: body,
        attachments: [qrBlob]
      });
      
      // Update Mail Status to "Sent"
      sheet.getRange(i+1, 7).setValue("Sent");
    }
  }
}