/* rx-portal on-page comments & reading log. Backend (optional) = Google Apps Script -> Google Sheet.
   Set GAS_ENDPOINT to your deployed /exec URL to make comments shared between Richard & Jessica.
   Until then it runs in local mode (per-browser). Updating this file does NOT require re-encrypting pages. */
(function(){
  "use strict";
  var GAS_ENDPOINT = ""; /* <<< PASTE Apps Script web-app /exec URL here to enable shared storage */
  var USERS = [{name:"Richard",color:"#1f6db0"},{name:"Jessica",color:"#b9770e"}];
  var PAGE = (location.pathname||"/").replace(/index\.html$/,"");
  var TITLE = (document.title||location.pathname||"").slice(0,200);
  var K_USER="rxp_user", K_CACHE="rxp_cache_v1";
  var panel,launcher,listEl,countEl;

  function el(t,a,h){var e=document.createElement(t);if(a)for(var k in a)e.setAttribute(k,a[k]);if(h!=null)e.innerHTML=h;return e;}
  function nowISO(){return new Date().toISOString();}
  function nowLocal(){try{return new Date().toLocaleString();}catch(e){return nowISO();}}
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c];});}
  function colorOf(u){for(var i=0;i<USERS.length;i++){if(USERS[i].name===u)return USERS[i].color;}return"#555";}
  function shared(){return !!GAS_ENDPOINT;}
  function getUser(){return localStorage.getItem(K_USER)||"";}
  function setUser(u){localStorage.setItem(K_USER,u);logRead();render();refresh();}

  function cacheAll(){try{return JSON.parse(localStorage.getItem(K_CACHE)||"[]");}catch(e){return[];}}
  function cachePush(o){var a=cacheAll();a.push(o);try{localStorage.setItem(K_CACHE,JSON.stringify(a));}catch(e){}}
  function postEvent(o){
    if(shared()){try{fetch(GAS_ENDPOINT,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(o)});}catch(e){}}
    cachePush(o);
  }
  function mergeRows(server,local){
    var seen={},out=[];
    (server||[]).concat(local||[]).forEach(function(r){
      var k=(r.user||"")+"|"+(r.time||r.timeLocal||"")+"|"+(r.text||"");
      if(!seen[k]){seen[k]=1;out.push(r);}
    });
    out.sort(function(a,b){return String(b.time||"").localeCompare(String(a.time||""));});
    return out;
  }
  function localComments(){return cacheAll().filter(function(r){return r.type==="comment"&&r.page===PAGE;});}
  function listComments(cb){
    var loc=localComments();
    if(shared()){
      var id="__rxpcb"+Math.random().toString(36).slice(2);
      var done=false, sc;
      window[id]=function(rows){done=true;try{cb(mergeRows(rows,loc));}finally{delete window[id];if(sc&&sc.parentNode)sc.parentNode.removeChild(sc);}};
      var u=GAS_ENDPOINT+(GAS_ENDPOINT.indexOf("?")>-1?"&":"?")+"action=list&page="+encodeURIComponent(PAGE)+"&callback="+id;
      sc=el("script",{src:u});
      sc.onerror=function(){if(!done){cb(loc);delete window[id];if(sc.parentNode)sc.parentNode.removeChild(sc);}};
      document.body.appendChild(sc);
      setTimeout(function(){if(!done){window[id]=function(){};cb(loc);}},6000);
    } else { cb(loc); }
  }

  function logRead(){
    var u=getUser();if(!u)return;
    var rk="rxp_read_"+PAGE;
    if(sessionStorage.getItem(rk))return;
    sessionStorage.setItem(rk,"1");
    postEvent({type:"read",user:u,page:PAGE,title:TITLE,time:nowISO(),timeLocal:nowLocal()});
  }

  function build(){
    launcher=el("div",{class:"rxpc-launch",title:"评论 & 阅读记录"},'💬 <span class="rxpc-count">·</span>');
    launcher.onclick=toggle;
    countEl=launcher.querySelector(".rxpc-count");
    panel=el("div",{class:"rxpc-panel"});
    panel.innerHTML=''
      +'<div class="rxpc-hd"><b>页面评论 &amp; 阅读记录</b><span class="rxpc-x">&times;</span></div>'
      +'<div class="rxpc-id"></div>'
      +'<div class="rxpc-list"></div>'
      +'<div class="rxpc-box"><textarea class="rxpc-ta" rows="3"></textarea>'
      +'<button class="rxpc-send">发表评论</button><div class="rxpc-mode"></div></div>';
    document.body.appendChild(launcher);document.body.appendChild(panel);
    panel.querySelector(".rxpc-x").onclick=toggle;
    panel.querySelector(".rxpc-send").onclick=submit;
    listEl=panel.querySelector(".rxpc-list");
    render();refresh();
  }
  function toggle(){panel.classList.toggle("rxpc-open");if(panel.classList.contains("rxpc-open"))refresh();}
  function render(){
    var u=getUser(),idEl=panel.querySelector(".rxpc-id");
    var html='<span class="rxpc-idlabel">身份:</span>';
    USERS.forEach(function(x){html+='<button class="rxpc-u'+(u===x.name?" on":"")+'" data-u="'+esc(x.name)+'" style="--uc:'+x.color+'">'+esc(x.name)+'</button>';});
    idEl.innerHTML=html;
    Array.prototype.forEach.call(idEl.querySelectorAll(".rxpc-u"),function(b){b.onclick=function(){setUser(b.getAttribute("data-u"));};});
    var send=panel.querySelector(".rxpc-send"),ta=panel.querySelector(".rxpc-ta");
    if(u){send.disabled=false;ta.disabled=false;ta.placeholder="以 "+u+" 的身份写下评论…";}
    else{send.disabled=true;ta.disabled=true;ta.placeholder="请先在上方选择身份(Richard / Jessica)";}
    panel.querySelector(".rxpc-mode").textContent=shared()?"✓ 共享存储已连接 — 你和 Jessica 同步可见":"本机模式 — 评论暂存本浏览器(连上 Google 表格后即共享)";
  }
  function refresh(){
    listComments(function(rows){
      countEl.textContent=rows.length?rows.length:"·";
      if(!rows.length){listEl.innerHTML='<div class="rxpc-empty">还没有评论,成为第一个留言的人。</div>';return;}
      listEl.innerHTML=rows.map(function(r){
        return '<div class="rxpc-item"><div class="rxpc-meta"><span class="rxpc-name" style="color:'+colorOf(r.user)+'">'+esc(r.user)+'</span><span class="rxpc-time">'+esc(r.timeLocal||r.time||"")+'</span></div><div class="rxpc-text">'+esc(r.text)+'</div></div>';
      }).join("");
    });
  }
  function submit(){
    var u=getUser();if(!u){alert("请先选择身份(Richard / Jessica)");return;}
    var ta=panel.querySelector(".rxpc-ta"),t=(ta.value||"").trim();if(!t)return;
    postEvent({type:"comment",user:u,page:PAGE,title:TITLE,text:t,time:nowISO(),timeLocal:nowLocal()});
    ta.value="";refresh();
  }

  function init(){build();logRead();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
