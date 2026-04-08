const fs = require('fs')
const path = require('path')

const logoPath = path.join('public', 'ca-logo.png')
const logoBase64 = fs.readFileSync(logoPath).toString('base64')
const dataUri = 'data:image/png;base64,' + logoBase64
const imgTag = '<img src="' + dataUri + '" style="width:120px;height:auto;display:block;margin:0 auto 4px;" />'

const filePath = path.join('src', 'pages', 'billing', 'BillScreen.js')
let content = fs.readFileSync(filePath, 'utf8')

const oldImgRegex = /<img[^>]*(ca-logo|logo|icon-192)[^>]*\/>/g
content = content.replace(oldImgRegex, imgTag)

fs.writeFileSync(filePath, content, 'utf8')
console.log('Done! Logo embedded successfully.')