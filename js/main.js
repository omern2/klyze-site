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
const pageHome=document.getElementById("page-home"),pageOzel=document.getElementById("page-ozel"),pageLiderlik=document.getElementById("page-liderlik"),pageYenilikler=document.getElementById("page-yenilikler"),pageDestek=document.getElementById("page-destek"),pageKurulum=document.getElementById("page-kurulum"),pageAc=document.getElementById("page-ac");
const dockEl=document.getElementById("dlDock");
const dockFrame=document.querySelector(".site-frame");
function dockCutoff(){
  const h=dockFrame?dockFrame.clientHeight:window.innerHeight;
  return Math.max(200,Math.min(340,Math.round(h*0.3)));
}
const footEl=document.querySelector(".site-footer");
const faqEl=document.querySelector(".home-faq");
function contentEndInView(){
  const box=(dockFrame||document.documentElement).getBoundingClientRect();
  const limit=box.bottom-8;
  if(footEl&&footEl.getBoundingClientRect().top<limit) return true;
  return !!(pageHome&&!pageHome.hidden&&faqEl&&faqEl.getBoundingClientRect().top<limit);
}
function updateDock(){
  if(!dockEl) return;
  const onHome=!!pageHome&&!pageHome.hidden;
  const onYenilikler=!!pageYenilikler&&!pageYenilikler.hidden;
  const onDestek=!!pageDestek&&!pageDestek.hidden;
  const onKurulum=!!pageKurulum&&!pageKurulum.hidden;
  const onAc=!!pageAc&&!pageAc.hidden;
  let show=!onYenilikler&&!onDestek&&!onKurulum&&!onAc;
  if(onHome){
    const y=dockFrame?dockFrame.scrollTop:window.scrollY;
    show=y>dockCutoff();
  }
  if(show&&contentEndInView()) show=false;
  dockEl.classList.toggle("is-on",show);
  dockEl.toggleAttribute("inert",!show);
}
function dockKick(){
  updateDock();
}
function showPage(which){
  const pages={home:pageHome,ozel:pageOzel,liderlik:pageLiderlik,yenilikler:pageYenilikler,destek:pageDestek,kurulum:pageKurulum,ac:pageAc};
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
  if(which==="ozel") window.KlyzeEco?.measure();
  updateDock();
}
function setActive(id,doScroll=true){
  items.forEach(b=>{
    const on=b.dataset.id===id;
    b.classList.toggle("active",on);
    b.setAttribute("aria-selected",on);
  });
  if(id==="ozellikler"){ showPage("ozel"); return; }
  if(id==="ac"){ showPage("ac"); return; }
  if(id==="liderlik"){ showPage("liderlik"); return; }
  if(id==="yenilikler"){ showPage("yenilikler"); return; }
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
  items.forEach(b=>{b.classList.remove("active");b.setAttribute("aria-selected","false")});
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

/* Ozellikler sayfasi: sabit marka + 3B donen urun adi */
const ecoRot=document.getElementById("ecoRot");
const ecoHero=document.querySelector(".eco-hero");
const ecoReduce=window.matchMedia("(prefers-reduced-motion: reduce)");
if(ecoRot&&ecoHero){
  const ecoWords=[...ecoRot.querySelectorAll(".eco-rot-word")];
  let ecoI=0,ecoTimer=0,ecoSwap=0,ecoWidthTimer=0;
  const ecoMeasure=(instant)=>{
    const word=ecoWords[ecoI];
    if(!word) return;
    if(instant) ecoRot.style.transition="none";
    ecoRot.style.width=Math.ceil(word.getBoundingClientRect().width)+"px";
    if(instant){void ecoRot.offsetWidth;ecoRot.style.transition=""}
  };
  const ecoTick=()=>{
    ecoWords.forEach((w)=>w.classList.remove("is-out"));
    const cur=ecoWords[ecoI];
    ecoI=(ecoI+1)%ecoWords.length;
    const next=ecoWords[ecoI];
    void ecoRot.offsetWidth;
    const curWidth=Math.ceil(cur.getBoundingClientRect().width);
    const nextWidth=Math.ceil(next.getBoundingClientRect().width);
    cur.classList.add("is-out");
    next.classList.add("is-current");
    ecoSwap=setTimeout(()=>{
      cur.classList.remove("is-current","is-out");
    },500);
    clearTimeout(ecoWidthTimer);
    if(nextWidth>=curWidth){
      ecoMeasure(false);
    }else{
      ecoWidthTimer=setTimeout(()=>ecoMeasure(false),300);
    }
  };
  const ecoStart=()=>{
    ecoMeasure(true);
    if(ecoTimer||ecoReduce.matches) return;
    ecoTimer=setInterval(ecoTick,2600);
  };
  const ecoStop=()=>{
    clearInterval(ecoTimer);ecoTimer=0;
    clearTimeout(ecoSwap);clearTimeout(ecoWidthTimer);
    ecoWords.forEach((w,i)=>{
      w.classList.remove("is-out");
      if(i!==ecoI) w.classList.remove("is-current");
    });
    ecoMeasure(true);
  };
  window.KlyzeEco={measure:()=>ecoMeasure(true)};
  if("IntersectionObserver" in window){
    new IntersectionObserver((entries)=>{
      (entries[0]&&entries[0].isIntersecting?ecoStart:ecoStop)();
    },{root:dockFrame,threshold:0}).observe(ecoHero);
  }else{
    ecoStart();
  }
  ecoReduce.addEventListener?.("change",()=>{ecoReduce.matches?ecoStop():ecoStart()});
  window.addEventListener("resize",()=>ecoMeasure(true));
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>ecoMeasure(true));
}
items.forEach(b=>b.addEventListener("click",()=>setActive(b.dataset.id)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>setActive(b.dataset.goto)));
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

/* Ayri sayfadan donus: index.html?sayfa=destek */
const ilkSayfa=new URLSearchParams(location.search).get("sayfa");
const ilkDugme=Array.from(items).find(b=>b.dataset.id===ilkSayfa);
if(ilkDugme) setActive(ilkDugme.dataset.id,false);
