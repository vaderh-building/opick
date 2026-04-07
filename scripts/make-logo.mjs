import { createCanvas } from 'canvas';
import fs from 'fs';

const canvas = createCanvas(360, 180);
const ctx = canvas.getContext('2d');

ctx.font = 'italic 120px Georgia, "Times New Roman", serif';
ctx.fillStyle = '#000000';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('O', 180, 95);

const buf = canvas.toBuffer('image/png');
fs.writeFileSync('frontend/public/logo-privy.png', buf);
console.log('Logo saved to frontend/public/logo-privy.png');
