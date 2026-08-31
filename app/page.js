"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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

/* ===================== 신규 기능 스위치 =====================
   문제가 생기면 아래 값만 false 로 바꾸면 즉시 원래대로 돌아갑니다.  */
const ALL_BOARD      = true;        // '전체 보드' 탭 추가
const CHALK_BOARD    = true;        // 멤버 포켓 보드를 칠판+압정으로
const SHOW_DEBUG     = false;       // 전체 보드에 '자동 N단 nnpx' 표시
const ALL_BOARD_PASSWORD = process.env.NEXT_PUBLIC_ALL_BOARD_PASSWORD || "PLC100";
const ALL_BOARD_OPEN_AT  = "2026-09-04";   // 이 날짜부터는 암호 없이 열림

/* ================= 로컬 신원 (본인 확인용) ================= */
const ME_KEY = "plc-me-id";
function getMe() { try { return localStorage.getItem(ME_KEY) || ""; } catch { return ""; } }
function setMe(id) { try { localStorage.setItem(ME_KEY, id); } catch {} }

/* ================= CSS ================= */
const CSS = `
.plc,.plc *{font-family:"Noto Sans KR","Apple SD Gothic Neo",sans-serif;box-sizing:border-box;}
.plc{min-height:100vh;background:#FAF6EF;color:#453730;}
.slab{font-family:"Alfa Slab One",serif !important;}
.t-sub{color:#8a7a6d;}.t-faint{color:#b6a795;}.t-orange{color:#FF7900;}.t-danger{color:#c0392b;}
.t-11{font-size:11px;}.t-13{font-size:13px;}
.btn-dark{background:#453730;color:#FAF6EF;border:none;cursor:pointer;transition:background .15s;}
.btn-dark:hover{background:#5b4a3f;}
.btn-orange{background:#FF7900;color:#fff;border:none;cursor:pointer;}
.btn-muted{background:#f0e8da;color:#c3b4a4;border:none;cursor:default;}
.btn-ghost{background:#fff;border:1px solid #e2d6c8;color:#8a7a6d;cursor:pointer;transition:all .15s;}
.btn-ghost:hover{border-color:#FF7900;color:#FF7900;}
.btn-ghost-danger{background:#fff;border:1px solid #e2d6c8;color:#8a7a6d;cursor:pointer;transition:all .15s;}
.btn-ghost-danger:hover{border-color:#c0392b;color:#c0392b;}
.chip{background:#fff;border:1px solid #e2d6c8;color:#5b4d43;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0;}
.chip:hover{border-color:#FF7900;}
.chip-active{background:#E2D4BE;border:1px solid #b9a88f;color:#453730;white-space:nowrap;flex-shrink:0;}
.chip-dashed{background:transparent;border:1px dashed #c9b8a8;color:#8a7a6d;cursor:pointer;}
.pill{background:#F1E9DD;color:#5b4d43;border:1px solid transparent;cursor:pointer;min-width:38px;}
.pill:hover{background:#e6dbc9;}
.pill-active{background:#E2D4BE;color:#453730;border:1px solid #b9a88f;}
.card{background:#fff;border:1px solid #eadfd0;}
.input{border:1px solid #e2d6c8;background:#fff;color:#453730;outline:none;}
.input:focus{border-color:#FF7900;}
.bare-input{background:transparent;border:none;outline:none;color:#453730;}
.soft-area{background:#FAF6EF;border:none;outline:none;color:#453730;resize:vertical;}
.dropzone{border:2px dashed #d9cbbd;background:#fff;cursor:pointer;transition:all .15s;}
.dropzone.drag{border-color:#FF7900;background:#fff2e6;}
.overlay{background:rgba(0,0,0,0.4);}
.sheet{background:#FAF6EF;}
.toast-bar{background:#453730;color:#FAF6EF;}
.x-btn{background:none;border:none;color:#a08f7d;cursor:pointer;}
.x-btn:hover{color:#c0392b;}
.line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.num-choice{text-align:left;overflow:hidden;cursor:pointer;transition:all .15s;background:#fff;border:1px solid #e2d6c8;color:#5b4d43;}
.num-choice:hover{border-color:#FF7900;}
.num-choice.on{background:#E2D4BE;border:1px solid #b9a88f;color:#453730;}
.board-grid{grid-template-columns:repeat(5,1fr);}
@media(max-width:640px){.board-grid{grid-template-columns:repeat(3,1fr);}}
@media(max-width:420px){.board-grid{grid-template-columns:repeat(2,1fr);}}
@keyframes plc-drop{0%{opacity:0;transform:translateY(-22px) scale(1.06) rotate(var(--tilt,0deg));}60%{opacity:1;transform:translateY(3px) scale(.98) rotate(var(--tilt,0deg));}100%{opacity:1;transform:translateY(0) scale(1) rotate(var(--tilt,0deg));}}
@keyframes plc-env-land{0%{opacity:0;transform:translateY(-30px) scale(1.08) rotate(var(--tilt,0deg));}50%{opacity:1;transform:translateY(4px) scale(.97) rotate(var(--tilt,0deg));}70%{transform:translateY(-2px) scale(1.01) rotate(var(--tilt,0deg));}100%{opacity:1;transform:translateY(0) scale(1) rotate(var(--tilt,0deg));}}
@keyframes plc-flap{0%{transform:perspective(200px) rotateX(0deg);opacity:1;}45%{opacity:.5;}100%{transform:perspective(200px) rotateX(-175deg);opacity:0;}}
@keyframes plc-img-pop{0%{opacity:0;transform:translateY(10px) scale(.88);}65%{opacity:1;transform:translateY(-3px) scale(1.04);}100%{opacity:1;transform:translateY(0) scale(1);}}
@keyframes plc-seal-drop{0%{opacity:0;transform:scale(2.8) rotate(-20deg);}55%{opacity:1;transform:scale(.85) rotate(5deg);}75%{transform:scale(1.1) rotate(-2deg);}100%{opacity:1;transform:scale(1) rotate(0deg);}}
@keyframes plc-confetti{0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(0);}10%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1);}65%{opacity:.8;}100%{opacity:0;transform:translate(var(--cx),var(--cy)) rotate(var(--cr)) scale(.2);}}
@keyframes plc-fade{from{opacity:0;}to{opacity:1;}}
.journey-card{animation:plc-drop .5s cubic-bezier(.22,.9,.32,1.15) both;}
.journey-final{animation:plc-env-land .6s cubic-bezier(.22,.9,.32,1.15) both;overflow:visible !important;}
.journey-flap{animation:plc-flap .7s cubic-bezier(.4,.1,.2,1) both;transform-origin:50% 0%;}
.journey-img-pop{animation:plc-img-pop .5s cubic-bezier(.22,.9,.32,1.15) both;}
.journey-seal-pop{animation:plc-seal-drop .5s cubic-bezier(.25,.9,.3,1.2) both;}
.journey-confetti{animation:plc-confetti 1.1s cubic-bezier(.15,.6,.3,1) both;pointer-events:none;}
.journey-arrow{animation:plc-fade .35s ease both;}
@media(prefers-reduced-motion:reduce){.journey-card,.journey-final,.journey-arrow,.journey-flap,.journey-img-pop,.journey-seal-pop{animation:none;}.journey-confetti{display:none;}}
.feed-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;}
@media(max-width:520px){.feed-grid{grid-template-columns:repeat(2,1fr);}}
.rec-card{position:relative;border-radius:8px;overflow:hidden;cursor:pointer;}
.rec-overlay{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;display:flex;justify-content:flex-end;align-items:flex-end;gap:6px;}
.rec-chip{font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border-radius:9999px;padding:2px 8px;flex-shrink:0;}
.rec-memo{font-size:10px;color:rgba(255,255,255,.85);background:rgba(0,0,0,.3);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border-radius:6px;padding:2px 8px;margin-right:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%;}
@media(hover:hover){.rec-overlay{opacity:0;transition:opacity .2s;}.rec-card:hover .rec-overlay{opacity:1;}}
@media(hover:none){.rec-chip{font-size:9px;padding:1px 6px;}.rec-memo{display:none;}}
.main-tabs{display:flex;border-bottom:1px solid #e2d6c8;margin-top:20px;}
.main-tab{flex:1;padding:10px 0;font-size:14px;font-weight:700;background:none;border:none;color:#b6a795;cursor:pointer;position:relative;text-align:center;transition:color .15s;}
.main-tab-on{color:#453730;}
.main-tab-on::after{content:'';position:absolute;bottom:-1px;left:25%;right:25%;height:2px;background:#453730;border-radius:1px;}
.member-pills{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;}
.member-pills::-webkit-scrollbar{display:none;}

/* ===== 칠판 (전체 보드 · 포켓 보드 공용) ===== */
.plc-chalk{position:relative;width:100%;padding:12px;border-radius:20px;overflow:hidden;color:#F2EFE4;
  background:linear-gradient(152deg,#9a7048,#6b492c 38%,#a07a51 62%,#573a24);
  box-shadow:0 14px 34px rgba(69,55,48,.2),inset 0 0 6px rgba(0,0,0,.5);}
.plc-felt{position:absolute;inset:12px;border-radius:11px;
  background:radial-gradient(120% 80% at 24% 14%,rgba(255,255,255,.08),transparent 58%),
    radial-gradient(90% 70% at 76% 86%,rgba(255,255,255,.05),transparent 60%),#2E4F46;
  box-shadow:inset 0 0 40px rgba(0,0,0,.5);}
.plc-felt::after{content:"";position:absolute;inset:0;opacity:.4;mix-blend-mode:screen;
  background-image:radial-gradient(1px 1px at 12% 22%,rgba(255,255,255,.5),transparent),
    radial-gradient(1px 1px at 63% 9%,rgba(255,255,255,.4),transparent),
    radial-gradient(1.3px 1.3px at 85% 47%,rgba(255,255,255,.35),transparent),
    radial-gradient(1px 1px at 33% 70%,rgba(255,255,255,.45),transparent);}
.plc-in{position:relative;z-index:2;padding:22px 22px 18px;}
/* 전체 보드 */
.ab-title{font-family:'Cabin Sketch',cursive;font-weight:700;text-align:center;white-space:nowrap;
  line-height:1;letter-spacing:.01em;text-shadow:0 0 6px rgba(255,255,255,.3);}
.ab-members{text-align:center;color:rgba(242,239,228,.6);letter-spacing:.06em;margin-top:10px;}
.ab-members b{font-weight:400;color:rgba(242,239,228,.88);}
.ab-cols,.ab-cols *{font-family:'Gowun Dodum','Apple SD Gothic Neo',sans-serif;}
.ab-rule{height:1px;margin-top:12px;opacity:.4;
  background:repeating-linear-gradient(90deg,#F2EFE4 0 12px,transparent 12px 16px);}
.ab-cols{margin-top:14px;column-gap:26px;column-rule:1px dashed rgba(242,239,228,.2);}
.ab-grp{display:block;break-inside:avoid;-webkit-column-break-inside:avoid;page-break-inside:avoid;}
.ab-name{font-size:1.3em;color:#F2EFE4;opacity:.95;margin:1.05em 0 .42em;
  text-shadow:0 0 5px rgba(255,255,255,.28);}
.ab-cols>.ab-grp:first-child .ab-name{margin-top:0;}
.ab-name i{font-style:normal;font-size:.56em;opacity:.45;margin-left:.5em;letter-spacing:1px;}
.ab-hidename .ab-name{display:none;}
.ab-hidename .ab-grp+.ab-grp{margin-top:.9em;}
.ab-item{display:flex;gap:.4em;align-items:baseline;min-width:0;margin-bottom:.46em;}
.ab-no{flex:0 0 1.6em;text-align:right;opacity:.42;font-size:.72em;}
.ab-tx{flex:1;min-width:0;line-height:1.45;word-break:keep-all;overflow-wrap:break-word;
  text-shadow:0 0 1px rgba(255,255,255,.3);}
.ab-done .ab-tx{opacity:.6;text-decoration:line-through;text-decoration-color:#FF7900;
  -webkit-text-decoration-color:#FF7900;text-decoration-thickness:2px;}
.ab-nocat .ab-tx{color:#F2EFE4 !important;}
.ab-tools{display:flex;justify-content:flex-end;align-items:center;gap:5px;margin-bottom:7px;}
.ab-tools button{background:#F6F1E7;border:1px solid #EBE3D4;cursor:pointer;color:#c0b4a3;
  font-size:10.5px;line-height:1;padding:4px 9px;border-radius:9999px;font-family:inherit;
  transition:.15s;}
.ab-tools button:hover{color:#8a7a6d;border-color:#ded3c1;}
.ab-tools button[aria-pressed="true"]{background:#EFE7D8;border-color:#d9cbb6;color:#7a6b5c;}
.ab-tools .ab-info{font-size:10px;color:#cec3b2;margin-left:3px;}
/* 잠금 */
.ab-lock{text-align:center;padding:56px 20px;}
.ab-lock h2{font-size:20px;margin-bottom:8px;}
.ab-lock p{font-size:13px;color:rgba(242,239,228,.6);line-height:1.8;margin-bottom:22px;}
.ab-lock .row{display:flex;gap:8px;justify-content:center;}
.ab-lock input{flex:1;max-width:220px;border-radius:9999px;border:1px solid rgba(242,239,228,.35);
  background:rgba(0,0,0,.22);color:#F2EFE4;padding:10px 16px;font-size:14px;outline:none;font-family:inherit;}
.ab-lock input:focus{border-color:#FF7900;}
.ab-lock .err{color:#FFB08A;font-size:12.5px;margin-top:12px;min-height:18px;}
/* 압정으로 꽂은 카드 */
.pinned{position:relative;padding-top:16px;}
.pinned>button{transform:rotate(var(--tl,0deg));transform-origin:50% 0;transition:transform .18s ease;}
.pinned:hover>button{transform:rotate(var(--tl,0deg)) translateY(-3px);}
.plc-pin{position:absolute;left:50%;top:-4px;transform:translateX(-50%);z-index:9;pointer-events:none;}
.plc-check{position:absolute;left:4%;right:4%;top:4%;bottom:26%;z-index:7;pointer-events:none;
  transform:rotate(-7deg);}
.plc-check svg{width:100%;height:100%;display:block;}
`;

function Logo() {
  return (
    <div style={{position:"relative",display:"inline-block"}}>
      <span style={{position:"absolute",borderRadius:"9999px",background:"#d4e6f7",width:46,height:46,left:-16,top:-8,zIndex:0}}/>
      <span style={{position:"absolute",borderRadius:"9999px",background:"#ffe0c2",width:56,height:56,right:-20,bottom:-12,zIndex:0}}/>
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
  const [tab,setTab]=useState("feed");
  const [feedFilter,setFeedFilter]=useState("all");
  const [boardMember,setBoardMember]=useState("");
  const [addingMember,setAddingMember]=useState(false);
  const [newName,setNewName]=useState("");
  const [toast,setToast]=useState("");
  const [confirmBox,setConfirmBox]=useState(null);
  const [viewRec,setViewRec]=useState(null);
  const [me,setMeState]=useState("");
  const [undoRec,setUndoRec]=useState(null);
  const undoTimer=useRef(null);
  const [journeyNum,setJourneyNum]=useState(null);
  const [allUnlocked,setAllUnlocked]=useState(()=>{
    try{
      if(new Date()>=new Date(ALL_BOARD_OPEN_AT+"T00:00:00"))return true;
      return sessionStorage.getItem("plc_all_ok")==="1";
    }catch(e){return false;}
  });
  useEffect(()=>{ if(allUnlocked){ try{sessionStorage.setItem("plc_all_ok","1");}catch(e){} } },[allUnlocked]);
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
    if(p){setTab("board");setBoardMember(p);}
    setMeState(getMe());
    reload();
  },[reload]);
  useEffect(()=>{
    const onPop=()=>{
      const p=new URLSearchParams(window.location.search).get("member");
      if(p){setTab("board");setBoardMember(p);}else{setTab("feed");}
    };
    window.addEventListener("popstate",onPop);
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);
  // 30초마다 새 인증 자동 반영 (슬랙에서 올라온 것 포함)
  useEffect(()=>{ const t=setInterval(reload,30000); return ()=>clearInterval(t); },[reload]);

  const switchTab=(t)=>{
    setTab(t);setJourneyNum(null);
    const url=new URL(window.location.href);
    if(t==="feed"||t==="all") url.searchParams.delete("member");
    else if(boardMember) url.searchParams.set("member",boardMember);
    window.history.replaceState({},"",url);
  };
  const pickBoardMember=(mid)=>{
    setBoardMember(mid);setJourneyNum(null);
    const url=new URL(window.location.href);
    url.searchParams.set("member",mid);
    window.history.replaceState({},"",url);
  };
  useEffect(()=>{
    if(tab==="board"&&!boardMember&&members.length>0){
      const mid=me||members[0].id;
      setBoardMember(mid);
      const url=new URL(window.location.href);
      url.searchParams.set("member",mid);
      window.history.replaceState({},"",url);
    }
  },[tab,boardMember,members,me]);

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
  const feedShown=feedFilter==="all"?records:records.filter(r=>r.member_id===feedFilter);
  const curPockets=boardMember?(pockets[boardMember]||emptyPockets(boardMember)):null;
  const curMember=boardMember?memberOf(boardMember):null;
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

        <div className="main-tabs">
          {ALL_BOARD&&<button className={`main-tab${tab==="all"?" main-tab-on":""}`} onClick={()=>switchTab("all")}>전체 보드</button>}
          <button className={`main-tab${tab==="feed"?" main-tab-on":""}`} onClick={()=>switchTab("feed")}>피드</button>
          <button className={`main-tab${tab==="board"?" main-tab-on":""}`} onClick={()=>switchTab("board")}>포켓 보드</button>
        </div>

      </header>

      {ALL_BOARD&&tab==="all"&&(
        allUnlocked
          ? <AllBoard members={members} pockets={pockets} records={records}/>
          : <AllBoardLock onOpen={()=>setAllUnlocked(true)}/>
      )}

      {tab==="feed"&&(
        <main style={{maxWidth:960,margin:"0 auto",padding:"0 20px 96px"}}>
          <div className="member-pills" style={{marginBottom:12}}>
            <button className={feedFilter==="all"?"chip-active":"chip"} style={{borderRadius:9999,padding:"6px 14px",fontSize:13,fontWeight:700}}
              onClick={()=>setFeedFilter("all")}>전체</button>
            {members.map(m=>(
              <button key={m.id} className={feedFilter===m.id?"chip-active":"chip"} style={{borderRadius:9999,padding:"6px 14px",fontSize:13,fontWeight:700}}
                onClick={()=>setFeedFilter(m.id)}>
                {m.name}{me===m.id?" (나)":""}
              </button>
            ))}
          </div>
          {loading?(
            <p className="t-sub" style={{textAlign:"center",padding:"64px 0",fontSize:14}}>기록을 불러오는 중…</p>
          ):feedShown.length===0?(
            <div style={{textAlign:"center",padding:"64px 0"}}>
              <p style={{fontSize:18,fontWeight:700,margin:0}}>아직 인증이 없어요</p>
              <p className="t-sub" style={{marginTop:8,fontSize:14}}>슬랙에서 <b>/시도</b> 또는 <b>/달성</b>으로 첫 인증을 남겨보세요.</p>
            </div>
          ):(
            <div className="feed-grid">
              {feedShown.map(r=>(
                <RecordCard key={r.id} rec={r} member={memberOf(r.member_id)} showName={true} isMine={me===r.member_id}
                  onOpen={()=>setViewRec(r)}
                  onDelete={()=>askConfirm("이 인증 기록을 삭제할까요?\n삭제 후 20초 안에는 되돌릴 수 있어요.",()=>doDeleteRecord(r))}/>
              ))}
            </div>
          )}
        </main>
      )}

      {tab==="board"&&(
        <main style={{maxWidth:960,margin:"0 auto",padding:"0 20px 96px"}}>
          <div className="member-pills" style={{marginBottom:16,display:"flex",alignItems:"center"}}>
            {members.map(m=>(
              <button key={m.id} className={boardMember===m.id?"chip-active":"chip"} style={{borderRadius:9999,padding:"6px 14px",fontSize:13,fontWeight:700}}
                onClick={()=>pickBoardMember(m.id)}>
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
              <button onClick={()=>setAddingMember(true)} className="chip-dashed" style={{borderRadius:9999,padding:"6px 14px",fontSize:13}}>+ 멤버</button>
            )}
          </div>
          {curMember&&curPockets&&(
            <div>
              <PocketBoard member={curMember} list={curPockets} records={records.filter(r=>r.member_id===boardMember)}
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
        </main>
      )}

      {journeyNum!=null&&tab==="board"&&curPockets&&curMember&&(
        <JourneyPoster member={curMember}
          item={curPockets.find(it=>it.num===journeyNum)||{num:journeyNum,title:""}}
          records={records.filter(r=>r.member_id===boardMember&&r.num===journeyNum)}
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
            style={{background:"#FF7900",color:"#fff",border:"none",cursor:"pointer",
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
  const memoShort=rec.memo?(rec.memo.length>15?rec.memo.slice(0,15)+"…":rec.memo):"";
  return (
    <div className="rec-card" onClick={onOpen}>
      <img src={rec.image_url} alt="" style={{width:"100%",aspectRatio:"1/1",objectFit:"cover",display:"block"}}/>
      <div className="rec-overlay">
        {memoShort&&<span className="rec-memo">{memoShort}</span>}
        {showName&&member&&<span className="rec-chip">{member.name}</span>}
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
      <path d="M30 2 L35 8 L43 5 L45 13 L53 13 L52 21 L59 25 L54 32 L58 39 L50 42 L50 50 L42 49 L38 56 L30 51 L22 56 L18 49 L10 50 L10 42 L2 39 L6 32 L1 25 L8 21 L7 13 L15 13 L17 5 L25 8 Z" fill="#FF7900"/>
      <circle cx="30" cy="29" r="16" fill="none" stroke="#cc6000" strokeWidth="1.2"/>
      <text x="30" y="26" fontSize="8.5" fontWeight="900" fill="#fff" textAnchor="middle" fontFamily="Georgia,serif">DONE</text>
      <text x="30" y="36" fontSize="6" fill="#fff3e0" textAnchor="middle">100 PLC</text>
    </svg>
  );
}

/* ---------- 압정 ---------- */
function Pin({size=30,seed=0}){
  const rot=-34+((seed*13)%12)-6;
  const id="pin"+seed;
  return (
    <svg className="plc-pin" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={id+"h"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFB48A"/><stop offset="26%" stopColor="#FA7A3C"/>
          <stop offset="62%" stopColor="#E8481C"/><stop offset="100%" stopColor="#8E2408"/>
        </linearGradient>
        <linearGradient id={id+"c"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FF9E66"/><stop offset="34%" stopColor="#F2601F"/>
          <stop offset="78%" stopColor="#B93509"/><stop offset="100%" stopColor="#7E1F04"/>
        </linearGradient>
        <linearGradient id={id+"n"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8C949C"/><stop offset="42%" stopColor="#E8EDF2"/>
          <stop offset="70%" stopColor="#A8B0B8"/><stop offset="100%" stopColor="#6E767E"/>
        </linearGradient>
      </defs>
      <ellipse cx="34" cy="52" rx="15" ry="4.4" fill="#1c1c1c" opacity=".26"/>
      <g transform={`rotate(${rot} 32 32)`}>
        <path d="M30.4 40 L33.6 40 L32.6 60.5 L31.4 60.5 Z" fill={`url(#${id}n)`}/>
        <path d="M31.4 56 L32.6 56 L32.2 61.4 L31.8 61.4 Z" fill="#5C646C"/>
        <path d="M26.6 28 L37.4 28 L46 39.4 Q32 44 18 39.4 Z" fill={`url(#${id}c)`}/>
        <ellipse cx="32" cy="39.6" rx="14" ry="4.6" fill={`url(#${id}c)`}/>
        <ellipse cx="32" cy="38.2" rx="14" ry="4.6" fill="#F76B2A"/>
        <ellipse cx="32" cy="37.9" rx="9.4" ry="2.9" fill="#B23A0A" opacity=".38"/>
        <rect x="23.2" y="6" width="17.6" height="24" rx="8.4" fill={`url(#${id}h)`}/>
        <ellipse cx="32" cy="7.6" rx="8.8" ry="3.4" fill="#FFA579"/>
        <path d="M27.4 11 q-1.6 8 .4 15.6" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" fill="none" opacity=".62"/>
        <path d="M37 12 q1.2 7 .2 13" stroke="#7A2205" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".4"/>
      </g>
    </svg>
  );
}

/* ---------- 크레용 체크 (도형만 사용 — html2canvas 캡쳐에서도 그대로) ---------- */
function CrayonCheck({seed=1}){
  const parts=useMemo(()=>{
    let st=(seed*2654435761)>>>0;
    const rnd=()=>{st=(st*1664525+1013904223)>>>0;return st/4294967296;};
    const A=[13,52],B=[38,85],C=[90,12];
    const segs=[[A,B,0,.36],[B,C,.36,1]];
    const width=g=> g<.10 ? 1.2+g*28 : (g>.72 ? Math.max(.8,4.4-(g-.72)*11) : 4.3);
    const core=[],grain=[];
    segs.forEach(([p,q,t0,t1],si)=>{
      const dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);
      const nx=-dy/len,ny=dx/len,N=26,up=[],dn=[];
      for(let i=0;i<=N;i++){
        const t=i/N,g=t0+(t1-t0)*t;
        const x=p[0]+dx*t,y=p[1]+dy*t,w=width(g)/2;
        const j1=(rnd()-.5)*1.3,j2=(rnd()-.5)*1.3;
        up.push(`${(x+nx*(w+j1)).toFixed(1)},${(y+ny*(w+j1)).toFixed(1)}`);
        dn.push(`${(x-nx*(w+j2)).toFixed(1)},${(y-ny*(w+j2)).toFixed(1)}`);
      }
      core.push({k:"c"+si,pts:[...up,...dn.reverse()].join(" ")});
      const steps=Math.round(len*4.2);
      for(let i=0;i<=steps;i++){
        const t=i/steps,g=t0+(t1-t0)*t;
        const x=p[0]+dx*t,y=p[1]+dy*t,w=width(g);
        for(let k=0;k<4;k++){
          if(g>.84&&rnd()<.5)continue;
          const off=(rnd()-.5)*w*2.9, sz=+(.35+rnd()*1.25).toFixed(1);
          const px=+(x+nx*off).toFixed(1), py=+(y+ny*off).toFixed(1);
          const r=rnd();
          grain.push({k:si+"-"+i+"-"+k,x:px,y:py,w:sz,h:+(sz*(.6+rnd()*1.1)).toFixed(1),
            f:r<.22?"#9E2408":(r<.44?"#F46E4E":"#E23A18"),
            o:+((g>.8?.14+rnd()*.42:.26+rnd()*.6).toFixed(2)),rot:Math.round(rnd()*90)});
        }
      }
    });
    for(let i=0;i<34;i++){
      const t=.55+rnd()*.55, sz=+(.3+rnd()*1).toFixed(1);
      grain.push({k:"s"+i,x:+(B[0]+(C[0]-B[0])*Math.min(1,t)+(rnd()-.5)*15).toFixed(1),
        y:+(B[1]+(C[1]-B[1])*Math.min(1,t)+(rnd()-.5)*13).toFixed(1),
        w:sz,h:sz,f:"#E23A18",o:+((.15+rnd()*.45).toFixed(2)),rot:0});
    }
    return {core,grain};
  },[seed]);
  return (
    <span className="plc-check">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {parts.core.map(c=><polygon key={c.k} points={c.pts} fill="#E23A18" fillOpacity=".62"/>)}
        {parts.grain.map(g=>(
          <rect key={g.k} x={g.x} y={g.y} width={g.w} height={g.h} fill={g.f} opacity={g.o}
            transform={g.rot?`rotate(${g.rot} ${g.x} ${g.y})`:undefined}/>
        ))}
      </svg>
    </span>
  );
}

/* ---------- 카테고리 6종 자동 분류 (슬랙에서 제목이 바뀌어도 안 깨짐) ---------- */
const CAT_META={
  B:{ko:"몸 & 건강",c:"#FFBE85"}, G:{ko:"배움 & 성장",c:"#FBE49B"},
  P:{ko:"취미 & 재미",c:"#D6C7F0"}, C:{ko:"관계 & 마음",c:"#F7B8CA"},
  R:{ko:"쉼 & 회복",c:"#B4E3BE"},  D:{ko:"일상 & 정리",c:"#A6D7EF"},
};
const CAT_RULES={
  B:["운동","헬스","러닝","달리기","수영","요가","필라테스","스쿼트","감량","체중","kg","유산소","등산","산행","스트레칭","건강","검진","취침","기상","수면","병원","걷기","다이어트","근육","체지방","마라톤","자전거","금주","금연","스미스"],
  G:["책","독서","완독","공부","강의","완강","자격증","인강","프로젝트","기획","제작","콘텐츠","블로그","글쓰기","에세이","논문","포트폴리오","이력서","지원","입사","채용","sns","발행","업로드","영어","일본어","학원","스크랩","기사","뉴스","경제","투자","앱","개발","디자인","유저","연구","복습","코딩","obsidian","템플릿","전자책","릴스","인스타","출판"],
  P:["영화","드라마","미드","정주행","여행","카페","음악","플리","디깅","악기","노래","춤","그림","페인팅","사진","lp","공연","전시","요리","만들어","음식","캠핑","꾸미기","집꾸","취미","게임","맛집","베이킹","오르간","신디","김치찜"],
  C:["손편지","편지","부모님","엄마","아빠","가족","친구","동생","짝꿍","데이트","만나기","사람","연락","메시지","메세지","축복","인사","초대","나눔","모임","관계","선물","봉사","통화"],
  R:["쉼","회복","휴식","명상","디톡스","감사","일기","복기","회고","어쩌라고","마인드","눈치","당당","me time","혼자","알고리즘","삭제","마음","산책","힐링"],
  D:["정리","정돈","버리기","처분","청소","비우기","가계부","재정","저축","적금","소비","명세서","구독","해지","계획","주문","식자재","달력","루틴","면허","시스템","기록하기","옷장","냉장고"],
};
const CAT_ORDER=["B","C","R","P","D","G"];
function classifyPocket(title){
  const t=String(title||"").toLowerCase();
  if(!t.trim())return "G";
  const m=t.match(/\[([^\]]+)\]/);
  if(m){
    const tag=m[1].replace(/\s/g,"");
    if(/몸|건강/.test(tag))return "B";
    if(/관계|마음/.test(tag))return "C";
    if(/쉼|회복/.test(tag))return "R";
    if(/취미|재미/.test(tag))return "P";
    if(/일상|정리/.test(tag))return "D";
    if(/배움|성장|커리어/.test(tag))return "G";
  }
  let best="G",top=0;
  CAT_ORDER.forEach(k=>{
    const n=CAT_RULES[k].reduce((a,w)=>a+(t.includes(w)?1:0),0);
    if(n>top){top=n;best=k;}
  });
  return top>0?best:"G";
}

function PocketBoard({member,list,records,onOpen,boardRef}) {
  const day=dayLabel();
  const byNum={};
  records.slice().sort(recSortAsc).forEach(r=>{(byNum[r.num]=byNum[r.num]||[]).push(r);});
  const doneN=list.filter(it=>(byNum[it.num]||[]).some(r=>recType(r)==="done")).length;
  let tryN=0;
  list.forEach(it=>{const recs=byNum[it.num]||[];if(recs.length===0)return;const hasDone=recs.some(r=>recType(r)==="done");tryN+=hasDone?recs.length-1:recs.length;});
  return (
    <div ref={boardRef} className={CHALK_BOARD?"plc-chalk":""} style={CHALK_BOARD?{}:{background:"#fffdf8",border:"1px solid #eadfd0",borderRadius:24,
      padding:"30px 26px 36px",position:"relative",overflow:"hidden",
      boxShadow:"0 10px 40px rgba(69,55,48,.07)"}}>
      {CHALK_BOARD
        ? <div className="plc-felt"/>
        : <div style={{position:"absolute",inset:10,border:"1.5px dashed #e8dcc8",borderRadius:16,pointerEvents:"none"}}/>}
      <div style={CHALK_BOARD?{position:"relative",zIndex:2,padding:"22px 22px 18px"}:{display:"contents"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:8,position:"relative",zIndex:1,padding:"0 4px"}}>
        <div style={{fontSize:22,letterSpacing:1,fontFamily:'"Black Han Sans",sans-serif',
          color:CHALK_BOARD?"#F2EFE4":undefined,textShadow:CHALK_BOARD?"0 0 5px rgba(255,255,255,.25)":undefined}}>
          {member?.name}의 포켓
        </div>
        <div style={{fontSize:12,color:CHALK_BOARD?"rgba(242,239,228,.6)":"#8a7a6d",fontWeight:700,letterSpacing:2}}>
          {day.txt.startsWith("DAY")?(<>DAY <b style={{color:"#FF7900",fontSize:16}}>{day.txt.split(" ")[1]}</b> / {day.total}</>):day.txt}
        </div>
      </div>
      <div style={{display:"flex",gap:18,margin:"10px 4px 20px",position:"relative",zIndex:1}}>
        <span style={{fontSize:11.5,color:CHALK_BOARD?"rgba(242,239,228,.55)":"#8a7a6d"}}><b style={{fontSize:15,color:CHALK_BOARD?"#F2EFE4":"#453730",marginRight:2}}>{doneN}</b>달성</span>
        <span style={{fontSize:11.5,color:CHALK_BOARD?"rgba(242,239,228,.55)":"#8a7a6d"}}><b style={{fontSize:15,color:CHALK_BOARD?"#F2EFE4":"#453730",marginRight:2}}>{tryN}</b>번의 시도</span>
        <span style={{fontSize:11.5,color:CHALK_BOARD?"rgba(242,239,228,.55)":"#8a7a6d"}}><b style={{fontSize:15,color:CHALK_BOARD?"#F2EFE4":"#453730",marginRight:2}}>{10-doneN}</b>남은 포켓</span>
      </div>
      <div className="board-grid" style={{display:"grid",gap:CHALK_BOARD?"30px 14px":13,position:"relative",zIndex:1}}>
        {list.map(it=>{
          const recs=byNum[it.num]||[];
          const isDone=recs.some(r=>recType(r)==="done");
          const tries=recs.filter(r=>recType(r)==="try").length;
          if(recs.length===0){
            const card=(
              <button key={it.num} onClick={()=>onOpen(it.num)}
                style={{aspectRatio:"3/4",borderRadius:14,
                  background:CHALK_BOARD?"rgba(255,255,255,.06)":"transparent",
                  border:`1.5px dashed ${CHALK_BOARD?"rgba(242,239,228,.3)":"#d9cbbd"}`,
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",padding:6}}>
                <span className="slab" style={{fontSize:26,color:CHALK_BOARD?"rgba(242,239,228,.35)":"#e5dac6"}}>{it.num}</span>
                <span style={{fontSize:10,color:CHALK_BOARD?"rgba(242,239,228,.4)":"#c9bba6",letterSpacing:1}}>COMING SOON</span>
                {it.title&&<span style={{fontSize:11.5,fontWeight:700,color:CHALK_BOARD?"rgba(242,239,228,.55)":"#a89880",lineHeight:1.3,textAlign:"center",
                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{it.title}</span>}
              </button>
            );
            return CHALK_BOARD
              ? <div key={it.num} className="pinned" style={{"--tl":`${[-2.2,1.6,-1.2,2.4,-1.8][it.num%5]}deg`}}>{card}<Pin seed={it.num}/></div>
              : card;
          }
          const latest=recs[recs.length-1];
          const behind=recs.slice(-3,-1).reverse();
          const card=(
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
                {isDone&&CHALK_BOARD&&<CrayonCheck seed={it.num*7+(member?.name||"").length}/>}
                {isDone&&!CHALK_BOARD&&<span style={{position:"absolute",right:-7,bottom:-7,zIndex:5,filter:"drop-shadow(0 2px 4px rgba(0,0,0,.25))"}}><Seal size={44}/></span>}
              </span>
              <span style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                <span className="slab" style={{fontSize:12,color:isDone?"#FF7900":"#FF7900"}}>No.{it.num}</span>
                {isDone
                  ?<span style={{fontSize:9.5,fontWeight:800,background:"#FF7900",color:"#fff",borderRadius:9999,padding:"2px 8px",letterSpacing:.5}}>DONE</span>
                  :<span style={{fontSize:9.5,fontWeight:800,background:"#fff2e6",color:"#e06800",border:"1px solid #ffc999",borderRadius:9999,padding:"2px 8px"}}>시도 ×{tries}</span>}
              </span>
              <span style={{display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",
                fontSize:10,color:isDone?"#e8dfd2":"#5b4d43",lineHeight:1.35,marginTop:5,minHeight:27}}>{it.title||"이름 미설정"}</span>
            </button>
          );
          return CHALK_BOARD
            ? <div key={it.num} className="pinned" style={{"--tl":`${[-2.2,1.6,-1.2,2.4,-1.8][it.num%5]}deg`}}>{card}<Pin seed={it.num}/></div>
            : card;
        })}
      </div>
      <div style={{marginTop:30,textAlign:"center",position:"relative",zIndex:1}}>
        <div style={{fontSize:10.5,color:CHALK_BOARD?"rgba(242,239,228,.45)":"#b6a795",letterSpacing:3,fontWeight:700}}>100 POCKET LIST CLUB · 2026.07.25 — 11.01</div>
        <div style={{fontSize:11,color:"#FF7900",fontWeight:700,marginTop:4}}>#100일포켓리스트 #{member?.name}의포켓</div>
      </div>
      </div>
    </div>
  );
}

/* ---------- 전체 보드 (10명 × 10개 = 100개, 칠판) ---------- */
function AllBoard({members,pockets,records}){
  const wrapRef=useRef(null), colsRef=useRef(null), titleRef=useRef(null), memRef=useRef(null);
  const [showName,setShowName]=useState(false);
  const [showCat,setShowCat]=useState(true);
  const [info,setInfo]=useState("");

  const groups=useMemo(()=>{
    const doneSet=new Set(records.filter(r=>recType(r)==="done").map(r=>r.member_id+"#"+r.num));
    return (members||[]).map(m=>{
      const list=(pockets[m.id]||emptyPockets(m.id));
      return {id:m.id,name:m.name,
        items:list.map(it=>({num:it.num,title:it.title||"",
          done:doneSet.has(m.id+"#"+it.num),cat:classifyPocket(it.title)}))};
    });
  },[members,pockets,records]);

  const total=groups.reduce((a,g)=>a+g.items.length,0);
  const doneN=groups.reduce((a,g)=>a+g.items.filter(i=>i.done).length,0);

  /* 화면에 맞춰 단 수와 글씨 크기를 스스로 고른다 */
  const fit=useCallback(()=>{
    const cols=colsRef.current, wrap=wrapRef.current, ttl=titleRef.current;
    if(!cols||!wrap)return;
    if(ttl){
      ttl.style.fontSize="100px";
      const px=Math.min(46,100*(cols.clientWidth*0.5)/(ttl.scrollWidth||1));
      ttl.style.fontSize=px.toFixed(1)+"px";
      if(memRef.current)memRef.current.style.fontSize=Math.max(11,px*0.155).toFixed(1)+"px";
    }
    const w=window.innerWidth;
    const cands = w<560?[1,2] : w<820?[2,3] : w<1100?[3,4] : [3,4,5];
    let best={n:cands[cands.length-1],size:14,over:Infinity};
    for(const n of cands){
      cols.style.columnCount=String(n);
      for(let size=23;size>=14;size--){
        cols.style.fontSize=size+"px";
        const need=cols.offsetHeight;
        const avail=window.innerHeight-(cols.getBoundingClientRect().top+window.scrollY)-115;
        if(need<=avail){ if(size>best.size||(size===best.size&&n<best.n))best={n,size,over:0}; break; }
        if(size===14&&best.over>0&&need-avail<best.over)best={n,size:14,over:need-avail};
      }
    }
    cols.style.columnCount=String(best.n);
    cols.style.fontSize=best.size+"px";
    setInfo(SHOW_DEBUG?`자동 ${best.n}단 · ${best.size}px`:"");
  },[]);

  useEffect(()=>{
    const t=setTimeout(fit,60);
    const onR=()=>{clearTimeout(window.__abT);window.__abT=setTimeout(fit,150);};
    window.addEventListener("resize",onR);
    return ()=>{clearTimeout(t);window.removeEventListener("resize",onR);};
  },[fit,groups,showName,showCat]);

  let running=0;
  return (
    <div ref={wrapRef}>
      <div className="ab-tools">
        <button aria-pressed={showCat} onClick={()=>setShowCat(v=>!v)}>색</button>
        <button aria-pressed={showName} onClick={()=>setShowName(v=>!v)}>멤버</button>
        {info&&<span className="ab-info">{info}</span>}
      </div>
      <div className={`plc-chalk${showName?"":" ab-hidename"}${showCat?"":" ab-nocat"}`}>
        <div className="plc-felt"/>
        <div className="plc-in">
          <h2 ref={titleRef} className="ab-title">OUR 100 POCKET LISTs</h2>
          <p ref={memRef} className="ab-members">
            {groups.map((g,i)=>(<span key={g.id}>{i>0&&" · "}<b>{g.name}</b></span>))}
          </p>
          <div className="ab-rule"/>
          <div ref={colsRef} className="ab-cols" style={{columnCount:4,fontSize:19}}>
            {groups.map(g=>(
              <div key={g.id} className="ab-grp">
                <p className="ab-name">{g.name}<i>{g.items.filter(i=>i.done).length}/{g.items.length}</i></p>
                {g.items.map(it=>{
                  running+=1;
                  const n=running;
                  return (
                    <div key={it.num} className={`ab-item${it.done?" ab-done":""}`}
                      title={`${g.name} · ${CAT_META[it.cat].ko}`}>
                      <span className="ab-no">{n}</span>
                      <span className="ab-tx" style={{color:CAT_META[it.cat].c}}>{it.title||"—"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:20,marginTop:14}}>
            <div style={{flex:1,maxWidth:280}}>
              <p style={{fontSize:11.5,color:"rgba(242,239,228,.55)",marginBottom:5}}>
                {doneN} / {total} 달성</p>
              <div style={{height:7,border:"1px dashed rgba(242,239,228,.45)",borderRadius:6,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${total?doneN/total*100:0}%`,
                  background:"repeating-linear-gradient(115deg,#FF7900 0 5px,rgba(255,121,0,.45) 5px 10px)"}}/>
              </div>
            </div>
            <p style={{fontSize:11,letterSpacing:2,color:"rgba(242,239,228,.5)",whiteSpace:"nowrap"}}>
              100 POCKET LIST CLUB · 2026.07.25 — 11.01</p>
          </div>
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:14,marginTop:12,fontSize:12.5,color:"#8a7a6d"}}>
        {Object.keys(CAT_META).map(k=>(
          <span key={k} style={{display:"flex",alignItems:"center",gap:6}}>
            <i style={{width:12,height:12,borderRadius:3,background:CAT_META[k].c,display:"block"}}/>
            {CAT_META[k].ko}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- 전체 보드 잠금 ---------- */
function AllBoardLock({onOpen}){
  const [pw,setPw]=useState(""); const [err,setErr]=useState("");
  const go=()=>{ if(pw===ALL_BOARD_PASSWORD)onOpen(); else {setErr("암호가 맞지 않아요. 대소문자를 확인해 주세요.");setPw("");} };
  return (
    <div className="plc-chalk">
      <div className="plc-felt"/>
      <div className="plc-in ab-lock">
        <p style={{fontSize:10.5,letterSpacing:3,color:"rgba(242,239,228,.4)",fontWeight:700,marginBottom:14}}>
          100 POCKET LIST CLUB</p>
        <h2>전체 보드는 아직 잠겨 있어요</h2>
        <p>9월 4일 리프레시 데이에 열립니다.<br/>암호를 알고 있다면 먼저 들어올 수 있어요.</p>
        <div className="row">
          <input type="password" value={pw} placeholder="비밀 암호" autoComplete="off"
            onChange={e=>{setPw(e.target.value);setErr("");}}
            onKeyDown={e=>{if(e.key==="Enter")go();}}/>
          <button className="btn-primary" onClick={go}>열기</button>
        </div>
        <p className="err">{err}</p>
      </div>
    </div>
  );
}

/* 보드 → PNG 저장 (html2canvas로 DOM을 그대로 캡쳐) */
async function downloadBoardPng(boardEl,filename){
  const html2canvas=(await import("html2canvas")).default;
  const canvas=await html2canvas(boardEl,{
    backgroundColor:CHALK_BOARD?"#2E4F46":"#fffdf8",
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

const CONFETTI_PIECES=Array.from({length:24},(_,i)=>{const a=(i/24)*Math.PI*2;const d=35+(i%5)*12;return{cx:Math.cos(a)*d,cy:Math.sin(a)*d*0.8-20,cr:(i%2===0?1:-1)*(180+i*47),color:['#FF7900','#1560BC','#FF9F40','#A8D8EA','#fff','#FFB366'][i%6],w:i%3===0?5:3+i%3,h:i%3===0?5:5+i%4,br:i%3===0?'50%':'1px',d:i*0.02};});

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
  useEffect(()=>{
    const onKey=(e)=>{ if(e.key==="Escape")onClose(); };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[onClose]);
  const rows=[];
  for(let i=0;i<steps.length;i+=perRow)rows.push(steps.slice(i,i+perRow));
  const tapeColors=["rgba(245,205,120,.65)","rgba(180,210,235,.6)","rgba(235,180,195,.55)"];
  const tilts=[-3.5,2.8,-2.4,3.4,-3,2.4]; // 좌/우 교차 기울기 (폴라로이드 느낌)
  const STAG=0.13; // 카드 하나당 등장 간격(초)
  let tryIdx=0;

  return (
    <div className="overlay" onClick={onClose} style={{position:"fixed",inset:0,zIndex:46,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 12px",overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} className={CHALK_BOARD?"plc-chalk":""}
        style={CHALK_BOARD
          ?{width:"100%",maxWidth:900,position:"relative",boxShadow:"0 30px 80px rgba(0,0,0,.45)"}
          :{width:"100%",maxWidth:840,background:"#fffdf8",borderRadius:20,overflow:"hidden",boxShadow:"0 30px 80px rgba(0,0,0,.35)",position:"relative"}}>
        {CHALK_BOARD&&<div className="plc-felt"/>}
        <button onClick={onClose} aria-label="닫기"
          style={{position:"absolute",top:CHALK_BOARD?20:10,right:CHALK_BOARD?22:10,zIndex:20,
            background:"rgba(0,0,0,.28)",border:"1px solid rgba(242,239,228,.3)",
            width:34,height:34,borderRadius:"50%",cursor:"pointer",fontSize:15,color:"#F2EFE4"}}>✕</button>
        <div style={CHALK_BOARD
          ?{position:"relative",zIndex:2,color:"#F2EFE4",padding:"24px 26px 4px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}
          :{background:"#453730",color:"#FAF6EF",padding:"16px 22px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:CHALK_BOARD?19:16,fontWeight:800,lineHeight:1.35,
              textShadow:CHALK_BOARD?"0 0 5px rgba(255,255,255,.22)":undefined}}>
              <span className="slab" style={{color:"#FF7900",marginRight:6}}>No.{String(item.num).padStart(2,"0")}</span>{item.title||"이름 미설정"}
            </div>
          </div>
          <div style={{fontSize:11.5,color:CHALK_BOARD?"rgba(242,239,228,.6)":"#cbbfae",display:"flex",gap:12,alignItems:"center"}}>
            <span>by <b style={{color:"#F2EFE4"}}>{member?.name}</b></span>
            <span>시도 <b style={{color:"#F2EFE4"}}>{tries.length}</b></span>
            {doneRec
              ?<span style={{color:"#FF7900",fontWeight:800}}>✦ 달성 {doneRec.date}</span>
              :<span>도전 중</span>}
          </div>
        </div>
        <div style={CHALK_BOARD?{position:"relative",zIndex:2,padding:"22px 26px 22px"}:{padding:"24px 26px 18px"}}>
          {steps.length===0?(
            <div style={{textAlign:"center",padding:"34px 10px",color:CHALK_BOARD?"rgba(242,239,228,.55)":"#b6a795",fontSize:13}}>
              아직 기록이 없어요.<br/>슬랙에서 <b style={{color:"#e06800"}}>/시도</b> 로 첫 폴라로이드를 붙여보세요!
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
                          <span className="journey-flap" style={{position:"absolute",top:-1,left:"-6%",right:"-6%",height:22,
                            background:"#544236",clipPath:"polygon(0 0,100% 0,50% 100%)",zIndex:6,
                            animationDelay:`${idx*STAG+0.8}s`}}/>
                          <span className="journey-seal-pop" style={{position:"absolute",right:-11,top:-11,zIndex:7,
                            filter:"drop-shadow(0 2px 5px rgba(0,0,0,.3))",animationDelay:`${idx*STAG+1.1}s`}}><Seal size={44}/></span>
                          {CONFETTI_PIECES.map((c,ci)=>(
                            <span key={ci} className="journey-confetti" style={{position:"absolute",left:"50%",top:"30%",zIndex:8,
                              width:c.w,height:c.h,borderRadius:c.br,background:c.color,
                              "--cx":`${c.cx}px`,"--cy":`${c.cy}px`,"--cr":`${c.cr}deg`,
                              animationDelay:`${idx*STAG+0.9+c.d}s`}}/>
                          ))}
                        </>):(
                          <span style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%) rotate(-1deg)",width:46,height:15,background:tapeColors[idx%3],zIndex:2}}/>
                        )}
                        <img className={isFinal?"journey-img-pop":""} src={r.image_url} alt="" style={{width:"100%",aspectRatio:"1/1",objectFit:"cover",borderRadius:2,display:"block",
                          border:isFinal?"2px solid #FF7900":"none",position:"relative",zIndex:2,
                          ...(isFinal?{animationDelay:`${idx*STAG+0.95}s`}:{})}}/>
                        <span style={{display:"block",fontSize:9.5,color:isFinal?"#f0e6d8":"#5b4d43",marginTop:5,lineHeight:1.35,
                          whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.memo||" "}</span>
                        <span style={{display:"flex",justifyContent:"space-between",fontSize:8.5,color:isFinal?"#c9b8a4":"#a08f7d",marginTop:2}}>
                          <span>{r.date}</span>
                          <span style={{fontWeight:900,color:isFinal?"#FF7900":"#FF7900",letterSpacing:1}}>
                            {isFinal?"ACHIEVED":`TRY ${String(stepNo).padStart(2,"0")}`}
                          </span>
                        </span>
                      </span>
                      {ci<row.length-1&&<span className="journey-arrow" style={{width:26,height:0,marginTop:-16,
                        borderTop:`2px dashed ${CHALK_BOARD?"rgba(242,239,228,.4)":"#d9cbbd"}`,
                        animationDelay:`${(idx+1)*STAG}s`}}/>}
                    </span>
                  );
                })}
              </div>
            );
          })}
          {CHALK_BOARD&&<div style={{textAlign:"center",marginTop:14,fontSize:10.5,letterSpacing:3,
            color:"rgba(242,239,228,.4)",fontWeight:700}}>100 POCKET LIST CLUB · 2026.07.25 — 11.01</div>}
        </div>
      </div>
    </div>
  );
}

