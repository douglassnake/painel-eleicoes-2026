/* Menu superior, mantendo os controladores originais de todas as seções. */
(() => {
  'use strict';
  const bar=document.getElementById('topDataNav');
  const rail=document.getElementById('navegacao');
  const select=document.getElementById('dataNavSelect');
  const view=document.getElementById('view');
  if(!bar||!rail||!select||!view)return;
  const tabs=[...rail.querySelectorAll('button.tab[data-view]')];
  const active=()=>rail.querySelector('.tab.active')?.dataset.view||'overview';
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  select.replaceChildren(...tabs.map(tab=>{
    const option=document.createElement('option');
    option.value=tab.dataset.view;
    option.textContent=tab.textContent.trim();
    return option;
  }));
  function sync(){
    const current=active();
    select.value=current;
    for(const tab of tabs){
      if(tab.dataset.view===current)tab.setAttribute('aria-current','page');
      else tab.removeAttribute('aria-current');
    }
  }
  function measure(){
    document.documentElement.style.setProperty('--top-data-nav-height',Math.ceil(bar.getBoundingClientRect().height)+'px');
  }
  function scrollToContent(){
    measure();
    view.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
  }
  const observer=new MutationObserver(changes=>{
    if(changes.some(change=>change.attributeName==='class'))sync();
  });
  observer.observe(rail,{subtree:true,attributes:true,attributeFilter:['class']});
  select.addEventListener('change',()=>{
    const tab=tabs.find(t=>t.dataset.view===select.value);
    if(tab)tab.click();
  });
  // Captura antes dos listeners de outras seções que param a propagação no document.
  window.addEventListener('click',event=>{
    const tab=event.target.closest?.('#navegacao .tab[data-view]');
    if(!tab)return;
    select.value=tab.dataset.view;
    window.setTimeout(()=>{sync();scrollToContent();},100);
  },true);
  window.addEventListener('resize',measure,{passive:true});
  window.addEventListener('pageshow',()=>{sync();measure();});
  sync();measure();
})();