// RollaWord Blog secure publisher. Store GITHUB_TOKEN as a Cloudflare Worker Secret.
let keyCache=null,keyCacheAt=0;
const cors=o=>({"Access-Control-Allow-Origin":o,"Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type","Vary":"Origin"});
const reply=(data,status,origin)=>new Response(JSON.stringify(data),{status,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
function b64url(s){s=s.replace(/-/g,"+").replace(/_/g,"/");s+="=".repeat((4-s.length%4)%4);const b=atob(s);return Uint8Array.from(b,c=>c.charCodeAt(0));}
async function googleKeys(){if(keyCache&&Date.now()-keyCacheAt<3600000)return keyCache;const r=await fetch("https://www.googleapis.com/oauth2/v3/certs");if(!r.ok)throw Error("Unable to verify Google sign-in.");keyCache=await r.json();keyCacheAt=Date.now();return keyCache;}
async function authenticate(token,env){
 const p=token.split(".");if(p.length!==3)throw Error("Invalid Google credential.");
 const h=JSON.parse(new TextDecoder().decode(b64url(p[0]))),c=JSON.parse(new TextDecoder().decode(b64url(p[1])));
 if(h.alg!=="RS256"||!h.kid)throw Error("Unsupported Google credential.");
 let jwks=await googleKeys(),jwk=jwks.keys.find(k=>k.kid===h.kid);
 if(!jwk){keyCache=null;jwks=await googleKeys();jwk=jwks.keys.find(k=>k.kid===h.kid);}
 if(!jwk)throw Error("Google signing key not found.");
 const k=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",k,b64url(p[2]),new TextEncoder().encode(p[0]+"."+p[1]));
 const now=Math.floor(Date.now()/1000),iss=c.iss==="https://accounts.google.com"||c.iss==="accounts.google.com";
 const aud=c.aud===env.GOOGLE_CLIENT_ID||(Array.isArray(c.aud)&&c.aud.includes(env.GOOGLE_CLIENT_ID));
 if(!valid||!iss||!aud||!c.exp||c.exp<now||(c.iat&&c.iat>now+60)||c.email_verified!==true)throw Error("Google account verification failed.");
 const email=String(c.email||"").toLowerCase(),allow=(env.ALLOWED_EMAILS||"").split(",").map(x=>x.trim().toLowerCase());
 if(!email||!allow.includes(email))throw Error("This Google account is not authorized to publish.");
 return {email};
}
function b64utf8(s){const a=new TextEncoder().encode(s);let b="";for(let i=0;i<a.length;i+=8192)b+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(b);}
function fromB64(s){const b=atob(String(s).replace(/\n/g,""));return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0)));}
function validSlug(s){return typeof s==="string"&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<=80;}
function path(env,p){return `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/${p.split("/").map(encodeURIComponent).join("/")}`;}
async function gh(env,p,opts={}){const r=await fetch("https://api.github.com"+p,{...opts,headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+env.GITHUB_TOKEN,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"RollaWord-Blog-Publisher",...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||"GitHub API request failed.");return d;}
async function getFile(env,p){try{return await gh(env,path(env,p)+"?ref="+encodeURIComponent(env.GITHUB_BRANCH));}catch(e){if(/Not Found/i.test(e.message))return null;throw e;}}
async function putFile(env,p,content,message,sha){const body={message,content:b64utf8(content),branch:env.GITHUB_BRANCH};if(sha)body.sha=sha;return gh(env,path(env,p),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}
async function loadArticle(url,env){const slug=url.searchParams.get("slug")||"";if(!validSlug(slug))throw Error("Invalid article slug.");const f=await getFile(env,env.BLOG_PAGES_PATH+"/"+slug+".md");if(!f)throw Error("Article not found.");const md=fromB64(f.content),m=md.match(/^#\s+(.+)$/m);return {slug,title:m?m[1].trim():"",markdown:md};}
async function publish(body,env,user){
 const title=String(body.title||"").trim(),slug=String(body.slug||"");let md=String(body.markdown||"").trim();
 if(!title||title.length>120||!validSlug(slug)||!md||md.length>500000)throw Error("Check the title, slug and article content.");
 md=md.replace(/^#\s+.*(?:\r?\n)+/,"");const article=`# ${title}\n\n${md}\n`,p=env.BLOG_PAGES_PATH+"/"+slug+".md";
 const old=await getFile(env,p),saved=await putFile(env,p,article,(old?"Update":"Publish")+" blog article: "+title,old&&old.sha);
 const rp=env.BLOG_README_PATH,rf=await getFile(env,rp);if(!rf)throw Error("Article saved, but blog/README.md was not found.");
 const readme=fromB64(rf.content),a="<!-- BLOG_POSTS_START -->",z="<!-- BLOG_POSTS_END -->",i=readme.indexOf(a),j=readme.indexOf(z);
 if(i<0||j<i)throw Error("Article saved. Add BLOG_POSTS_START and BLOG_POSTS_END around the article links in README.md, then retry publishing.");
 const lines=readme.slice(i+a.length,j).split(/\\r?\\n/).filter(x=>x.trim()&&!x.includes("?page="+slug));
 const item=`- [${title.replace(/[\[\]]/g,"")}](?page=${slug})`;
 const updated=readme.slice(0,i+a.length)+"\n"+[item,...lines].join("\n")+"\n"+readme.slice(j);
 await putFile(env,rp,updated,"Update blog article index: "+title,rf.sha);
 return {ok:true,slug,commit:saved.commit?.sha||"",publishedBy:user.email};
}
export default {async fetch(req,env){
 const origin=req.headers.get("Origin")||"",allowed=env.ALLOWED_ORIGIN||"https://www.rollaword.com";
 if(origin&&origin!==allowed)return reply({error:"Origin not allowed."},403,allowed);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(allowed)});
 const url=new URL(req.url);
 if(!env.GITHUB_TOKEN||!env.GOOGLE_CLIENT_ID||!env.GITHUB_OWNER||!env.GITHUB_REPO||!env.GITHUB_BRANCH||!env.ALLOWED_EMAILS||!env.BLOG_PAGES_PATH||!env.BLOG_README_PATH)return reply({error:"Worker configuration is incomplete."},500,allowed);
 try{
  const auth=(req.headers.get("Authorization")||"").replace(/^Bearer /,"");if(!auth)throw Error("Please sign in first.");
  const user=await authenticate(auth,env);
  if(req.method==="GET"&&url.pathname==="/api/session")return reply({ok:true,email:user.email},200,allowed);
  if(req.method==="GET"&&url.pathname==="/api/load")return reply(await loadArticle(url,env),200,allowed);
  if(req.method==="POST"&&url.pathname==="/api/publish")return reply(await publish(await req.json(),env,user),200,allowed);
  return reply({error:"Not found."},404,allowed);
 }catch(e){return reply({error:e.message||"Request failed."},400,allowed);}
}};
