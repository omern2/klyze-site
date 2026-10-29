const items=document.querySelectorAll(".ni");
const rotWords=["rakiplerini","kendini"];
/* scroll karti (aceternity ContainerScroll esdegeri) */
const scrollSec=document.getElementById("analiz"),scrollCard=document.getElementById("scrollCard");
if(scrollSec&&scrollCard){
  const mq=window.matchMedia("(max-width: 768px)");
  /* windows animasyonlari kapali olsa da sitedeki animasyon her zaman calisir */
  const reduce=false;
  const frame=document.querySelector(".site-frame");
  let cur=0,target=0;
  const measure=()=>{
    // site pencere degil, .site-frame ici kayiyor: olcuyu cerceveye gore al
    const r=scrollCard.getBoundingClientRect();
    const box=frame?frame.getBoundingClientRect():{top:0,height:window.innerHeight};
    const vh=box.height,top=r.top-box.top;
    // kart cercevenin altina girer girmez basla, kart ustu %45'e gelince bitir
    const start=vh*0.98,end=vh*0.45;
    const p=(start-top)/(start-end);
    target=Math.min(1,Math.max(0,p));
  };
  const render=()=>{
    cur+=(target-cur)*0.12;
    if(Math.abs(target-cur)<0.001) cur=target;
    const rot=20*(1-cur);
    const sc=mq.matches?0.7+0.2*cur:1.05-0.05*cur;
    const y=-40*cur;
    scrollCard.style.transform=`rotateX(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)}) translateY(${y.toFixed(1)}px)`;
    requestAnimationFrame(render);
  };
  if(reduce){
    scrollCard.style.transform="rotateX(0deg) scale(1) translateY(0)";
  }else{
    measure();render();
    if(frame) frame.addEventListener("scroll",measure,{passive:true});
    window.addEventListener("scroll",measure,{passive:true});
    window.addEventListener("resize",measure);
  }
}
const rotEl=document.getElementById("rotWord");
let rotI=0;
if(rotEl){
  setInterval(()=>{
    rotEl.classList.add("out");
    setTimeout(()=>{
      rotI=(rotI+1)%rotWords.length;
      rotEl.textContent=rotWords[rotI];
      rotEl.classList.remove("out");
    },350);
  },5000);
}
const pageHome=document.getElementById("page-home"),pageOzel=document.getElementById("page-ozel"),pageLiderlik=document.getElementById("page-liderlik"),pageYorumlar=document.getElementById("page-yorumlar"),pageDestek=document.getElementById("page-destek"),pageKurulum=document.getElementById("page-kurulum"),pageAc=document.getElementById("page-ac");
const dockEl=document.getElementById("dlDock");
const dockFrame=document.querySelector(".site-frame");
function dockCutoff(){
  const h=dockFrame?dockFrame.clientHeight:window.innerHeight;
  return Math.max(200,Math.min(340,Math.round(h*0.3)));
}
function updateDock(){
  if(!dockEl) return;
  const onHome=!!pageHome&&!pageHome.hidden;
  const onReviews=!!pageYorumlar&&!pageYorumlar.hidden;
  const onDestek=!!pageDestek&&!pageDestek.hidden;
  const onKurulum=!!pageKurulum&&!pageKurulum.hidden;
  const onAc=!!pageAc&&!pageAc.hidden;
  let show=!onReviews&&!onDestek&&!onKurulum&&!onAc;
  if(onHome){
    const y=dockFrame?dockFrame.scrollTop:window.scrollY;
    show=y>dockCutoff();
  }
  dockEl.classList.toggle("is-on",show);
  dockEl.toggleAttribute("inert",!show);
}
function dockKick(){
  updateDock();
}
function showPage(which){
  const pages={home:pageHome,ozel:pageOzel,liderlik:pageLiderlik,yorumlar:pageYorumlar,destek:pageDestek,kurulum:pageKurulum,ac:pageAc};
  if(!pages[which]) which="home";
  let changed=false;
  Object.keys(pages).forEach(key=>{
    const node=pages[key];
    if(!node) return;
    const hide=key!==which;
    if(node.hidden!==hide){node.hidden=hide;changed=true;}
  });
  if(changed){
    const f=document.querySelector(".site-frame");
    if(f) f.scrollTo({top:0,behavior:"auto"});
  }
  if(which==="liderlik") window.KlyzeLiderlik?.load();
  layoutFeat();
  if(which==="ozel") resetTunnel();
  updateDock();
}
function setActive(id,doScroll=true){
  items.forEach(b=>{
    const on=b.dataset.id===id;
    b.classList.toggle("active",on);
    b.setAttribute("aria-selected",on);
  });
  const t=document.getElementById("mTrigger");
  const label=document.querySelector(`.ni[data-id="${id}"]`)?.textContent||id;
  if(t) t.textContent=label+" ▾";
  if(id==="ozellikler"){ showPage("ozel"); return; }
  if(id==="ac"){ showPage("ac"); return; }
  if(id==="liderlik"){ showPage("liderlik"); return; }
  if(id==="yorumlar"){ showPage("yorumlar"); return; }
  if(id==="destek"){ showPage("destek"); return; }
  if(id==="kurulum"){ showPage("kurulum"); return; }
  showPage("home");
  if(!doScroll) return;
  const f=document.querySelector(".site-frame"),sec=document.getElementById(id);
  if(f&&sec) f.scrollTo({top:Math.max(0,sec.offsetTop-96),behavior:"smooth"});
}
// KLYZE logosu: ana sayfaya (ust) don
const blogo=document.querySelector(".blogo");
blogo?.addEventListener("click",()=>{
  showPage("home");
  items.forEach(b=>{const on=b.dataset.id==="ozellikler";b.classList.toggle("active",on);b.setAttribute("aria-selected",""+on)});
  const t=document.getElementById("mTrigger"); if(t) t.textContent="Home ▾";
});
// kart hero'dan tasinca ozellikler bolumune yer ac (kutu yuksekligine gore)
const featSec=document.getElementById("ozellikler");
function layoutFeat(){
  if(!featSec||!pageHome||pageHome.hidden) return;
  const abs=getComputedStyle(scrollSec).position==="absolute";
  featSec.style.paddingTop=abs?Math.max(scrollCard.offsetHeight-110+56,32)+"px":"32px";
}
window.addEventListener("resize",layoutFeat);
window.addEventListener("load",layoutFeat);
layoutFeat();

/* Ozellikler: kaydirinca kartlar derinlikten gelip izgaraya oturur */
const tunnel=document.getElementById("detayTunnel");
const tunnelStage=document.getElementById("detayStage");
const tunnelCards=tunnel?Array.from(tunnel.querySelectorAll(".detay-card")):[];
const tunnelWide=window.matchMedia("(min-width: 1001px)");
const tunnelReduce=window.matchMedia("(prefers-reduced-motion: reduce)");
const tunnelDepth=[1650,2050,1450,1150,1750,1300];
let tunnelCur=0,tunnelTarget=0,tunnelRaf=0;
const tunnelActive=()=>tunnelWide.matches&&!tunnelReduce.matches;
function tunnelMeasure(){
  if(!tunnel||!tunnelStage||!pageOzel||pageOzel.hidden) return;
  const f=document.querySelector(".site-frame");
  const fh=f?f.clientHeight:window.innerHeight;
  const ft=f?f.getBoundingClientRect().top:0;
  const top=tunnel.getBoundingClientRect().top-ft;
  const travel=Math.max(1,tunnel.offsetHeight-tunnelStage.offsetHeight);
  // sahne %35 gorunur olunca basla, sabitlenmis alan bitince 1'e ulas
  const start=fh*0.35;
  tunnelTarget=Math.min(1,Math.max(0,(start-top)/(start+travel)));
}
function tunnelApply(p){
  if(!tunnelStage) return;
  tunnelStage.style.setProperty("--p",p.toFixed(3));
  tunnelStage.classList.toggle("is-moving",p>0.4);
  tunnelCards.forEach((card,i)=>{
    const cp=Math.min(1,Math.max(0,(p-i*0.06)/0.62));
    const e=cp*cp*(3-2*cp);
    if(e>0.998){
      card.style.transform="none";
      card.style.opacity="1";
      return;
    }
    const inv=1-e;
    const z=-tunnelDepth[i%tunnelDepth.length]*inv;
    const rx=(i<3?-7:7)*inv;
    const ry=(i%3===0?8:i%3===2?-8:0)*inv;
    card.style.transform=`translate3d(0,0,${z.toFixed(0)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    card.style.opacity=e<0.004?"0":Math.min(1,e*1.5).toFixed(3);
  });
}
function tunnelTick(){
  tunnelRaf=0;
  if(!tunnelActive()||!pageOzel||pageOzel.hidden) return;
  tunnelCur+=(tunnelTarget-tunnelCur)*0.16;
  if(Math.abs(tunnelTarget-tunnelCur)<0.0006) tunnelCur=tunnelTarget;
  tunnelApply(tunnelCur);
  if(tunnelCur!==tunnelTarget) tunnelRaf=requestAnimationFrame(tunnelTick);
}
function tunnelKick(){
  if(!tunnelRaf&&tunnelActive()) tunnelRaf=requestAnimationFrame(tunnelTick);
}
function clearTunnel(){
  tunnelCards.forEach(c=>{c.style.transform="";c.style.opacity=""});
  if(tunnelStage){
    tunnelStage.style.removeProperty("--p");
    tunnelStage.classList.remove("is-moving");
    tunnelStage.classList.add("is-static");
  }
}
function resetTunnel(){
  if(!tunnel||!tunnelStage) return;
  if(!tunnelActive()){clearTunnel();return}
  tunnelStage.classList.remove("is-static");
  tunnelMeasure();
  tunnelCur=tunnelTarget;
  tunnelApply(tunnelCur);
}
if(tunnel){
  resetTunnel();
  const f=document.querySelector(".site-frame");
  if(f) f.addEventListener("scroll",()=>{tunnelMeasure();tunnelKick()},{passive:true});
  window.addEventListener("resize",()=>{tunnelMeasure();tunnelKick()});
  tunnelWide.addEventListener("change",resetTunnel);
  tunnelReduce.addEventListener("change",resetTunnel);
  window.addEventListener("load",()=>{tunnelMeasure();tunnelKick()});
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{tunnelMeasure();tunnelKick()});
}
items.forEach(b=>b.addEventListener("click",()=>setActive(b.dataset.id)));
const trg=document.getElementById("mTrigger"),drop=document.getElementById("mDrop");
trg?.addEventListener("click",()=>{
  const open=drop.hasAttribute("hidden");
  if(open){drop.removeAttribute("hidden");trg.setAttribute("aria-expanded","true")}
  else{drop.setAttribute("hidden","");trg.setAttribute("aria-expanded","false")}
});
drop?.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
  setActive(b.dataset.id);
  drop.setAttribute("hidden","");trg.setAttribute("aria-expanded","false");
}));
document.addEventListener("mousedown",e=>{
  const m=document.getElementById("mNotch");
  if(m&&!m.contains(e.target)) drop?.setAttribute("hidden","");
  const lw=document.querySelector(".lang-wrap");
  if(lw&&!lw.contains(e.target)) closeLang();
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){closeLang();drop?.setAttribute("hidden","");trg?.setAttribute("aria-expanded","false")}
});
const langBtn=document.getElementById("langBtn"),langDrop=document.getElementById("langDrop");
function closeLang(){langDrop?.setAttribute("hidden","");langBtn?.setAttribute("aria-expanded","false")}
langBtn?.addEventListener("click",()=>{
  const open=langDrop.hasAttribute("hidden");
  if(open){langDrop.removeAttribute("hidden");langBtn.setAttribute("aria-expanded","true")}
  else closeLang();
});
langDrop?.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
  langDrop.querySelectorAll("button").forEach(x=>x.setAttribute("aria-selected","false"));
  b.setAttribute("aria-selected","true");
  langBtn.textContent=b.dataset.lang;
  closeLang();
}));

/* imlecten disari sacilan tiklama animasyonu */
const fxReduce=window.matchMedia("(prefers-reduced-motion: reduce)");
document.addEventListener("pointerdown",e=>{
  if(fxReduce.matches||e.button!==0) return;
  const fx=document.createElement("div");
  fx.className="click-fx";
  fx.setAttribute("aria-hidden","true");
  fx.style.left=e.clientX+"px";
  fx.style.top=e.clientY+"px";
  for(let i=0;i<8;i++){
    const tick=document.createElement("i");
    tick.style.setProperty("--a",i*45+"deg");
    fx.appendChild(tick);
  }
  document.body.appendChild(fx);
  setTimeout(()=>fx.remove(),500);
},{passive:true});

/* alt indirme cubugu: kaydirma ve sayfa durumuna gore */
if(dockFrame) dockFrame.addEventListener("scroll",dockKick,{passive:true});
window.addEventListener("scroll",dockKick,{passive:true});
window.addEventListener("resize",dockKick);
updateDock();
