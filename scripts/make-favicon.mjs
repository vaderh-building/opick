import { createCanvas } from 'canvas';
import fs from 'fs';

// 32x32 favicon
const fav = createCanvas(32, 32);
const fCtx = fav.getContext('2d');
fCtx.font = 'italic 28px Georgia, serif';
fCtx.fillStyle = '#000000';
fCtx.textAlign = 'center';
fCtx.textBaseline = 'middle';
fCtx.fillText('O', 16, 17);
fs.writeFileSync('frontend/public/favicon.png', fav.toBuffer('image/png'));
console.log('Favicon 32x32 saved');

// 180x180 apple-touch-icon
const apple = createCanvas(180, 180);
const aCtx = apple.getContext('2d');
aCtx.font = 'italic 140px Georgia, serif';
aCtx.fillStyle = '#000000';
aCtx.textAlign = 'center';
aCtx.textBaseline = 'middle';
aCtx.fillText('O', 90, 95);
fs.writeFileSync('frontend/public/apple-touch-icon.png', apple.toBuffer('image/png'));
console.log('Apple touch icon 180x180 saved');
