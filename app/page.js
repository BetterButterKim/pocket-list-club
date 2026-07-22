"use client";
import { useState, useEffect, useRef, useCallback } from "react";

/* ================= API 호출 ================= */
const api = {
  members: () => fetch("/api/members").then((r) => r.json()),
  addMember: (name) =>
    fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).then((r) => r.json()),
  pockets: () => fetch("/api/pockets").then((r) => r.json()),
  records: () => fetch("/api/records").then((r) => r.json()),
  restoreRecord: (rec) =>
    fetch("/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restore: rec }) }).then((r) => r.json()),
  deleteRecord: (id, memberId) =>
    fetch(`/api/records?id=${id}&memberId=${memberId}`, { method: "DELETE" }).then((r) => r.json()),
  updateRecord: (payload) =>
    fetch("/api/records", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json()),
};

/* ================= 이미지 유틸 ================= */
// 모바일(터치 기기)에서만 공유 시트 사용 — 데스크톱 웹은 항상 바로 다운로드
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgentData) return !!navigator.userAgentData.mobile;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
async function saveImage(url, filename) {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
    if (isMobileDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
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
.board-grid{grid-template-columns:repeat(5,1fr);}
@media(max-width:640px){.board-grid{grid-template-columns:repeat(3,1fr);}}
@media(max-width:420px){.board-grid{grid-template-columns:repeat(2,1fr);}}
@keyframes plc-drop{0%{opacity:0;transform:translateY(-22px) scale(1.06) rotate(var(--tilt,0deg));}60%{opacity:1;transform:translateY(3px) scale(.98) rotate(var(--tilt,0deg));}100%{opacity:1;transform:translateY(0) scale(1) rotate(var(--tilt,0deg));}}
@keyframes plc-stamp{0%{opacity:0;transform:scale(1.7) rotate(calc(var(--tilt,0deg) - 6deg));}55%{opacity:1;transform:scale(.93) rotate(var(--tilt,0deg));}78%{transform:scale(1.04) rotate(var(--tilt,0deg));}100%{opacity:1;transform:scale(1) rotate(var(--tilt,0deg));}}
@keyframes plc-fade{from{opacity:0;}to{opacity:1;}}
.journey-card{animation:plc-drop .5s cubic-bezier(.22,.9,.32,1.15) both;}
.journey-final{animation:plc-stamp .65s cubic-bezier(.25,.9,.3,1.2) both;}
.journey-arrow{animation:plc-fade .35s ease both;}
@media(prefers-reduced-motion:reduce){.journey-card,.journey-final,.journey-arrow{animation:none;}}
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
  const [addingMember,setAddingMember]=useState(false);
  const [newName,setNewName]=useState("");
  const [toast,setToast]=useState("");
  const [confirmBox,setConfirmBox]=useState(null);
  const [viewRec,setViewRec]=useState(null);
  const [me,setMeState]=useState("");
  const [undoRec,setUndoRec]=useState(null);
  const undoTimer=useRef(null);
  const [journeyNum,setJourneyNum]=useState(null);
  const [editRec,setEditRec]=useState(null);
  const [boardSaving,setBoardSaving]=useState(false);
  const boardRef=useRef(null);

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

  // URL의 ?member= 파라미터로 탭 상태를 동기화
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search).get("member");
    if(p) setView(p);
    setMeState(getMe());
    reload();
  },[reload]);
  useEffect(()=>{
    const onPop=()=>{
      const p=new URLSearchParams(window.location.search).get("member");
      setView(p||"all");
    };
    window.addEventListener("popstate",onPop);
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);
  // 30초마다 새 인증 자동 반영 (슬랙에서 올라온 것 포함)
  useEffect(()=>{ const t=setInterval(reload,30000); return ()=>clearInterval(t); },[reload]);

  const changeView=(v)=>{
    setView(v);
    setJourneyNum(null);
    const url=new URL(window.location.href);
    if(v==="all") url.searchParams.delete("member");
    else url.searchParams.set("member",v);
    window.history.replaceState({},"",url);
  };

  const addMember=async()=>{
    const name=newName.trim(); if(!name)return;
    setNewName("");setAddingMember(false);
    const m=await api.addMember(name);
    if(m?.id){ if(!me){setMe(m.id);setMeState(m.id);} say(`${name} 님이 합류했어요!`);}
    reload();
  };
  const doDeleteRecord=async(rec)=>{
    const myId = me || rec.member_id;
    if(!me){ setMe(myId); setMeState(myId); }
    const res = await api.deleteRecord(rec.id, myId);
    if(res?.ok){
      // 되돌리기용으로 잠시 보관 (20초)
      setUndoRec(rec);
      if(undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current=setTimeout(()=>setUndoRec(null),20000);
      reload();
    } else say(res?.error || "삭제하지 못했어요.");
  };

  const saveEditRecord=async(patch)=>{
    const myId = me || patch.member_id;
    if(!me){ setMe(myId); setMeState(myId); }
    const res = await api.updateRecord({ id:patch.id, memberId:myId,
      memo:patch.memo, date:patch.date, time:patch.time, num:patch.num, type:patch.type });
    if(res?.id){
      setEditRec(null);
      setViewRec(null);
      say("인증을 수정했어요 ✏");
      reload();
    } else say(res?.error || "수정하지 못했어요.");
  };

  const undoDelete=useCallback(async()=>{
    if(!undoRec) return;
    const rec=undoRec;
    setUndoRec(null);
    if(undoTimer.current) clearTimeout(undoTimer.current);
    const r=await api.restoreRecord(rec);
    say(r?.id ? "복구했어요! ↩" : "복구하지 못했어요.");
    reload();
  },[undoRec,reload]);

  // Cmd/Ctrl + Z 로 되돌리기
  useEffect(()=>{
    const onKey=(e)=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"&&undoRec){
        e.preventDefault(); undoDelete();
      }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[undoRec,undoDelete]);

  const memberOf=(id)=>members.find(m=>m.id===id);
  const shown=view==="all"?records:records.filter(r=>r.member_id===view);
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
            <p className="t-sub" style={{marginTop:12,fontSize:14}}>포켓메이트들의 시도 및 달성 기록</p>
          </div>
        </div>

        <div style={{marginTop:24,display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
          <button className={view==="all"?"chip-active":"chip"} style={{borderRadius:9999,padding:"6px 16px",fontSize:14,fontWeight:700}}
            onClick={()=>changeView("all")}>전체</button>
          {members.map(m=>(
            <button key={m.id} className={view===m.id?"chip-active":"chip"} style={{borderRadius:9999,padding:"6px 16px",fontSize:14,fontWeight:700}}
              onClick={()=>changeView(m.id)}>
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
            <PocketBoard member={curMember} list={curPockets} records={records.filter(r=>r.member_id===view)}
              onOpen={(n)=>setJourneyNum(n)} boardRef={boardRef}/>
            <div style={{marginTop:12,display:"flex",justifyContent:"center"}}>
              <button disabled={boardSaving} onClick={async()=>{
                  if(!boardRef.current||boardSaving)return;
                  setBoardSaving(true);
                  try{
                    await downloadBoardPng(boardRef.current,`PLC_${curMember.name}_board.png`);
                    say("보드 이미지를 저장했어요! 📥");
                  }catch(e){
                    console.error(e);
                    say("이미지 저장에 실패했어요. 다시 시도해 주세요.");
                  }finally{ setBoardSaving(false); }
                }}
                className="btn-ghost" style={{borderRadius:9999,padding:"8px 20px",fontSize:13,fontWeight:700,opacity:boardSaving?0.6:1}}>
                {boardSaving?"저장 중…":"📥 보드 이미지 저장"}
              </button>
            </div>
          </div>
        )}
      </header>

      {view==="all"&&(
        <main style={{maxWidth:960,margin:"0 auto",padding:"0 20px 96px"}}>
          {loading?(
            <p className="t-sub" style={{textAlign:"center",padding:"64px 0",fontSize:14}}>기록을 불러오는 중…</p>
          ):shown.length===0?(
            <div style={{textAlign:"center",padding:"64px 0"}}>
              <p style={{fontSize:18,fontWeight:700,margin:0}}>아직 인증이 없어요</p>
              <p className="t-sub" style={{marginTop:8,fontSize:14}}>슬랙에서 <b>/시도</b> 또는 <b>/달성</b>으로 첫 인증을 남겨보세요.</p>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16}}>
              {shown.map(r=>(
                <RecordCard key={r.id} rec={r} member={memberOf(r.member_id)} showName={true} isMine={me===r.member_id}
                  onOpen={()=>setViewRec(r)}
                  onDelete={()=>askConfirm("이 인증 기록을 삭제할까요?\n삭제 후 20초 안에는 되돌릴 수 있어요.",()=>doDeleteRecord(r))}/>
              ))}
            </div>
          )}
        </main>
      )}

      {journeyNum!=null&&view!=="all"&&curPockets&&curMember&&(
        <JourneyPoster member={curMember}
          item={curPockets.find(it=>it.num===journeyNum)||{num:journeyNum,title:""}}
          records={records.filter(r=>r.member_id===view&&r.num===journeyNum)}
          onClose={()=>setJourneyNum(null)}
          onOpenRec={(r)=>{setJourneyNum(null);setViewRec(r);}}/>
      )}

      {viewRec&&<Lightbox rec={viewRec} member={memberOf(viewRec.member_id)} onClose={()=>setViewRec(null)}
        onEdit={()=>setEditRec(viewRec)}
        onDelete={()=>askConfirm("이 인증 기록을 삭제할까요?\n삭제 후 20초 안에는 되돌릴 수 있어요.",()=>{setViewRec(null);doDeleteRecord(viewRec);})}/>}

      {editRec&&<EditRecordModal rec={editRec}
        pockets={pockets[editRec.member_id]||emptyPockets(editRec.member_id)}
        onClose={()=>setEditRec(null)} onSave={saveEditRecord}/>}

      {confirmBox&&<ConfirmDialog msg={confirmBox.msg} onNo={()=>setConfirmBox(null)} onYes={()=>{const a=confirmBox.action;setConfirmBox(null);a();}}/>}

      {undoRec ? (
        <div className="toast-bar" style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
          borderRadius:9999,padding:"10px 12px 10px 20px",fontSize:14,zIndex:50,
          display:"flex",alignItems:"center",gap:12,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}>
          <span>인증을 삭제했어요.</span>
          <button onClick={undoDelete}
            style={{background:"#F59A23",color:"#fff",border:"none",cursor:"pointer",
              borderRadius:9999,padding:"6px 14px",fontSize:13,fontWeight:900}}>
            되돌리기 ↩
          </button>
          <button onClick={()=>setUndoRec(null)} className="bare-input"
            style={{color:"#FAF6EF",opacity:0.7,fontSize:16,cursor:"pointer",padding:"0 4px"}}>✕</button>
        </div>
      ) : toast ? (
        <div className="toast-bar" style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",borderRadius:9999,padding:"10px 20px",fontSize:14,zIndex:50}}>{toast}</div>
      ) : null}
    </div>
  );
}

function RecordCard({rec,member,showName,isMine,onDelete,onOpen}) {
  const fname=`PLC_${member?.name||"member"}_${rec.num}_${rec.date}.jpg`;
  const isTry=recType(rec)==="try";
  return (
    <div className="card" style={{borderRadius:16,overflow:"hidden",position:"relative"}}>
      <div style={{position:"relative",cursor:"pointer"}} onClick={onOpen}>
        <img src={rec.image_url} alt="" style={{width:"100%",aspectRatio:"1/1",objectFit:"cover",display:"block"}}/>
        {isTry&&<span style={{position:"absolute",top:8,left:8,fontSize:10,fontWeight:800,background:"rgba(255,255,255,.9)",color:"#c68a12",border:"1px solid #f0d9a8",borderRadius:9999,padding:"2px 8px"}}>시도</span>}
      </div>
      <div style={{padding:"8px 10px"}}>
        {rec.memo&&<Memo text={rec.memo}/>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:rec.memo?4:0}}>
          <span style={{fontSize:10.5,color:"#a08f7d",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {showName&&member?`${member.name} · `:""}#{rec.num} · {rec.date}
          </span>
          <button onClick={onDelete} className="x-btn" title="삭제" style={{fontSize:11,padding:"0 2px",flexShrink:0}}>✕</button>
        </div>
      </div>
    </div>
  );
}

function Lightbox({rec,member,onClose,onEdit,onDelete}) {
  const fname=`PLC_${member?.name||"member"}_${rec.num}_${rec.date}.jpg`;
  return (
    <div className="overlay" onClick={onClose} style={{position:"fixed",inset:0,zIndex:45,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div className="sheet" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:520,maxHeight:"94vh",overflowY:"auto",borderRadius:20,padding:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontWeight:900,fontSize:15}}>{member?`${member.name} · `:""}#{rec.num}{rec.source==="slack"?<span className="t-faint" style={{fontSize:11,fontWeight:400,marginLeft:6}}>슬랙 인증</span>:null}</span>
          <button onClick={onClose} className="bare-input t-sub" style={{fontSize:20,padding:"0 4px",cursor:"pointer"}}>✕</button>
        </div>
        <img src={rec.image_url} alt="" style={{width:"100%",borderRadius:12,display:"block"}}/>
        {rec.memo&&<p className="t-13" style={{marginTop:10,color:"#5b4d43",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{rec.memo}</p>}
        <p className="t-11 t-faint" style={{marginTop:6}}>{rec.date}{rec.time?` ${rec.time}`:""}</p>
        <button onClick={()=>saveImage(rec.image_url,fname)} className="btn-dark" style={{marginTop:12,width:"100%",borderRadius:9999,padding:"12px 0",fontSize:14,fontWeight:900}}>사진 저장 / 공유</button>
        <p className="t-11 t-faint" style={{marginTop:6,textAlign:"center"}}>핸드폰에서는 공유 시트가 열려요 — '이미지 저장'을 누르면 사진첩에 담겨요</p>
        {(onEdit||onDelete)&&(
          <div style={{marginTop:10,display:"flex",justifyContent:"center",gap:8}}>
            {onEdit&&<button onClick={onEdit} className="btn-ghost" style={{borderRadius:9999,padding:"7px 18px",fontSize:13,fontWeight:700}}>✎ 수정</button>}
            {onDelete&&<button onClick={onDelete} className="btn-ghost-danger" style={{borderRadius:9999,padding:"7px 18px",fontSize:13,fontWeight:700}}>삭제</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/* 인증 수정 모달 — 슬랙/웹 어디서 등록한 기록이든 메모·날짜·시간·넘버·타입을 고칠 수 있어요 */
function EditRecordModal({rec,pockets,onClose,onSave}) {
  const [num,setNum]=useState(rec.num);
  const [type,setType]=useState(recType(rec));
  const [date,setDate]=useState(rec.date||"");
  const [time,setTime]=useState(rec.time||"");
  const [memo,setMemo]=useState(rec.memo||"");
  const [saving,setSaving]=useState(false);
  const dirty=num!==rec.num||type!==recType(rec)||date!==(rec.date||"")||time!==(rec.time||"")||memo!==(rec.memo||"");

  const submit=async()=>{
    if(!dirty||saving)return;
    if(!date)return;
    setSaving(true);
    await onSave({id:rec.id,member_id:rec.member_id,num,type,date,time:time||null,memo:memo.trim()});
    setSaving(false);
  };

  return (
    <div className="overlay" onClick={onClose} style={{position:"fixed",inset:0,zIndex:48,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div className="sheet" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:420,maxHeight:"92vh",overflowY:"auto",borderRadius:20,padding:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <h2 style={{margin:0,fontSize:17,fontWeight:900}}>인증 수정</h2>
          <button onClick={onClose} className="bare-input t-sub" style={{fontSize:20,padding:"0 4px",cursor:"pointer"}}>✕</button>
        </div>

        <label className="t-sub" style={{display:"block",marginTop:14,fontSize:12,fontWeight:700}}>포켓리스트 넘버</label>
        <select value={num} onChange={e=>setNum(Number(e.target.value))} className="input" style={{marginTop:4,width:"100%",borderRadius:12,padding:"10px 12px",fontSize:14}}>
          {pockets.map(it=>(
            <option key={it.num} value={it.num}>{it.num}. {it.title||"이름 미설정"}</option>
          ))}
        </select>

        <label className="t-sub" style={{display:"block",marginTop:14,fontSize:12,fontWeight:700}}>기록 종류</label>
        <div style={{marginTop:4,display:"flex",gap:6}}>
          <button onClick={()=>setType("try")} className={type==="try"?"chip-active":"chip"} style={{flex:1,borderRadius:9999,padding:"8px 0",fontSize:13,fontWeight:700}}>시도</button>
          <button onClick={()=>setType("done")} className={type==="done"?"chip-active":"chip"} style={{flex:1,borderRadius:9999,padding:"8px 0",fontSize:13,fontWeight:700}}>달성 ✦</button>
        </div>

        <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><label className="t-sub" style={{display:"block",fontSize:12,fontWeight:700}}>날짜</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input" style={{marginTop:4,width:"100%",borderRadius:12,padding:"10px 12px",fontSize:14}}/></div>
          <div><label className="t-sub" style={{display:"block",fontSize:12,fontWeight:700}}>시간 (선택)</label>
            <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="input" style={{marginTop:4,width:"100%",borderRadius:12,padding:"10px 12px",fontSize:14}}/></div>
        </div>

        <label className="t-sub" style={{display:"block",marginTop:14,fontSize:12,fontWeight:700}}>한 줄 메모</label>
        <input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="오늘의 한 마디" className="input" style={{marginTop:4,width:"100%",borderRadius:12,padding:"10px 12px",fontSize:14}}/>

        <button onClick={submit} disabled={!dirty||saving} className={dirty?"btn-dark":"btn-muted"} style={{marginTop:18,width:"100%",borderRadius:9999,padding:"12px 0",fontSize:14,fontWeight:900,opacity:saving?0.6:1}}>
          {saving?"저장하는 중…":"수정 저장"}
        </button>
        <p className="t-11 t-faint" style={{marginTop:8,textAlign:"center"}}>사진에 새겨진 번호·날짜 문구는 바뀌지 않아요 (사진을 바꾸려면 삭제 후 다시 인증)</p>
      </div>
    </div>
  );
}

/* ================= 포켓 보드 (수집 카드) ================= */
const T_START=new Date(2026,6,25);   // 2026-07-25 (토)
const T_END=new Date(2026,10,1);     // 2026-11-01 (일)
function dayLabel(){
  const today=new Date();today.setHours(0,0,0,0);
  const total=Math.round((T_END-T_START)/864e5)+1;
  const n=Math.floor((today-T_START)/864e5)+1;
  if(n<1)return{txt:`D-${1-n}`,total};
  if(n>total)return{txt:"FINISHED",total};
  return{txt:`DAY ${n} / ${total}`,total};
}
const recType=(r)=>r.type||"done";
const recSortAsc=(a,b)=>{
  const ka=`${a.date||""} ${a.time||""}`, kb=`${b.date||""} ${b.time||""}`;
  if(ka!==kb)return ka<kb?-1:1;
  return (a.created_at||"")<(b.created_at||"")?-1:1;
};

function Seal({size=44}){
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} aria-hidden="true">
      <path d="M30 2 L35 8 L43 5 L45 13 L53 13 L52 21 L59 25 L54 32 L58 39 L50 42 L50 50 L42 49 L38 56 L30 51 L22 56 L18 49 L10 50 L10 42 L2 39 L6 32 L1 25 L8 21 L7 13 L15 13 L17 5 L25 8 Z" fill="#D9A441"/>
      <circle cx="30" cy="29" r="16" fill="none" stroke="#a87c22" strokeWidth="1.2"/>
      <text x="30" y="26" fontSize="8.5" fontWeight="900" fill="#5c4310" textAnchor="middle" fontFamily="Georgia,serif">DONE</text>
      <text x="30" y="36" fontSize="6" fill="#7a5c1c" textAnchor="middle">100 PLC</text>
    </svg>
  );
}

function PocketBoard({member,list,records,onOpen,boardRef}) {
  const day=dayLabel();
  const byNum={};
  records.slice().sort(recSortAsc).forEach(r=>{(byNum[r.num]=byNum[r.num]||[]).push(r);});
  const doneN=list.filter(it=>(byNum[it.num]||[]).some(r=>recType(r)==="done")).length;
  const tryN=records.filter(r=>recType(r)==="try").length;
  const enName=`${(member?.name||"").toUpperCase()}'S POCKET`;

  return (
    <div ref={boardRef} style={{background:"#fffdf8",border:"1px solid #eadfd0",borderRadius:24,
      padding:"30px 26px 22px",position:"relative",overflow:"hidden",
      boxShadow:"0 10px 40px rgba(69,55,48,.07)"}}>
      <div style={{position:"absolute",inset:10,border:"1.5px dashed #e8dcc8",borderRadius:16,pointerEvents:"none"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:8,position:"relative",zIndex:1,padding:"0 4px"}}>
        <div className="slab" style={{fontSize:21,letterSpacing:1}}>
          {enName}<span style={{fontSize:12,color:"#a08f7d",fontWeight:400,letterSpacing:2,marginLeft:8,fontFamily:'"Noto Sans KR",sans-serif'}}>{member?.name}의 포켓</span>
        </div>
        <div style={{fontSize:12,color:"#8a7a6d",fontWeight:700,letterSpacing:2}}>
          {day.txt.startsWith("DAY")?(<>DAY <b style={{color:"#F59A23",fontSize:16}}>{day.txt.split(" ")[1]}</b> / {day.total}</>):day.txt}
        </div>
      </div>
      <div style={{display:"flex",gap:18,margin:"10px 4px 20px",position:"relative",zIndex:1}}>
        <span style={{fontSize:11.5,color:"#8a7a6d"}}><b style={{fontSize:15,color:"#453730",marginRight:2}}>{doneN}</b>달성</span>
        <span style={{fontSize:11.5,color:"#8a7a6d"}}><b style={{fontSize:15,color:"#453730",marginRight:2}}>{tryN}</b>번의 시도</span>
        <span style={{fontSize:11.5,color:"#8a7a6d"}}><b style={{fontSize:15,color:"#453730",marginRight:2}}>{10-doneN}</b>남은 포켓</span>
      </div>
      <div className="board-grid" style={{display:"grid",gap:13,position:"relative",zIndex:1}}>
        {list.map(it=>{
          const recs=byNum[it.num]||[];
          const isDone=recs.some(r=>recType(r)==="done");
          const tries=recs.filter(r=>recType(r)==="try").length;
          if(recs.length===0){
            return (
              <button key={it.num} onClick={()=>onOpen(it.num)}
                style={{aspectRatio:"3/4",borderRadius:14,background:"transparent",border:"1.5px dashed #d9cbbd",
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",padding:6}}>
                <span className="slab" style={{fontSize:26,color:"#e5dac6"}}>{it.num}</span>
                <span style={{fontSize:10,color:"#c9bba6",letterSpacing:1}}>COMING SOON</span>
                {it.title&&<span style={{fontSize:9.5,color:"#c9bba6",lineHeight:1.3,textAlign:"center",
                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{it.title}</span>}
              </button>
            );
          }
          const latest=recs[recs.length-1];
          const behind=recs.slice(-3,-1).reverse();
          return (
            <button key={it.num} onClick={()=>onOpen(it.num)}
              style={{aspectRatio:"3/4",borderRadius:14,cursor:"pointer",textAlign:"left",
                background:isDone?"#453730":"#fff",border:`1px solid ${isDone?"#453730":"#eadfd0"}`,
                boxShadow:isDone?"0 6px 18px rgba(69,55,48,.22)":"0 3px 10px rgba(69,55,48,.06)",
                padding:"9px 9px 6px",position:"relative"}}>
              <span style={{position:"relative",display:"block",width:"100%",aspectRatio:"1/1"}}>
                {behind.map((r,i)=>(
                  <span key={r.id} style={{position:"absolute",inset:0,background:"#fff",border:"1px solid #eee4d4",borderRadius:4,
                    padding:"5px 5px 0",boxShadow:"0 2px 6px rgba(69,55,48,.10)",
                    transform:i===0?"rotate(-5deg) translateY(-3px)":"rotate(4deg) translateY(-1px)"}}>
                    <img src={r.image_url} alt="" style={{width:"100%",aspectRatio:"1/1",objectFit:"contain",borderRadius:2,display:"block"}}/>
                  </span>
                ))}
                <span style={{position:"absolute",inset:0,background:"#fff",border:"1px solid #eee4d4",borderRadius:4,
                  padding:"5px 5px 0",boxShadow:"0 2px 6px rgba(69,55,48,.10)"}}>
                  <img src={latest.image_url} alt="" style={{width:"100%",aspectRatio:"1/1",objectFit:"contain",borderRadius:2,display:"block"}}/>
                </span>
                {isDone&&<span style={{position:"absolute",right:-7,bottom:-7,zIndex:5,filter:"drop-shadow(0 2px 4px rgba(0,0,0,.25))"}}><Seal size={44}/></span>}
              </span>
              <span style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                <span className="slab" style={{fontSize:12,color:isDone?"#D9A441":"#F59A23"}}>No.{it.num}</span>
                {isDone
                  ?<span style={{fontSize:9.5,fontWeight:800,background:"#D9A441",color:"#3d2e10",borderRadius:9999,padding:"2px 8px",letterSpacing:.5}}>DONE</span>
                  :<span style={{fontSize:9.5,fontWeight:800,background:"#fdf3e3",color:"#c68a12",border:"1px solid #f0d9a8",borderRadius:9999,padding:"2px 8px"}}>시도 ×{tries}</span>}
              </span>
              <span style={{display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",
                fontSize:10,color:isDone?"#e8dfd2":"#5b4d43",lineHeight:1.35,marginTop:5,minHeight:27}}>{it.title||"이름 미설정"}</span>
            </button>
          );
        })}
      </div>
      <div style={{marginTop:22,textAlign:"center",position:"relative",zIndex:1}}>
        <div style={{fontSize:10.5,color:"#b6a795",letterSpacing:3,fontWeight:700}}>100 POCKET LIST CLUB · 2026.07.25 — 11.01</div>
        <div style={{fontSize:11,color:"#F59A23",fontWeight:700,marginTop:3}}>#100일포켓리스트 #{member?.name}의포켓</div>
      </div>
    </div>
  );
}

/* 보드 → PNG 저장 (html2canvas로 DOM을 그대로 캡쳐) */
async function downloadBoardPng(boardEl,filename){
  const html2canvas=(await import("html2canvas")).default;
  const canvas=await html2canvas(boardEl,{
    backgroundColor:"#fffdf8",
    scale:2,
    useCORS:true,
    imageTimeout:15000,
  });
  const blob=await new Promise((resolve,reject)=>{
    canvas.toBlob((b)=>b?resolve(b):reject(new Error("이미지 변환에 실패했어요")),"image/png");
  });
  const file=new File([blob],filename,{type:"image/png"});
  if(isMobileDevice()&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file]}); return; }
    catch(e){ if(e && e.name==="AbortError") return; }
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.download=filename; a.href=url; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

/* ================= 여정 포스터 (가로 스네이크 맵) ================= */
function JourneyPoster({member,item,records,onClose,onOpenRec}){
  const recs=records.slice().sort(recSortAsc);
  const tries=recs.filter(r=>recType(r)==="try");
  const doneRec=recs.filter(r=>recType(r)==="done").slice(-1)[0]||null;
  const steps=[...recs.filter(r=>r!==doneRec),...(doneRec?[doneRec]:[])];
  const [perRow,setPerRow]=useState(5);
  useEffect(()=>{
    const calc=()=>setPerRow(window.innerWidth<520?2:window.innerWidth<760?3:5);
    calc();window.addEventListener("resize",calc);
    return ()=>window.removeEventListener("resize",calc);
  },[]);
  const rows=[];
  for(let i=0;i<steps.length;i+=perRow)rows.push(steps.slice(i,i+perRow));
  const tapeColors=["rgba(245,205,120,.65)","rgba(180,210,235,.6)","rgba(235,180,195,.55)"];
  const tilts=[-3.5,2.8,-2.4,3.4,-3,2.4]; // 좌/우 교차 기울기 (폴라로이드 느낌)
  const STAG=0.13; // 카드 하나당 등장 간격(초)
  let tryIdx=0;

  return (
    <div className="overlay" onClick={onClose} style={{position:"fixed",inset:0,zIndex:46,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 12px",overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:840,background:"#fffdf8",borderRadius:20,overflow:"hidden",boxShadow:"0 30px 80px rgba(0,0,0,.35)",position:"relative"}}>
        <button onClick={onClose} aria-label="닫기"
          style={{position:"absolute",top:10,right:10,zIndex:10,background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",
            width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:13,color:"#fff"}}>✕</button>
        <div style={{background:"#453730",color:"#FAF6EF",padding:"16px 22px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:"#b6a795",fontWeight:700}}>100 POCKET LIST CLUB · POCKET JOURNEY</div>
            <div style={{fontSize:16,fontWeight:800,marginTop:4,lineHeight:1.3}}>
              <span className="slab" style={{color:"#F59A23",marginRight:6}}>No.{item.num}</span>{item.title||"이름 미설정"}
            </div>
          </div>
          <div style={{fontSize:11,color:"#cbbfae",display:"flex",gap:12,alignItems:"center"}}>
            <span>by <b style={{color:"#FAF6EF"}}>{member?.name}</b></span>
            <span>시도 <b style={{color:"#FAF6EF"}}>{tries.length}</b></span>
            {doneRec
              ?<span style={{color:"#F59A23",fontWeight:800}}>✦ 달성 {doneRec.date}</span>
              :<span>도전 중</span>}
          </div>
        </div>
        <div style={{padding:"24px 26px 18px"}}>
          {steps.length===0?(
            <div style={{textAlign:"center",padding:"34px 10px",color:"#b6a795",fontSize:13}}>
              아직 기록이 없어요.<br/>슬랙에서 <b style={{color:"#c68a12"}}>/시도</b> 로 첫 폴라로이드를 붙여보세요!
            </div>
          ):rows.map((row,ri)=>{
            const rev=ri%2===1;
            return (
              <div key={ri} style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14,flexDirection:rev?"row-reverse":"row",position:"relative"}}>
                {row.map((r,ci)=>{
                  const idx=ri*perRow+ci;
                  const isFinal=r===doneRec;
                  const stepNo=isFinal?null:(++tryIdx);
                  const tilt=isFinal?-2:tilts[idx%tilts.length];
                  return (
                    <span key={r.id} style={{display:"flex",alignItems:"center",gap:14,flexDirection:rev?"row-reverse":"row"}}>
                      <span onClick={()=>onOpenRec(r)} className={isFinal?"journey-final":"journey-card"}
                        style={{width:124,flexShrink:0,cursor:"pointer",display:"block",position:"relative",
                        background:isFinal?"#6b5443":"#fff",border:`1px solid ${isFinal?"#544236":"#eee4d4"}`,borderRadius:4,
                        padding:isFinal?"20px 6px 7px":"6px 6px 7px",boxShadow:"0 3px 10px rgba(69,55,48,.12)",
                        "--tilt":`${tilt}deg`,transform:"rotate(var(--tilt))",
                        animationDelay:`${idx*STAG+(isFinal?0.35:0)}s`}}>
                        {isFinal?(<>
                          <span style={{position:"absolute",top:0,left:0,right:0,height:20,overflow:"hidden",zIndex:1}}>
                            <span style={{position:"absolute",left:"-6%",right:"-6%",top:-26,height:44,background:"#544236",clipPath:"polygon(0 0,100% 0,50% 100%)"}}/>
                          </span>
                          <span style={{position:"absolute",right:-11,top:-11,zIndex:5,filter:"drop-shadow(0 2px 5px rgba(0,0,0,.3))"}}><Seal size={44}/></span>
                        </>):(
                          <span style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%) rotate(-1deg)",width:46,height:15,background:tapeColors[idx%3],zIndex:2}}/>
                        )}
                        <img src={r.image_url} alt="" style={{width:"100%",aspectRatio:"1/1",objectFit:"cover",borderRadius:2,display:"block",
                          border:isFinal?"2px solid #D9A441":"none"}}/>
                        <span style={{display:"block",fontSize:9.5,color:isFinal?"#f0e6d8":"#5b4d43",marginTop:5,lineHeight:1.35,
                          whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.memo||" "}</span>
                        <span style={{display:"flex",justifyContent:"space-between",fontSize:8.5,color:isFinal?"#c9b8a4":"#a08f7d",marginTop:2}}>
                          <span>{r.date}</span>
                          <span style={{fontWeight:900,color:isFinal?"#D9A441":"#F59A23",letterSpacing:1}}>
                            {isFinal?"ACHIEVED":`TRY ${String(stepNo).padStart(2,"0")}`}
                          </span>
                        </span>
                      </span>
                      {ci<row.length-1&&<span className="journey-arrow" style={{color:"#d9cbbd",fontSize:15,fontWeight:900,marginTop:-16,animationDelay:`${(idx+1)*STAG}s`}}>{rev?"‹":"›"}</span>}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

