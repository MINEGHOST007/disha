import fs from 'node:fs/promises';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const p=await PresentationFile.importPptx(await FileBlob.load('C:/Users/ssank/Desktop/disha/data/DISHA_Final_Submission-1-3720a5.pptx'));
const out=await p.inspect({kind:'slide,textbox,shape,image,table,chart,notes,layout',maxChars:250000});
await fs.writeFile('C:/Users/ssank/Desktop/disha/.codex-ppt-build/inspect-full.ndjson',out.ndjson,'utf8');
console.log('chars',out.ndjson.length);
