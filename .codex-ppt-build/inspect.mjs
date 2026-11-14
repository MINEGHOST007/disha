import fs from 'node:fs/promises';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const source = 'C:/Users/ssank/Desktop/disha/data/DISHA_Final_Submission-1-3720a5.pptx';
const p = await PresentationFile.importPptx(await FileBlob.load(source));
console.log('slides',p.slides.items.length);
const layout=await p.inspect({kind:'slide,textbox,shape,image,table,chart,notes,layout',maxChars:30000});
await fs.writeFile('inspect.ndjson',layout.ndjson,'utf8');
const montage=await p.export({format:'webp',montage:true,scale:0.45});
await fs.writeFile('source-montage.webp',new Uint8Array(await montage.arrayBuffer()));
for(let i=0;i<p.slides.items.length;i++){
 const blob=await p.export({slide:p.slides.items[i],format:'png',scale:1});
 await fs.writeFile(`source-slide-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await blob.arrayBuffer()));
}
