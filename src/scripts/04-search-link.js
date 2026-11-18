
/* v72: mirror the lower search with the v68 search engine; never re-index pages twice. */
(function(){
  const topInput=document.getElementById('v68-find-input');
  const bottomInput=document.getElementById('v72-find-input-bottom');
  const topSearch=document.getElementById('v71-find-submit');
  const bottomSearch=document.getElementById('v72-find-submit-bottom');
  if(!topInput||!bottomInput||!topSearch||!bottomSearch)return;
  topInput.addEventListener('input',()=>{if(bottomInput.value!==topInput.value)bottomInput.value=topInput.value;});
  function syncBottom(){
    if(topInput.value!==bottomInput.value){
      topInput.value=bottomInput.value;
      topInput.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }
  bottomInput.addEventListener('input',syncBottom);
  bottomInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();syncBottom();topSearch.click();
    }else if(event.key==='Escape'){
      bottomInput.value='';syncBottom();
    }
  });
  bottomSearch.addEventListener('click',()=>{syncBottom();topSearch.click();});
})();
