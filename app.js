import Lenis from './assets/vendor/lenis.mjs';
import {DURATION,GEOMETRY,stateAt,progress,clamp,smooth,expoOut,sample,LOGO_TRACK_TOP,LOGO_TRACK_MIDDLE} from './motion.js';
// Kove engine (one reversible clock, see motion.js) re-aimed for Anna María Design.
// Desktop: the loader segment (6.8 s → end) plays once on arrival, then scroll drives 0 → 6.65 s:
// identity, opposing columns, BÁRA spread, and the black wipe that hands over to the black About section.
// Mobile: the loader plays as a fixed intro; the stage is a stack and only the columns counter-move.
const $=id=>document.getElementById(id);
const stage=$('stage'), world=$('world'), hero=$('hero'), loader=$('loader'), pin=$('pin');
const columns=[$('column-one'),$('column-two'),$('column-three')];
const tracks=[$('track-top'),$('track-middle'),$('track-bottom')];
const tpl=$('name-copy');
const copies=tracks.map(track=>Array.from({length:8},()=>{
  const mask=document.createElement('span');mask.className='logo-copy-mask';
  const svg=tpl.content.firstElementChild.cloneNode(true);mask.append(svg);track.append(mask);return svg;
}));
const desktopQuery=matchMedia('(min-width:900px) and (min-aspect-ratio:1/1)');
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
let desktop=desktopQuery.matches, reduced=reducedQuery.matches;
// Scroll → clock pacing: the two pushes get most of the scroll, the settled spread a short read, the wipe a clear exit.
const SCROLL_MAP=[[0,0],[.30,1.5],[.38,2.33],[.68,4.0],[.80,5.42],[1,6.65]];
const SCROLL_END=6.65, INTRO_FROM=6.8, MOBILE_INTRO_END=10.3;
// The full loader is a first-arrival moment: once per session, never on reload mid-page or for reduced motion.
let seen=false;try{seen=sessionStorage.getItem('amd-intro')==='1';sessionStorage.setItem('amd-intro','1');}catch(e){}
let mode=(!reduced&&!seen&&scrollY<40)?'intro':'scroll';
let t=mode==='intro'?INTRO_FROM:0, target=0, introSpeed=1, last=0, raf=0, w=0, h=0, vh=innerHeight, loaderFade=1;
// Lenis smooth scroll: desktop with a fine pointer only (phones keep native scroll and the iOS toolbar).
// It runs inside this file's single rAF loop; while it is active the stage follows its position directly.
const finePointer=matchMedia('(hover:hover) and (pointer:fine)');
let lenis=null, lenisLast=0;
function setupLenis(){
  const want=desktop&&finePointer.matches&&!reduced;
  if(want&&!lenis){lenis=new Lenis({lerp:.075,smoothWheel:true,wheelMultiplier:.9,autoRaf:false,anchors:false});lenis.on('scroll',paint);}
  else if(!want&&lenis){lenis.destroy();lenis=null;}
}
const tx=(el,x,y=0)=>{el.style.transform=`translate3d(${x}px,${y}px,0)`;};
const op=(el,n)=>{el.style.opacity=String(n);};

// Masked line rises for the lower sections: wrap each .rise's text once.
const rises=[...document.querySelectorAll('.rise')].map(el=>{const s=document.createElement('span');s.textContent=el.textContent;el.textContent='';el.append(s);return s;});
const aboutImg=document.querySelector('.about-photo img'), aboutFig=aboutImg.parentElement;
const ease3=p=>1-Math.pow(1-p,3);
// Per-character masks: SINCE on the stage, Skólavörðustígur 3 in Visit. Each letter rises out of its own line.
function splitChars(el){const txt=el.textContent;el.textContent='';return [...txt].map(c=>{const s=document.createElement('span');s.className='ch';s.setAttribute('aria-hidden','true');s.textContent=c===' '?'\u00a0':c;el.append(s);return s;});}
const sinceEl=$('since'), sinceChars=splitChars(sinceEl);
const visitEl=document.querySelector('.chars'), visitChars=splitChars(visitEl);
// Curtains (shop cards + About photo): a band lifts off, the photograph settles from a slight zoom.
const curtains=[...document.querySelectorAll('[data-curtain]')].map(el=>({el,cur:el.querySelector('.curtain'),img:el.querySelector('img'),idx:el.closest('.pieces')?[...el.parentElement.children].indexOf(el):-1}));
const landImg=document.querySelector('.landscape-frame img'), portImg=$('portrait-img');
const seen01=(top,band)=>clamp((vh*.96-top)/(vh*band));
// Desktop header: name slot + current-section marker. Elements are cached; writes happen only on change.
const head=$('amd-head'), headName=$('head-name'), headLinks=[...head.querySelectorAll('[data-sec]')];
const sections=headLinks.map(a=>$(a.dataset.sec));
let headCurrent=null;

function measure(){
  const r=(desktop?stage:loader).getBoundingClientRect();w=r.width||innerWidth;h=r.height||innerHeight;vh=innerHeight;
}
function drawLoader(time,s){
  loader.style.display=s.bands?'block':'none';
  if(!s.bands)return;
  const middleScale=s.expansion>0?1+s.expansion*2:s.bandHeight;
  $('band-light').style.transform=`scaleY(${middleScale})`;
  // Names are sibling layers of the light field, so the field grows without stretching type.
  const topX=sample(LOGO_TRACK_TOP,time), middleX=sample(LOGO_TRACK_MIDDLE,time);
  tracks.forEach((track,row)=>{
    tx(track,(row===1?middleX:topX-(row===2?.180392:0))*w);
    copies[row].forEach((svg,i)=>{
      const order=(i+6)%8;
      const enter=expoOut(progress(time,7.04+row*.11+order*.043,7.66+row*.11+order*.043));
      tx(svg,0,(1-enter)*h*.33);
    });
    op(track,1-s.logoResolve);
  });
  $('loader-logo').style.visibility=time>=9.31?'visible':'hidden';
  op($('loader-logo'),s.logoResolve);
  op($('loader-caption'),smooth(progress(time,9.76,10.1)));
}
function drawDesktop(time){
  const s=stateAt(time);
  tx(world,-s.pan*w);
  columns.forEach((c,i)=>tx(c,0,s.columns[i]*h));
  tx($('rail'),-(1-s.rail)*GEOMETRY.rail*w);op($('rail'),s.rail);
  tx($('collection-title'),(1-smooth(progress(time,2.58,3.48)))*.56*w);
  tx($('year'),-(1-smooth(progress(time,2.64,3.56)))*.325*w);
  tx($('portrait-copy'),-(time*.065*w)%(.74*w));
  // The spread's photograph settles as the panel arrives; the tall ring rises into its frame a beat later.
  const k=smooth(progress(s.pan,.62,1.121)), k2=smooth(progress(s.pan,.82,1.121));
  landImg.style.transform=`translate3d(${(1-k)*-5}%,0,0) scale(${1.2-.2*k})`;
  portImg.style.transform=`translate3d(0,${(1-k2)*7}%,0) scale(${1.28-.28*k2})`;
  sinceChars.forEach((c,i)=>{const e=ease3(progress(time,2.7+i*.07,3.45+i*.07));c.style.transform=`translate3d(0,${(1-e)*105}%,0)`;});
  tx($('shop-copy'),-(time*.019*w)%(.23*w));
  tx($('black-wipe'),0,time>=6.8?0:(1-s.wipe)*h*1.01);
  $('black-wipe').style.visibility=s.galleryEntrance?'hidden':'visible';
  drawLoader(time,s);
  if(s.galleryEntrance){
    // Same world returning to identity: the gallery enters from the right, the lockup recentres in its panel.
    tx(world,0);
    tx($('gallery'),(1-s.entrance)*(1-GEOMETRY.hero)*w);
    const centre=(.5-GEOMETRY.hero*.5)*(1-s.logoEntrance)*w;
    $('hero-wordmark').style.transform=`translate(calc(-50% + ${centre}px),-50%)`;
    $('hero-footer').querySelector('p').style.transform=`translateX(calc(-50% + ${centre}px))`;
    tx($('hero-footer').lastElementChild,(1-s.entrance)*(1-GEOMETRY.hero)*w);
  }else{
    tx($('gallery'),0);
    $('hero-wordmark').style.transform='translate(-50%,-50%)';
    $('hero-footer').querySelector('p').style.transform='translateX(-50%)';
    tx($('hero-footer').lastElementChild,0);
  }
  op($('hero-nav'),s.heroUI);op($('hero-footer'),s.heroUI);
  hero.inert=s.pan>.35;
  $('collection').inert=!(s.pan>.9&&time<5.6);
}
function drawHead(secRects,pinEnd){
  const s=stateAt(t), inPin=scrollY<pinEnd+2;
  // Arrives with the hero after the loader; constant from then on.
  op(head,mode==='intro'||mode==='hold'?(t>=10.82?s.heroUI:0):1);
  // One logo per screen: the name rises in once the big lockup has panned away, and steps aside while the rail carries it.
  const show=reduced?(inPin&&t<1?0:1):inPin?smooth(progress(s.pan,.28,.42))*(1-smooth(s.rail)):1;
  headName.style.transform=`translate3d(0,${(1-show)*170}%,0)`;
  head.querySelector('.head-name').tabIndex=show>.5?0:-1;
  // Bar mode once the stage has been wiped to black (or below the pin); tone = the section under the header's bottom edge.
  const bar=!inPin||t>=6.6, hb=head.offsetHeight;
  head.classList.toggle('is-bar',bar);
  let light=false;if(bar)secRects.forEach((r,i)=>{if(r.top<=hb&&r.bottom>hb)light=sections[i].id!=='about';});
  head.classList.toggle('tone-light',light);
  // Current section = the one crossing 45% of the viewport.
  let cur=null;secRects.forEach((r,i)=>{if(r.top<=vh*.45&&r.bottom>vh*.45)cur=headLinks[i];});
  if(cur!==headCurrent){headCurrent?.removeAttribute('aria-current');cur?.setAttribute('aria-current','location');headCurrent=cur;}
}
function drawMobile(time,galleryRect,mob){
  if(mode==='intro'){const s=stateAt(time);drawLoader(time,s);loader.style.display='block';}
  op(loader,smooth(loaderFade));
  if(loaderFade<=0)loader.style.display='none';
  // Counter-moving columns tied to the gallery's position in the viewport (reversible, no duration).
  const p=clamp((vh-galleryRect.top)/(vh+galleryRect.height));
  const amp=galleryRect.height*.28;
  tx(columns[0],0,-amp*(1-p));tx(columns[1],0,-amp*p);tx(columns[2],0,-amp*.75*(1-p));
  const pw=innerWidth;
  tx($('portrait-copy'),-(scrollY*.35)%(pw*1.4));
  tx($('shop-copy'),-(scrollY*.12)%(pw*.9));
  const k=ease3(seen01(mob.land,.6)), k2=ease3(seen01(mob.port,.6)), ks=seen01(mob.since,.3);
  landImg.style.transform=`scale(${1.2-.2*k})`;
  portImg.style.transform=`translate3d(0,${(1-k2)*7}%,0) scale(${1.28-.28*k2})`;
  sinceChars.forEach((c,i)=>{const e=ease3(clamp(ks*1.5-i*.08));c.style.transform=`translate3d(0,${(1-e)*105}%,0)`;});
}
function tick(now){
  raf=0;
  if(document.hidden){last=0;return;}
  const dt=last?Math.min((now-last)/1000,.1):0;last=now;
  if(lenis){
    // The loop sleeps when idle; on wake, give Lenis a one-frame delta so it does not jump the whole glide at once.
    if(!lenisLast||now-lenisLast>60)lenis.time=now-16.7;
    lenis.raf(now);lenisLast=now;
  }
  // ---- reads (all geometry before any write) ----
  const pinTop=pin.offsetTop, pinRange=Math.max(1,pin.offsetHeight-vh);
  const riseTops=rises.map(r=>r.parentElement.getBoundingClientRect().top);
  const aboutRect=aboutFig.getBoundingClientRect();
  const curTops=curtains.map(c=>c.el.getBoundingClientRect().top);
  const visitTop=visitEl.getBoundingClientRect().top;
  const secRects=desktop?sections.map(el=>el.getBoundingClientRect()):null;
  const mob=desktop?null:{land:landImg.parentElement.getBoundingClientRect().top,port:portImg.parentElement.getBoundingClientRect().top,since:sinceEl.getBoundingClientRect().top};
  const galleryRect=$('gallery').getBoundingClientRect();
  // ---- clock ----
  let busy=false;
  if(mode==='intro'){
    t+=dt*introSpeed;busy=true;
    const end=desktop?DURATION:MOBILE_INTRO_END;
    if(t>=end){
      if(desktop){mode='scroll';t=0;}else{mode='scroll';t=end;}
    }
  }
  if(!desktop&&mode==='scroll'&&loaderFade>0){loaderFade=Math.max(0,loaderFade-dt/.45);busy=true;}
  if(desktop&&mode==='scroll'){
    const sp=clamp((scrollY-pinTop)/pinRange);
    // Reduced motion: three still states that swap instantly (identity, gallery, collection); no pan, no wipe.
    target=reduced?(sp<.34?0:sp<.67?1.6:4.6):sample(SCROLL_MAP,sp);
    const gap=target-t;
    // With Lenis the scroll itself is already eased, so the clock follows it 1:1 (no double smoothing).
    // Without it, a critically damped follow (~120 ms) makes wheel steps glide; reduced motion snaps.
    if(reduced||lenis||Math.abs(gap)<.0005)t=target;else{t+=gap*(1-Math.exp(-dt*18));busy=true;}
  }
  // ---- writes ----
  if(desktop)drawDesktop(t);else drawMobile(t,galleryRect,mob);
  rises.forEach((s,i)=>{const p=reduced?1:clamp((vh*.94-riseTops[i])/(vh*.22));s.style.transform=`translate3d(0,${(1-p)*110}%,0)`;});
  if(desktop)drawHead(secRects,pinTop+pin.offsetHeight-vh);
  const cols=desktop?4:2, ap=clamp((vh-aboutRect.top)/(vh+aboutRect.height));
  curtains.forEach((c,i)=>{
    // Cards in a row lift left to right (one column = 12% of the band later); all tied to position, so it reverses.
    const e=reduced?1:ease3(clamp(seen01(curTops[i],c.idx<0?.6:.5)-(c.idx<0?0:(c.idx%cols)*.12)));
    c.cur.style.transform=`scaleY(${1-e})`;
    if(c.el===aboutFig)c.img.style.transform=reduced?'none':`translate3d(0,${(ap-.5)*-6}%,0) scale(${1.16-.16*e})`;
    else c.img.style.transform=e>=1?'':`scale(${1.14-.14*e})`;
  });
  const vt=seen01(visitTop,.45);
  visitChars.forEach((c,i)=>{const e=reduced?1:ease3(clamp(vt*1.6-i*.035));c.style.transform=`translate3d(0,${(1-e)*110}%,0)`;});
  if(lenis&&lenis.isScrolling)busy=true;
  // Lenis emits 'scroll' inside lenis.raf → paint() may already have queued the next frame: never queue two.
  if(busy&&!raf)raf=requestAnimationFrame(tick);
}
function paint(){if(!raf)raf=requestAnimationFrame(tick);}
function hurry(){if(mode==='intro')introSpeed=3.5;}
addEventListener('scroll',()=>{hurry();paint();},{passive:true});
addEventListener('wheel',()=>{hurry();paint();},{passive:true});addEventListener('touchstart',hurry,{passive:true});addEventListener('keydown',hurry);addEventListener('pointerdown',hurry,{passive:true});
addEventListener('resize',()=>{const was=desktop;desktop=desktopQuery.matches;measure();if(was!==desktop){loaderFade=desktop?1:0;loader.style.opacity='';setupLenis();}paint();});
new ResizeObserver(()=>{measure();paint();}).observe(stage);
document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden)paint();});
reducedQuery.addEventListener('change',e=>{reduced=e.matches;setupLenis();if(reduced&&mode==='intro'){mode='scroll';t=0;loaderFade=0;}paint();});

// Mobile menu: fixed-body scroll lock, instant restore (mobile chrome standard).
const burger=document.querySelector('.amd-burger'), menu=$('amd-menu');let lockY=0;
function setMenu(open){
  burger.setAttribute('aria-expanded',String(open));menu.hidden=!open;
  if(open){lockY=scrollY;Object.assign(document.body.style,{position:'fixed',top:`-${lockY}px`,left:'0',right:'0'});}
  else{Object.assign(document.body.style,{position:'',top:'',left:'',right:''});scrollTo({top:lockY,behavior:'instant'});}
}
burger.addEventListener('click',()=>setMenu(burger.getAttribute('aria-expanded')!=='true'));
menu.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;e.preventDefault();setMenu(false);document.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:reduced?'instant':'smooth'});});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden)setMenu(false);});

if(reduced){mode='scroll';t=0;loaderFade=0;}
if(!desktop&&mode!=='intro')loaderFade=0;
// In-page links glide with Lenis. resize() first: the pinned stage changes the document height Lenis cached.
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');if(!a||!lenis)return;
  const el=document.querySelector(a.getAttribute('href'));if(!el)return;
  e.preventDefault();hurry();lenis.resize();
  lenis.scrollTo(el,{duration:1.6,easing:x=>x<.5?8*x*x*x*x:1-Math.pow(-2*x+2,4)/2});paint();
});
setupLenis();measure();paint();
// QA hook: hold the clock at a time (intro frames) or release it back to scroll.
window.amd={lenis:()=>lenis,state:()=>({mode,t,target,desktop,reduced,lenis:!!lenis,...stateAt(t)}),hold:x=>{mode='hold';t=x;loaderFade=1;paint();},release:()=>{mode='scroll';t=0;paint();}};
