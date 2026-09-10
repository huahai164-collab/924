(function(){
  function parseJwt(t){try{const p=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(atob(p).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')))}catch(e){return{}}}
  class Builder{
    constructor(c,t){this.c=c;this.t=t;this.m='GET';this.q=[];this.body=null;this._single=false;this._maybe=false;this._head=false;this._count=null}
    select(cols='*',opts={}){this.q.push(['select',cols]);if(opts.count)this._count=opts.count;if(opts.head)this._head=true;return this}
    eq(k,v){this.q.push([k,'eq.'+encodeURIComponent(v)]);return this}
    ilike(k,v){this.q.push([k,'ilike.'+encodeURIComponent(v)]);return this}
    in(k,arr){this.q.push([k,'in.('+arr.map(v=>'"'+String(v).replace(/"/g,'\\"')+'"').join(',')+')']);return this}
    not(k,op,val){this.q.push([k,'not.'+op+'.'+val]);return this}
    order(k,o={}){this.q.push(['order',k+'.'+(o.ascending===false?'desc':'asc')]);return this}
    limit(n){this.q.push(['limit',String(n)]);return this}
    insert(v){this.m='POST';this.body=v;return this}
    update(v){this.m='PATCH';this.body=v;return this}
    upsert(v){this.m='POST';this.body=v;this.upsertMode=true;return this}
    single(){this._single=true;return this}
    maybeSingle(){this._maybe=true;return this}
    async exec(){
      let u=this.c.url+'/rest/v1/'+this.t;
      const ps=new URLSearchParams();this.q.forEach(([k,v])=>ps.append(k,v));if([...ps].length)u+='?'+ps.toString();
      const h={'apikey':this.c.key,'Authorization':'Bearer '+(this.c.token()||this.c.key),'Content-Type':'application/json'};
      if(this._count)h['Prefer']='count='+this._count;
      if(this.upsertMode)h['Prefer']=(h['Prefer']?h['Prefer']+',':'')+'resolution=merge-duplicates,return=representation';
      else if(this.m!=='GET'&&!this._head)h['Prefer']=(h['Prefer']?h['Prefer']+',':'')+'return=representation';
      const r=await fetch(u,{method:this._head?'HEAD':this.m,headers:h,body:this.body==null?undefined:JSON.stringify(this.body)});
      let d=null;if(!this._head){const txt=await r.text();d=txt?JSON.parse(txt):null}
      const count=r.headers.get('content-range')?.split('/')[1];
      if(!r.ok)return{data:null,error:{message:(d&&d.message)||('HTTP '+r.status)},count:count&&count!=='*'?Number(count):null};
      if(this._single){if(Array.isArray(d))d=d[0]||null}
      if(this._maybe){if(Array.isArray(d))d=d[0]||null}
      return{data:d,error:null,count:count&&count!=='*'?Number(count):null}
    }
    then(a,b){return this.exec().then(a,b)}
  }
  class Client{
    constructor(url,key,opt={}){this.url=url;this.key=key;this.storageKey=opt?.auth?.storageKey||'sb-lite-session'}
    token(){try{return JSON.parse(localStorage.getItem(this.storageKey)||'null')?.access_token||''}catch(e){return''}}
    from(t){return new Builder(this,t)}
    get auth(){const self=this;return{
      async getSession(){try{const s=JSON.parse(localStorage.getItem(self.storageKey)||'null');return{data:{session:s},error:null}}catch(e){return{data:{session:null},error:{message:e.message}}}},
      async setSession(s){const p=parseJwt(s.access_token);const ses={...s,user:{id:p.sub,email:p.email},expires_at:p.exp};localStorage.setItem(self.storageKey,JSON.stringify(ses));return{data:{session:ses},error:null}},
      async signOut(){localStorage.removeItem(self.storageKey);return{error:null}},
      async signInWithPassword({email,password}){const r=await fetch(self.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':self.key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json().catch(()=>({}));if(!r.ok)return{data:null,error:{message:d.error_description||d.msg||d.message||'登录失败'}};const ses={access_token:d.access_token,refresh_token:d.refresh_token,user:d.user,expires_at:d.expires_at};localStorage.setItem(self.storageKey,JSON.stringify(ses));return{data:{session:ses,user:d.user},error:null}},
      onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}}
    }}
    get functions(){const self=this;return{async invoke(name,{body}={}){const r=await fetch(self.url+'/functions/v1/'+name,{method:'POST',headers:{'apikey':self.key,'Authorization':'Bearer '+(self.token()||self.key),'Content-Type':'application/json'},body:JSON.stringify(body||{})});const d=await r.json().catch(()=>({}));if(!r.ok)return{data:d,error:{message:d.error||d.message||('HTTP '+r.status)}};return{data:d,error:null}}}}
    channel(){return{on(){return this},subscribe(){return this}}}
    async removeChannel(){return'OK'}
  }
  window.supabase={createClient:(u,k,o)=>new Client(u,k,o)};
})();