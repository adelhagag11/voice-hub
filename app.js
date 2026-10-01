let me=null,room=null,ws=null,localStream=null,peers={};
const rtcConfig={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};
const $=id=>document.getElementById(id);
async function api(u,o={}){let r=await fetch(u,{headers:{"Content-Type":"application/json"},...o}),d=await r.json();if(!r.ok)throw Error(d.error);return d}
async function login(){me=await api("/api/users",{method:"POST",body:JSON.stringify({name:$("name").value||"ضيف"})});$("login").classList.add("hidden");$("home").classList.remove("hidden");refresh()}
async function refresh(){ $("coins").textContent=me.coins.toLocaleString();let rs=await api("/api/rooms");$("rooms").innerHTML=rs.map(r=>`<div class="roomrow"><span>🎙️ ${r.name} (${r.users.length})</span><button onclick="join('${r.id}')">دخول</button></div>`).join("");let gs=await api("/api/gifts");$("gifts").innerHTML=gs.map(g=>`<div class="gift"><span>${g.emoji}</span><b>${g.name}</b><small>🪙 ${g.price.toLocaleString()}</small><br><button onclick="gift('${g.id}')">إرسال</button></div>`).join("")}
async function join(id){let d=await api("/api/rooms/"+id+"/join",{method:"POST",body:JSON.stringify({userId:me.id})});room=d.room;$("home").classList.add("hidden");$("room").classList.remove("hidden");$("roomName").textContent=room.name;renderMembers(room.users);connectWS()}
function renderMembers(a){$("members").innerHTML=a.map(u=>`<div class="member">👤 ${u.name}<br><button onclick="selectUser('${u.id}')">اختيار</button></div>`).join("")}
let targetId=null;function selectUser(id){targetId=id;alert("تم اختيار المستخدم لإرسال الهدية")}
async function gift(id){if(!targetId)return alert("اختار مستخدمًا أولًا");try{let d=await api("/api/gifts/send",{method:"POST",body:JSON.stringify({fromId:me.id,toId:targetId,giftId:id})});me.coins=d.from.coins;$("coins").textContent=me.coins.toLocaleString()}catch(e){alert(e.message)}}
function connectWS(){ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host);ws.onopen=()=>ws.send(JSON.stringify({type:"hello",userId:me.id}));ws.onmessage=e=>{let m=JSON.parse(e.data);if(m.type==="room-users"){room.users=m.users;renderMembers(m.users);if(localStream)m.users.forEach(u=>{if(u.id!==me.id)startCall(u.id)})}if(m.type==="chat")$("chat").innerHTML+=`<div class="msg"><b>${m.from.name}:</b> ${escapeHtml(m.text)}</div>`;if(m.type==="gift")alert(`🎁 ${m.from.name} أرسل لك ${m.gift.emoji} ${m.gift.name}`);if(m.type==="gift-sent")alert(`تم إرسال ${m.gift.emoji} إلى ${m.to.name}`);if(m.type==="signal")handleSignal(m)}}
function chat(){let t=$("msg").value.trim();if(!t||!ws)return;ws.send(JSON.stringify({type:"chat",userId:me.id,text:t}));$("msg").value=""}
function leave(){if(ws)ws.close();if(localStream)localStream.getTracks().forEach(t=>t.stop());$("room").classList.add("hidden");$("home").classList.remove("hidden")}
async function toggleMic(){
  if(!localStream){
    localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    $("mic").textContent="🔇 كتم الميكروفون";
    // Notify existing room members that this user can start a peer connection.
    (room?.users||[]).forEach(u=>{if(u.id!==me.id)startCall(u.id)});
  }else{
    const track=localStream.getAudioTracks()[0];
    track.enabled=!track.enabled;
    $("mic").textContent=track.enabled?"🔇 كتم الميكروفون":"🎤 تشغيل الميكروفون";
  }
}
async function startCall(targetId){
  if(!localStream || targetId===me.id) return;
  const pc=makePeer(targetId);
  const offer=await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({type:"signal",userId:me.id,targetId,data:{kind:"offer",sdp:pc.localDescription}}));
}
function makePeer(targetId){
  if(peers[targetId]) return peers[targetId];
  const pc=new RTCPeerConnection(rtcConfig);
  peers[targetId]=pc;
  localStream?.getTracks().forEach(t=>pc.addTrack(t,localStream));
  pc.onicecandidate=e=>{
    if(e.candidate)ws.send(JSON.stringify({type:"signal",userId:me.id,targetId,data:{kind:"candidate",candidate:e.candidate}}));
  };
  pc.ontrack=e=>{
    let audio=document.getElementById("audio-"+targetId);
    if(!audio){audio=document.createElement("audio");audio.id="audio-"+targetId;audio.autoplay=true;audio.playsInline=true;document.body.appendChild(audio)}
    audio.srcObject=e.streams[0];
  };
  pc.onconnectionstatechange=()=>{
    if(["failed","closed","disconnected"].includes(pc.connectionState)){pc.close();delete peers[targetId]}
  };
  return pc;
}
async function handleSignal(m){
  const d=m.data, targetId=m.fromId;
  const pc=makePeer(targetId);
  if(d.kind==="offer"){
    if(!localStream) return;
    await pc.setRemoteDescription(d.sdp);
    const answer=await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({type:"signal",userId:me.id,targetId,data:{kind:"answer",sdp:pc.localDescription}}));
  }else if(d.kind==="answer"){
    await pc.setRemoteDescription(d.sdp);
  }else if(d.kind==="candidate" && d.candidate){
    try{await pc.addIceCandidate(d.candidate)}catch(e){}
  }
}
// WebRTC signaling is handled by handleSignal() above.
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
