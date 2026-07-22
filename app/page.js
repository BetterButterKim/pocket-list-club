"use client";
import { useState, useEffect, useRef, useCallback } from "react";

/* ================= API 호출 ================= */
const api = {
  members: () => fetch("/api/members").then((r) => r.json()),
  addMember: (name) =>
    fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).then((r) => r.json()),
  renameMember: (id, name) =>
    fetch("/api/members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }) }).then((r) => r.json()),
  deleteMember: (id) => fetch(`/api/members?id=${id}`, { method: "DELETE" }).then((r) => r.json()),
  pockets: () => fetch("/api/pockets").then((r) => r.json()),
  savePocket: (memberId, num, title, description) =>
    fetch("/api/pockets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, num, title, description }) }).then((r) => r.json()),
  records: () => fetch("/api/records").then((r) => r.json()),
  addRecord: (payload) =>
    fetch("/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json()),
  deleteRecord: (id, memberId) =>
    fetch(`/api/records?id=${id}&memberId=${memberId}`, { method: "DELETE" }).then((r) => r.json()),
};

/* ================= 이미지 유틸 ================= */
function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => res(e.target.result);
    reader.onerror = () => rej(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}
function loadImageFromDataUrl(dataUrl) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("이미지 로드 실패"));
    img.src = dataUrl;
  });
}
async function convertHeicToBase64(file) {
  if (!window.heic2any) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
      s.onload = res; s.onerror = () => rej(new Error("라이브러리 로드 실패"));
      document.head.appendChild(s);
    });
  }
  let out = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  if (Array.isArray(out)) out = out[0];
  return readFileAsBase64(out);
}
async function fileToImage(file) {
  const isHeic =
    file.type === "image/heic" || file.type === "image/heif" ||
    file.name?.toLowerCase().endsWith(".heic") || file.name?.toLowerCase().endsWith(".heif");
  const dataUrl = isHeic ? await convertHeicToBase64(file) : await readFileAsBase64(file);
  const img = await loadImageFromDataUrl(dataUrl);
  return { img, dataUrl };
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*?);/) || [])[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
async function saveImage(url, filename) {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(objUrl);
  } catch (e) {
    if (e && e.name === "AbortError") return;
    window.open(url, "_blank");
  }
}

/* 클라이언트 크롭 프리뷰용 합성 (저장은 서버에서 다시 합성) */
function formatDateDots(d) { if (!d) return ""; const [y,m,dd]=d.split("-"); return `${y}.${m}.${dd}`; }
function wrapText(ctx, text, maxW, maxLines) {
  const lines=[]; let cur="";
  for (const ch of text) {
    if (ctx.measureText(cur+ch).width>maxW && cur){lines.push(cur);cur=ch;if(lines.length===maxLines)break;}
    else cur+=ch;
  }
  if(lines.length<maxLines&&cur)lines.push(cur);
  if(lines.length===maxLines&&cur&&lines[maxLines-1]!==cur)lines[maxLines-1]=lines[maxLines-1].slice(0,-1)+"…";
  return lines;
}
async function previewCompose(img, {num,title,dateStr,timeStr,zoom=1,offX=0.5,offY=0.5}, S=540) {
  const k=S/1080;
  const c=document.createElement("canvas"); c.width=S;c.height=S;
  const x=c.getContext("2d");
  const m=Math.max(S/img.width,S/img.height)*zoom;
  const w=img.width*m,h=img.height*m;
  x.drawImage(img,-(w-S)*offX,-(h-S)*offY,w,h);
  x.shadowColor="rgba(0,0,0,0.5)";x.shadowBlur=12*k;x.shadowOffsetY=2*k;
  const label=`${num}. ${title||""}`.trim();
  const maxW=S-100*k;
  const TF=(s)=>`${Math.round(s)}px "Black Han Sans","Noto Sans KR",sans-serif`;
  x.fillStyle="#fff";x.textBaseline="top";x.textAlign="left";
  x.font=TF(100*k);
  const w100=x.measureText(label).width||1;
  let size=Math.min(104*k,(100*k*maxW)/w100); let lines=[label];
  if(size<48*k){let chosen=null,cs=30*k;for(let s=64*k;s>=30*k;s-=2*k){x.font=TF(s);const ls=wrapText(x,label,maxW,10);if(ls.length<=3){chosen=ls;cs=s;break;}}if(!chosen){x.font=TF(30*k);chosen=wrapText(x,label,maxW,3);}lines=chosen;size=cs;}
  x.font=TF(size);
  lines.forEach((ln,i)=>x.fillText(ln,50*k,44*k+i*size*1.18));
  x.fillStyle="#fff";x.textBaseline="alphabetic";
  x.font=`${Math.round(34*k)}px "Alfa Slab One",serif`;
  x.textAlign="left";
  x.fillText(formatDateDots(dateStr)+(timeStr?` ${timeStr}`:""),50*k,S-46*k);
  x.textAlign="right";
  x.fillText("100 POCKET LIST CLUB",S-46*k,S-46*k);
  return c.toDataURL("image/jpeg",0.85);
}

const emptyPockets = (mid) => Array.from({length:10},(_,i)=>({member_id:mid,num:i+1,title:"",description:""}));

/* ================= 로컬 신원 (본인 확인용) ================= */
const ME_KEY = "plc-me-id";
function getMe() { try { return localStorage.getItem(ME_KEY) || ""; } catch { return ""; } }
function setMe(id) { try { localStorage.setItem(ME_KEY, id); } catch {} }

/* ================= CSS ================= */
const CSS = `
.plc,.plc *{font-family:"Noto Sans KR","Apple SD Gothic Neo",sans-serif;box-sizing:border-box;}
.plc{min-height:100vh;background:#FAF6EF;color:#453730;}
.slab{font-family:"Alfa Slab One",serif !important;}
.t-sub{color:#8a7a6d;}.t-faint{color:#b6a795;}.t-orange{color:#F59A23;}.t-danger{color:#c0392b;}
.t-11{font-size:11px;}.t-13{font-size:13px;}
.btn-dark{background:#453730;color:#FAF6EF;border:none;cursor:pointer;transition:background .15s;}
.btn-dark:hover{background:#5b4a3f;}
.btn-orange{background:#F59A23;color:#fff;border:none;cursor:pointer;}
.btn-muted{background:#f0e8da;color:#c3b4a4;border:none;cursor:default;}
.btn-ghost{background:#fff;border:1px solid #e2d6c8;color:#8a7a6d;cursor:pointer;transition:all .15s;}
.btn-ghost:hover{border-color:#F59A23;color:#F59A23;}
.btn-ghost-danger{background:#fff;border:1px solid #e2d6c8;color:#8a7a6d;cursor:pointer;transition:all .15s;}
.btn-ghost-danger:hover{border-color:#c0392b;color:#c0392b;}
.chip{background:#fff;border:1px solid #e2d6c8;color:#5b4d43;cursor:pointer;transition:all .15s;}
.chip:hover{border-color:#F59A23;}
.chip-active{background:#E2D4BE;border:1px solid #b9a88f;color:#453730;}
.chip-dashed{background:transparent;border:1px dashed #c9b8a8;color:#8a7a6d;cursor:pointer;}
.pill{background:#F1E9DD;color:#5b4d43;border:1px solid transparent;cursor:pointer;min-width:38px;}
.pill:hover{background:#e6dbc9;}
.pill-active{background:#E2D4BE;color:#453730;border:1px solid #b9a88f;}
.card{background:#fff;border:1px solid #eadfd0;}
.input{border:1px solid #e2d6c8;background:#fff;color:#453730;outline:none;}
.input:focus{border-color:#F59A23;}
.bare-input{background:transparent;border:none;outline:none;color:#453730;}
.soft-area{background:#FAF6EF;border:none;outline:none;color:#453730;resize:vertical;}
.dropzone{border:2px dashed #d9cbbd;background:#fff;cursor:pointer;transition:all .15s;}
.dropzone.drag{border-color:#F59A23;background:#fdf3e3;}
.overlay{background:rgba(0,0,0,0.4);}
.sheet{background:#FAF6EF;}
.toast-bar{background:#453730;color:#FAF6EF;}
.x-btn{background:none;border:none;color:#a08f7d;cursor:pointer;}
.x-btn:hover{color:#c0392b;}
.line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.num-choice{text-align:left;overflow:hidden;cursor:pointer;transition:all .15s;background:#fff;border:1px solid #e2d6c8;color:#5b4d43;}
.num-choice:hover{border-color:#F59A23;}
.num-choice.on{background:#E2D4BE;border:1px solid #b9a88f;color:#453730;}
`;

function Logo() {
  return (
    <div style={{position:"relative",display:"inline-block"}}>
      <span style={{position:"absolute",borderRadius:"9999px",background:"#CFE0F2",width:46,height:46,left:-16,top:-8,zIndex:0}}/>
      <span style={{position:"absolute",borderRadius:"9999px",background:"#F9EDBB",width:56,height:56,right:-20,bottom:-12,zIndex:0}}/>
      <h1 className="slab" style={{position:"relative",zIndex:1,color:"#453730",lineHeight:1,margin:0,fontSize:34,letterSpacing:"0.5px"}}>
        100 Pocket List Club
      </h1>
    </div>
  );
}

function Memo({ text }) {
  const [open,setOpen]=useState(false);
  if(!text)return null;
  return <p onClick={()=>setOpen(o=>!o)} className={`t-13 ${open?"":"line-clamp-2"}`}
    style={{color:"#5b4d43",margin:0,cursor:"pointer",lineHeight:1.4}}>{text}</p>;
}

function ConfirmDialog({msg,onYes,onNo}) {
  return (
    <div className="overlay" onClick={onNo} style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div className="sheet" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:360,borderRadius:16,padding:20}}>
        <p style={{margin:0,fontSize:14,whiteSpace:"pre-line"}}>{msg}</p>
        <div style={{marginTop:16,display:"flex",justifyContent:"flex-end",gap:8}}>
          <button onClick={onNo} className="btn-ghost" style={{padding:"8px 16px",fontSize:14,fontWeight:700,borderRadius:9999}}>취소</button>
          <button onClick={onYes} style={{padding:"8px 16px",fontSize:14,fontWeight:700,borderRadius:9999,background:"#c0392b",color:"#fff",border:"none",cursor:"pointer"}}>삭제</button>
        </div>
      </div>
    </div>
  );
}

/* ================= 메인 ================= */
export default function Page() {
  const [members,setMembers]=useState([]);
  const [pockets,setPockets]=useState({});   // {memberId:[{num,title,description}]}
  const [records,setRecords]=useState([]);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState("all");
  const [selNum,setSelNum]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [addingMember,setAddingMember]=useState(false);
  const [newName,setNewName]=useState("");
  const [renaming,setRenaming]=useState(false);
  const [renameVal,setRenameVal]=useState("");
  const [toast,setToast]=useState("");
  const [confirmBox,setConfirmBox]=useState(null);
  const [viewRec,setViewRec]=useState(null);
  const [me,setMeState]=useState("");

  const say=(m)=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const askConfirm=(msg,action)=>setConfirmBox({msg,action});

  const reload = useCallback(async () => {
    const [mem,pk,rec] = await Promise.all([api.members(),api.pockets(),api.records()]);
    setMembers(Array.isArray(mem)?mem:[]);
    const byMember={};
    (Array.isArray(mem)?mem:[]).forEach(m=>byMember[m.id]=emptyPockets(m.id));
    (Array.isArray(pk)?pk:[]).forEach(p=>{
      if(!byMember[p.member_id])byMember[p.member_id]=emptyPockets(p.member_id);
      byMember[p.member_id][p.num-1]={member_id:p.member_id,num:p.num,title:p.title||"",description:p.description||""};
    });
    setPockets(byMember);
    setRecords(Array.isArray(rec)?rec:[]);
    setLoading(false);
  }, []);

  useEffect(()=>{ setMeState(getMe()); reload(); },[reload]);
  // 30초마다 새 인증 자동 반영 (슬랙에서 올라온 것 포함)
  useEffect(()=>{ const t=setInterval(reload,30000); return ()=>clearInterval(t); },[reload]);

  const addMember=async()=>{
    const name=newName.trim(); if(!name)return;
    setNewName("");setAddingMember(false);
    const m=await api.addMember(name);
    if(m?.id){ if(!me){setMe(m.id);setMeState(m.id);} say(`${name} 님이 합류했어요!`);}
    reload();
  };
  const renameMember=async(id)=>{
    const name=renameVal.trim(); if(!name)return;
    setRenaming(false);
    await api.renameMember(id,name); say("이름을 수정했어요."); reload();
  };
  const doDeleteMember=async(id)=>{ await api.deleteMember(id); setView("all");setSelNum(null); say("멤버를 삭제했어요."); reload(); };
  const requestDeleteMember=(id)=>{
    const m=members.find(x=>x.id===id); if(!m)return;
    const cnt=records.filter(r=>r.member_id===id).length;
    askConfirm(`${m.name} 님을 삭제할까요?\n포켓리스트와 인증 기록 ${cnt}개가 함께 삭제되며, 되돌릴 수 없어요.`,()=>doDeleteMember(id));
  };
  const savePocketItem=async(mid,num,title,description)=>{
    await api.savePocket(mid,num,title,description); say("포켓리스트를 저장했어요."); reload();
  };
  const saveRecord=async(payload)=>{
    setShowAdd(false);
    const r=await api.addRecord(payload);
    if(r?.id){ if(!me){setMe(payload.memberId);setMeState(payload.memberId);} say("인증이 등록됐어요! 🎉");}
    else say("저장 중 문제가 생겼어요.");
    reload();
  };
  const doDeleteRecord=async(id,memberId)=>{
    // 본인 확인용 ID가 없으면(다른 기기/첫 방문) 해당 기록의 주인으로 등록
    const myId = me || memberId;
    if(!me){ setMe(myId); setMeState(myId); }
    const res = await api.deleteRecord(id, myId);
    if(res?.ok){ say("삭제했어요."); reload(); }
    else say(res?.error || "삭제하지 못했어요.");
  };

  const memberOf=(id)=>members.find(m=>m.id===id);
  const shown=records.filter(r=>(view==="all"||r.member_id===view)&&(selNum==null||r.num===selNum));
  const curPockets=view!=="all"?(pockets[view]||emptyPockets(view)):null;
  const curMember=view!=="all"?memberOf(view):null;
  const countFor=(mid,num)=>records.filter(r=>r.member_id===mid&&r.num===num).length;

  return (
    <div className="plc">
      <style>{CSS}</style>
      <header style={{padding:"32px 20px 16px",maxWidth:960,margin:"0 auto"}}>
        <div style={{display:"flex",flexWrap:"wrap",alignItems:"flex-end",justifyContent:"space-between",gap:16}}>
          <div>
            <Logo/>
            <p className="t-sub" style={{marginTop:12,fontSize:14}}>100일 · 10명 · 각자 10개의 포켓리스트 — 오늘의 인증을 남겨요.</p>
          </div>
          <button onClick={()=>setShowAdd(true)} className="btn-dark" style={{borderRadius:9999,padding:"10px 20px",fontSize:14,fontWeight:700}}>+ 인증 남기기</button>
        </div>

        <div style={{marginTop:24,display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
          <button className={view==="all"?"chip-active":"chip"} style={{borderRadius:9999,padding:"6px 16px",fontSize:14,fontWeight:700}}
            onClick={()=>{setView("all");setSelNum(null);setRenaming(false);}}>전체</button>
          {members.map(m=>(
            <button key={m.id} className={view===m.id?"chip-active":"chip"} style={{borderRadius:9999,padding:"6px 16px",fontSize:14,fontWeight:700}}
              onClick={()=>{setView(m.id);setSelNum(null);setRenaming(false);}}>
              {m.name}{me===m.id?" (나)":""}
            </button>
          ))}
          {addingMember?(
            <span style={{display:"flex",alignItems:"center",gap:4}}>
              <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMember()} placeholder="이름"
                className="input" style={{width:96,borderRadius:9999,padding:"6px 12px",fontSize:14}}/>
              <button onClick={addMember} className="bare-input t-orange" style={{fontSize:14,fontWeight:700,padding:"0 4px",cursor:"pointer"}}>추가</button>
              <button onClick={()=>setAddingMember(false)} className="bare-input t-sub" style={{fontSize:14,padding:"0 4px",cursor:"pointer"}}>취소</button>
            </span>
          ):(
            <button onClick={()=>setAddingMember(true)} className="chip-dashed" style={{borderRadius:9999,padding:"6px 16px",fontSize:14}}>+ 멤버</button>
          )}
        </div>

        {view!=="all"&&curMember&&(
          <div style={{marginTop:20}}>
            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
              {renaming?(
                <span style={{display:"flex",alignItems:"center",gap:4}}>
                  <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&renameMember(view)}
                    className="input" style={{width:128,borderRadius:8,padding:"6px 12px",fontSize:14}}/>
                  <button onClick={()=>renameMember(view)} className="bare-input t-orange" style={{fontSize:14,fontWeight:700,padding:"0 4px",cursor:"pointer"}}>저장</button>
                  <button onClick={()=>setRenaming(false)} className="bare-input t-sub" style={{fontSize:14,padding:"0 4px",cursor:"pointer"}}>취소</button>
                </span>
              ):(<>
                <span style={{fontSize:16,fontWeight:900}}>{curMember.name}의 포켓</span>
                <button onClick={()=>{setRenameVal(curMember.name);setRenaming(true);}} className="btn-ghost" style={{borderRadius:9999,padding:"4px 12px",fontSize:12}}>✎ 이름 수정</button>
                <button onClick={()=>requestDeleteMember(view)} className="btn-ghost-danger" style={{borderRadius:9999,padding:"4px 12px",fontSize:12}}>멤버 삭제</button>
              </>)}
            </div>
            {/* 포켓리스트 1~10 전체 목록 */}
            <div className="card" style={{marginTop:12,borderRadius:16,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"10px 14px",borderBottom:"1px solid #eadfd0"}}>
                <span style={{fontSize:13,fontWeight:900}}>포켓리스트 10</span>
                <button onClick={()=>setSelNum(null)}
                  className={selNum==null?"btn-muted":"btn-ghost"}
                  style={{borderRadius:9999,padding:"4px 12px",fontSize:11,fontWeight:700}}>
                  전체 인증 보기
                </button>
              </div>
              {curPockets.map(it=>{
                const cnt=countFor(view,it.num);
                const on=selNum===it.num;
                return (
                  <div key={it.num}>
                    <button onClick={()=>setSelNum(on?null:it.num)}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                        padding:"11px 14px",background:on?"#F6EFE2":"transparent",
                        border:"none",borderTop:it.num===1?"none":"1px solid #f2e9db",
                        cursor:"pointer",textAlign:"left"}}>
                      <span className="slab" style={{flexShrink:0,fontSize:14,width:26,
                        color:it.title?"#F59A23":"#c3b4a4"}}>{it.num}.</span>
                      <span style={{flex:1,minWidth:0,fontSize:14,fontWeight:it.title?700:400,
                        color:it.title?"#453730":"#c3b4a4",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {it.title||"아직 정하지 않았어요"}
                      </span>
                      {cnt>0&&(
                        <span style={{flexShrink:0,fontSize:11,fontWeight:700,color:"#8a7a6d",
                          background:"#F1E9DD",borderRadius:9999,padding:"2px 8px"}}>
                          인증 {cnt}
                        </span>
                      )}
                      <span className="t-faint" style={{flexShrink:0,fontSize:11}}>{on?"▲":"▼"}</span>
                    </button>
                    {on&&(
                      <div style={{padding:"0 14px 14px"}}>
                        <PocketEditor key={view+"-"+it.num} item={it}
                          onSave={(t,d)=>savePocketItem(view,it.num,t,d)}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main style={{maxWidth:960,margin:"0 auto",padding:"0 20px 96px"}}>
        {loading?(
          <p className="t-sub" style={{textAlign:"center",padding:"64px 0",fontSize:14}}>기록을 불러오는 중…</p>
        ):shown.length===0?(
          <div style={{textAlign:"center",padding:"64px 0"}}>
            <p style={{fontSize:18,fontWeight:700,margin:0}}>아직 인증이 없어요</p>
            <p className="t-sub" style={{marginTop:8,fontSize:14}}>첫 번째 포켓을 열어볼까요? 오른쪽 위 '+ 인증 남기기'로 시작해요.</p>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16}}>
            {shown.map(r=>(
              <RecordCard key={r.id} rec={r} member={memberOf(r.member_id)} showName={view==="all"} isMine={me===r.member_id}
                onOpen={()=>setViewRec(r)}
                onDelete={()=>askConfirm("이 인증 기록을 삭제할까요?",()=>doDeleteRecord(r.id,r.member_id))}/>
            ))}
          </div>
        )}
      </main>

      {showAdd&&<AddModal members={members} pockets={pockets} me={me}
        onClose={()=>setShowAdd(false)}
        onSaveTitle={(m,n,t)=>{const d=(pockets[m]||[]).find(i=>i.num===n)?.description||"";savePocketItem(m,n,t,d);}}
        onSave={saveRecord}/>}

      {viewRec&&<Lightbox rec={viewRec} member={memberOf(viewRec.member_id)} onClose={()=>setViewRec(null)}/>}

      {confirmBox&&<ConfirmDialog msg={confirmBox.msg} onNo={()=>setConfirmBox(null)} onYes={()=>{const a=confirmBox.action;setConfirmBox(null);a();}}/>}

      {toast&&<div className="toast-bar" style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",borderRadius:9999,padding:"10px 20px",fontSize:14,zIndex:50}}>{toast}</div>}
    </div>
  );
}

function PocketEditor({item,onSave}) {
  const [title,setTitle]=useState(item?.title||"");
  const [desc,setDesc]=useState(item?.description||"");
  useEffect(()=>{setTitle(item?.title||"");setDesc(item?.description||"");},[item?.num]);
  const dirty=title!==(item?.title||"")||desc!==(item?.description||"");
  return (
    <div style={{background:"#FAF6EF",border:"1px solid #eadfd0",borderRadius:12,padding:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span className="slab t-orange" style={{fontSize:16}}>{item.num})</span>
        <input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} placeholder="포켓리스트 이름 (100자 이내)" className="bare-input" style={{flex:1,fontSize:15,fontWeight:700}}/>
        <span className="t-11 t-faint">{title.length}/100</span>
      </div>
      <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="세부 설명 — 왜 이걸 골랐는지, 어떻게 실행할지 적어두면 좋아요." rows={2} className="soft-area" style={{marginTop:8,width:"100%",padding:"10px 12px",borderRadius:8,fontSize:14,background:"#fff"}}/>
      <div style={{marginTop:8,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8}}>
        {!dirty&&(title||desc)&&<span className="t-11 t-faint">저장됨 ✓</span>}
        <button onClick={()=>dirty&&onSave(title,desc)} className={dirty?"btn-orange":"btn-muted"} style={{borderRadius:9999,padding:"6px 16px",fontSize:14,fontWeight:700}}>저장</button>
      </div>
    </div>
  );
}

function RecordCard({rec,member,showName,isMine,onDelete,onOpen}) {
  const fname=`PLC_${member?.name||"member"}_${rec.num}_${rec.date}.jpg`;
  return (
    <div className="card" style={{borderRadius:16,overflow:"hidden"}}>
      <img src={rec.image_url} alt="" onClick={onOpen} style={{width:"100%",aspectRatio:"1/1",objectFit:"cover",display:"block",cursor:"pointer"}}/>
      <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:6}}>
        <Memo text={rec.memo}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11,color:"#a08f7d"}}>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {showName&&member?`${member.name} · `:""}#{rec.num} · {rec.date}{rec.time?` ${rec.time}`:""}{rec.source==="slack"?" · 슬랙":""}
          </span>
          <span style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <button onClick={()=>saveImage(rec.image_url,fname)} className="bare-input t-orange" style={{fontWeight:700,fontSize:11,cursor:"pointer",padding:0}}>저장</button>
            <button onClick={onDelete} className="x-btn" title="삭제" style={{fontSize:12}}>✕</button>
          </span>
        </div>
      </div>
    </div>
  );
}

function Lightbox({rec,member,onClose}) {
  const fname=`PLC_${member?.name||"member"}_${rec.num}_${rec.date}.jpg`;
  return (
    <div className="overlay" onClick={onClose} style={{position:"fixed",inset:0,zIndex:45,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div className="sheet" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:520,maxHeight:"94vh",overflowY:"auto",borderRadius:20,padding:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontWeight:900,fontSize:15}}>{member?`${member.name} · `:""}#{rec.num}</span>
          <button onClick={onClose} className="bare-input t-sub" style={{fontSize:20,padding:"0 4px",cursor:"pointer"}}>✕</button>
        </div>
        <img src={rec.image_url} alt="" style={{width:"100%",borderRadius:12,display:"block"}}/>
        {rec.memo&&<p className="t-13" style={{marginTop:10,color:"#5b4d43",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{rec.memo}</p>}
        <p className="t-11 t-faint" style={{marginTop:6}}>{rec.date}{rec.time?` ${rec.time}`:""}</p>
        <button onClick={()=>saveImage(rec.image_url,fname)} className="btn-dark" style={{marginTop:12,width:"100%",borderRadius:9999,padding:"12px 0",fontSize:14,fontWeight:900}}>사진 저장 / 공유</button>
        <p className="t-11 t-faint" style={{marginTop:6,textAlign:"center"}}>핸드폰에서는 공유 시트가 열려요 — '이미지 저장'을 누르면 사진첩에 담겨요</p>
      </div>
    </div>
  );
}

function AddModal({members,pockets,me,onClose,onSave,onSaveTitle}) {
  const today=new Date();
  const pad=n=>String(n).padStart(2,"0");
  const [mid,setMid]=useState(me||members[0]?.id||"");
  const [num,setNum]=useState(null);
  const [imgEl,setImgEl]=useState(null);
  const [imgData,setImgData]=useState(null);
  const [converting,setConverting]=useState(false);
  const [fileErr,setFileErr]=useState("");
  const [memo,setMemo]=useState("");
  const [date,setDate]=useState(`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`);
  const [time,setTime]=useState("");
  const [preview,setPreview]=useState(null);
  const [drag,setDrag]=useState(false);
  const [err,setErr]=useState("");
  const [saving,setSaving]=useState(false);
  const [zoom,setZoom]=useState(1);
  const [offX,setOffX]=useState(0.5);
  const [offY,setOffY]=useState(0.5);
  const [titleDraft,setTitleDraft]=useState("");
  const inputRef=useRef(null); const cropRef=useRef(null); const dragRef=useRef(null);

  const list=pockets[mid]||emptyPockets(mid);
  const title=list.find(i=>i.num===num)?.title||"";
  useEffect(()=>{setTitleDraft(title);},[mid,num,title]);

  const takeFile=useCallback(async(f)=>{
    if(!f)return;
    setFileErr("");setErr("");setConverting(true);setImgEl(null);setPreview(null);
    try{const {img,dataUrl}=await fileToImage(f);setImgEl(img);setImgData(dataUrl);setZoom(1);setOffX(0.5);setOffY(0.5);}
    catch(e){console.error(e);setFileErr("사진을 불러오지 못했어요. 다른 사진으로 시도해 주세요.");}
    finally{setConverting(false);}
  },[]);

  useEffect(()=>{
    let alive=true;
    if(imgEl&&num&&date){previewCompose(imgEl,{num,title,dateStr:date,timeStr:time,zoom,offX,offY}).then(p=>{if(alive)setPreview(p);}).catch(()=>{if(alive)setPreview(null);});}
    else setPreview(null);
    return ()=>{alive=false;};
  },[imgEl,num,title,date,time,zoom,offX,offY]);

  useEffect(()=>{
    const onPaste=(e)=>{const items=e.clipboardData?.items;if(!items)return;for(const it of items){if(it.type&&it.type.startsWith("image/")){const f=it.getAsFile();if(f){e.preventDefault();takeFile(f);return;}}}};
    window.addEventListener("paste",onPaste); return ()=>window.removeEventListener("paste",onPaste);
  },[takeFile]);

  const startPan=(e)=>{if(!imgEl)return;e.preventDefault();cropRef.current?.setPointerCapture?.(e.pointerId);dragRef.current={x:e.clientX,y:e.clientY,ox:offX,oy:offY};};
  const movePan=(e)=>{const d=dragRef.current;if(!d||!imgEl||!cropRef.current)return;const D=cropRef.current.clientWidth||1;const relW=zoom*Math.max(1,imgEl.width/imgEl.height);const relH=zoom*Math.max(1,imgEl.height/imgEl.width);const ovX=(relW-1)*D,ovY=(relH-1)*D;if(ovX>0.5)setOffX(Math.min(1,Math.max(0,d.ox-(e.clientX-d.x)/ovX)));if(ovY>0.5)setOffY(Math.min(1,Math.max(0,d.oy-(e.clientY-d.y)/ovY)));};
  const endPan=()=>{dragRef.current=null;};

  const submit=async()=>{
    const missing=[];
    if(!mid)missing.push("멤버");if(!num)missing.push("포켓리스트 넘버");if(!imgData)missing.push("사진");if(!date)missing.push("날짜");
    if(missing.length){setErr(`아직 ${missing.join(" · ")} 이(가) 비어 있어요.`);return;}
    setSaving(true);
    try{
      // 서버가 크롭 정보를 반영하도록, 크롭된 프리뷰를 고해상도로 다시 만들어 전송
      const finalData=await previewCompose(imgEl,{num,title,dateStr:date,timeStr:time,zoom,offX,offY},1080);
      // 서버는 이미 합성된 이미지를 그대로 저장 (원본 재합성 대신 크롭 결과 유지)
      await onSave({memberId:mid,num,memo:memo.trim(),date,time:time||null,imageBase64:finalData,preComposed:true});
    }catch(e){console.error(e);setErr("사진 처리 중 문제가 생겼어요. 다시 시도해 주세요.");setSaving(false);}
  };

  return (
    <div className="overlay" onClick={onClose} style={{position:"fixed",inset:0,zIndex:40,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}}>
      <div className="sheet" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",borderRadius:"24px 24px 0 0",padding:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <h2 style={{margin:0,fontSize:18,fontWeight:900}}>인증 남기기</h2>
          <button onClick={onClose} className="bare-input t-sub" style={{fontSize:20,padding:"0 4px",cursor:"pointer"}}>✕</button>
        </div>
        {members.length===0?(
          <p className="t-sub" style={{marginTop:24,fontSize:14}}>먼저 상단에서 멤버를 추가해 주세요.</p>
        ):(<>
          <label className="t-sub" style={{display:"block",marginTop:16,fontSize:12,fontWeight:700}}>누구의 인증인가요?</label>
          <select value={mid} onChange={e=>{setMid(e.target.value);setNum(null);}} className="input" style={{marginTop:4,width:"100%",borderRadius:12,padding:"10px 12px",fontSize:14}}>
            {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <label className="t-sub" style={{display:"block",marginTop:16,fontSize:12,fontWeight:700}}>포켓리스트 넘버</label>
          <div style={{marginTop:4,display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {list.map(it=>(
              <button key={it.num} className={`num-choice${num===it.num?" on":""}`} onClick={()=>{setNum(it.num);setErr("");}} title={it.title||"이름 미설정"}
                style={{display:"flex",alignItems:"center",gap:6,borderRadius:8,padding:"8px 10px"}}>
                <span style={{flexShrink:0,fontSize:14,fontWeight:900}}>{it.num}</span>
                <span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11,color:it.title?"#8a7a6d":"#c3b4a4"}}>{it.title||"이름 미설정"}</span>
              </button>
            ))}
          </div>
          {num&&(
            <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
              <input value={titleDraft} maxLength={100} onChange={e=>setTitleDraft(e.target.value)} placeholder={`${num}번 포켓리스트 이름을 여기서 바로 정할 수 있어요`} className="input" style={{flex:1,borderRadius:8,padding:"8px 10px",fontSize:13}}/>
              <button onClick={()=>onSaveTitle(mid,num,titleDraft.trim())} className={titleDraft.trim()===title?"btn-muted":"btn-orange"} style={{borderRadius:9999,padding:"8px 14px",fontSize:12,fontWeight:700,flexShrink:0}}>저장</button>
            </div>
          )}

          <label className="t-sub" style={{display:"block",marginTop:16,fontSize:12,fontWeight:700}}>사진</label>
          {!imgEl&&(
            <div className={`dropzone${drag?" drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);takeFile(e.dataTransfer.files?.[0]);}} onClick={()=>inputRef.current?.click()}
              style={{marginTop:4,borderRadius:16,padding:16,textAlign:"center",minHeight:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {converting?<p className="t-sub" style={{margin:0,fontSize:14}}>사진 변환 중…</p>:
                <p className="t-sub" style={{margin:0,fontSize:14,lineHeight:1.6}}>사진을 여기로 끌어다 놓거나, 눌러서 선택하세요<br/><span className="t-faint" style={{fontSize:12}}>복사한 이미지는 Ctrl/Cmd + V로 붙여넣을 수 있어요</span></p>}
            </div>
          )}
          {imgEl&&(
            <div style={{marginTop:4}}>
              <div ref={cropRef} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}
                style={{borderRadius:16,overflow:"hidden",touchAction:"none",cursor:"grab",userSelect:"none"}}>
                {preview?<img src={preview} alt="미리보기" draggable={false} style={{width:"100%",display:"block",pointerEvents:"none"}}/>:
                  <div className="card" style={{aspectRatio:"1/1",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:16}}><p className="t-sub" style={{margin:0,fontSize:13}}>넘버와 날짜를 고르면 미리보기가 나타나요</p></div>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                <span className="t-sub" style={{fontSize:12,flexShrink:0}}>확대</span>
                <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))} style={{flex:1}}/>
                <button className="btn-ghost" onClick={()=>{setZoom(1);setOffX(0.5);setOffY(0.5);}} style={{borderRadius:9999,padding:"4px 10px",fontSize:11}}>초기화</button>
                <button className="btn-ghost" onClick={()=>inputRef.current?.click()} style={{borderRadius:9999,padding:"4px 10px",fontSize:11}}>사진 변경</button>
              </div>
              <p className="t-faint" style={{fontSize:11,marginTop:4,marginBottom:0}}>사진을 드래그해서 원하는 위치로 프레임을 조정할 수 있어요</p>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*,.heic,.heif" style={{display:"none"}} onChange={e=>takeFile(e.target.files?.[0])}/>
          {fileErr&&<p className="t-danger" style={{marginTop:4,fontSize:12}}>{fileErr}</p>}

          <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label className="t-sub" style={{display:"block",fontSize:12,fontWeight:700}}>날짜 (필수)</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input" style={{marginTop:4,width:"100%",borderRadius:12,padding:"10px 12px",fontSize:14}}/></div>
            <div><label className="t-sub" style={{display:"block",fontSize:12,fontWeight:700}}>시간 (선택)</label>
              <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="input" style={{marginTop:4,width:"100%",borderRadius:12,padding:"10px 12px",fontSize:14}}/></div>
          </div>

          <label className="t-sub" style={{display:"block",marginTop:16,fontSize:12,fontWeight:700}}>한 줄 메모</label>
          <input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="오늘의 한 마디 (사진에는 들어가지 않아요)" className="input" style={{marginTop:4,width:"100%",borderRadius:12,padding:"10px 12px",fontSize:14}}/>

          <button onClick={submit} disabled={saving} className="btn-dark" style={{marginTop:20,width:"100%",borderRadius:9999,padding:"12px 0",fontSize:14,fontWeight:900,opacity:saving?0.6:1}}>
            {saving?"등록하는 중…":"인증 등록"}
          </button>
          {err&&<p className="t-danger" style={{marginTop:8,textAlign:"center",fontSize:12}}>{err}</p>}
          <p className="t-faint t-11" style={{marginTop:8,textAlign:"center"}}>등록한 기록은 포켓 메이트 모두에게 공개돼요.</p>
        </>)}
      </div>
    </div>
  );
}
