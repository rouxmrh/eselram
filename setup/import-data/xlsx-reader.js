function columnIndex(reference) {
  const letters = String(reference || "").match(/^[A-Z]+/i)?.[0] || "A";
  let result = 0;
  for (const char of letters.toUpperCase()) result = result * 26 + (char.charCodeAt(0) - 64);
  return result - 1;
}
function findEnd(bytes) {
  const minimum = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minimum; i -= 1) {
    if (bytes[i]===0x50 && bytes[i+1]===0x4b && bytes[i+2]===0x05 && bytes[i+3]===0x06) return i;
  }
  return -1;
}
function u16(view, offset) { return view.getUint16(offset, true); }
function u32(view, offset) { return view.getUint32(offset, true); }
async function inflateRaw(data) {
  if (typeof DecompressionStream !== "function") throw new Error("This browser cannot read Excel ZIP files. Use a current browser.");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function readZip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer); const view = new DataView(arrayBuffer); const eocd = findEnd(bytes);
  if (eocd < 0) throw new Error("The selected file is not a valid .xlsx workbook.");
  const entries = new Map(); const count = u16(view, eocd + 10); let offset = u32(view, eocd + 16); const decoder = new TextDecoder();
  for (let i=0;i<count;i+=1) {
    if (u32(view, offset)!==0x02014b50) throw new Error("The Excel file ZIP directory is invalid.");
    const method=u16(view,offset+10), compressedSize=u32(view,offset+20), filenameLength=u16(view,offset+28), extraLength=u16(view,offset+30), commentLength=u16(view,offset+32), localOffset=u32(view,offset+42);
    const name=decoder.decode(bytes.slice(offset+46,offset+46+filenameLength)).replaceAll("\\","/");
    entries.set(name,{method,compressedSize,localOffset}); offset += 46+filenameLength+extraLength+commentLength;
  }
  async function extract(name) {
    const entry=entries.get(name); if(!entry) return null; const local=entry.localOffset;
    if(u32(view,local)!==0x04034b50) throw new Error("The Excel file contains an invalid ZIP entry.");
    const nameLength=u16(view,local+26), extraLength=u16(view,local+28), start=local+30+nameLength+extraLength;
    const compressed=bytes.slice(start,start+entry.compressedSize); if(entry.method===0) return compressed; if(entry.method===8) return inflateRaw(compressed);
    throw new Error("This Excel file uses an unsupported ZIP compression method.");
  }
  return { extract };
}
function normalizeTarget(target) { const value=String(target||"").replace(/^\//,""); return value.startsWith("xl/")?value:`xl/${value.replace(/^\.\//,"")}`; }
function elements(node, localName) { return Array.from(node?.getElementsByTagNameNS?.("*",localName)||[]); }
function firstElement(node, localName) { return elements(node, localName)[0] || null; }
function textFromNode(node) { if(!node) return ""; const ts=elements(node,"t"); return ts.length?ts.map(x=>x.textContent||"").join(""):node.textContent||""; }
function cleanHeader(value) { return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }

export async function readImportWorkbook(file) {
  if (!file || !/\.xlsx$/i.test(file.name||"")) throw new Error("Choose the Eselram .xlsx import template.");
  if (file.size > 15*1024*1024) throw new Error("The Excel file is larger than 15 MB. Split the migration into smaller files.");
  const zip=await readZip(await file.arrayBuffer()); const decoder=new TextDecoder(); const parser=new DOMParser();
  const workbookBytes=await zip.extract("xl/workbook.xml"), relBytes=await zip.extract("xl/_rels/workbook.xml.rels");
  if(!workbookBytes||!relBytes) throw new Error("The Excel workbook structure is incomplete.");
  const workbook=parser.parseFromString(decoder.decode(workbookBytes),"application/xml"); const rels=parser.parseFromString(decoder.decode(relBytes),"application/xml");
  let sharedStrings=[]; const sharedBytes=await zip.extract("xl/sharedStrings.xml");
  if(sharedBytes){const sharedDoc=parser.parseFromString(decoder.decode(sharedBytes),"application/xml"); sharedStrings=elements(sharedDoc,"si").map(textFromNode);}
  const result={};
  for(const sheet of elements(workbook,"sheet")){
    const name=String(sheet.getAttribute("name")||"").trim(); if(!name) continue;
    const relId=sheet.getAttribute("r:id")||sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    const rel=elements(rels,"Relationship").find(item=>item.getAttribute("Id")===relId); const sheetPath=normalizeTarget(rel?.getAttribute("Target")||"");
    const bytes=await zip.extract(sheetPath); if(!bytes) continue; const doc=parser.parseFromString(decoder.decode(bytes),"application/xml"); const rawRows=[];
    for(const row of elements(firstElement(doc,"sheetData"),"row")){
      const values=[]; for(const cell of elements(row,"c")){
        const idx=columnIndex(cell.getAttribute("r")); const type=cell.getAttribute("t")||"n"; let value="";
        if(type==="inlineStr") value=textFromNode(firstElement(cell,"is")); else { const raw=firstElement(cell,"v")?.textContent??""; if(type==="s") value=sharedStrings[Number(raw)]??""; else if(type==="b") value=raw==="1"?"TRUE":"FALSE"; else value=raw; }
        values[idx]=value;
      } rawRows.push(values);
    }
    if(!rawRows.length){result[name]=[]; continue;} const headers=rawRows[0].map(cleanHeader);
    result[name]=rawRows.slice(1).map((values,index)=>{const row={__row:index+2}; headers.forEach((header,col)=>{if(header) row[header]=values[col]??"";}); return row;})
      .filter(row=>Object.entries(row).some(([k,v])=>k!=="__row"&&String(v??"").trim()!==""));
  }
  return result;
}
