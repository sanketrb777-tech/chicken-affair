const fs = require('fs')
const path = require('path')

const logoPath = path.join('public', 'ca-logo.png')
const logoBase64 = fs.readFileSync(logoPath).toString('base64')
const dataUri = 'data:image/png;base64,' + logoBase64

const filePath = path.join('src', 'pages', 'billing', 'BillScreen.js')
let content = fs.readFileSync(filePath, 'utf8')

// Find and replace the entire logo + header section
const logoBlockRegex = /<!-- LOGO \+ HEADER -->[\s\S]*?<div class="divider-solid"><\/div>/
const newLogoBlock = `<!-- LOGO + HEADER -->
      <div class="center" style="margin-bottom:6px">
        <img src="${dataUri}" style="width:120px;height:auto;display:block;margin:0 auto 4px;" />
        <div style="font-size:15px;font-weight:900;letter-spacing:1px">CAFE Chicken Affair</div>
        <div style="font-size:12px;font-weight:600">Gat No. 22, Pawnanagar, Bramhanoli,<br/>Pune-410406</div>
        <div style="font-size:12px;font-weight:600">Contact No +91 9371373732</div>
        <div style="font-size:11px;font-weight:600">
          FSSAI - 11525083000410<br/>
          GSTIN 27AHUPH7967A1ZW
        </div>
      </div>

      <div class="divider-solid"></div>`

content = content.replace(logoBlockRegex, newLogoBlock)
fs.writeFileSync(filePath, content, 'utf8')
console.log('Done! Logo embedded.')