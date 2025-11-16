window.socket = io({ autoConnect: true, transports: ["websocket"] });
window.myUid=null; window.myName=null; window.roomId=null;
socket.on("connect",()=>{ window.myUid=socket.id; });
window.showPage=(p)=>{ ["startPage","roomPage","gamePage"].forEach(id=>document.getElementById(id).style.display="none"); document.getElementById(p).style.display="block"; };
document.getElementById("makeRoomBtn").onclick=()=>{
 const n=nicknameInput.value.trim(); if(!n)return alert("닉네임을 입력하세요.");
 window.myName=n; window.roomId=rand();
 socket.emit("joinRoom",{roomId,nickname:n});
 document.getElementById("roomTitle").innerText=`방번호: ${roomId}`;
 showPage("roomPage");
};
document.getElementById("enterRoomBtn").onclick=()=>{
 const link=prompt("초대 링크:"); if(!link)return;
 const url=new URL(link); const id=url.searchParams.get("room");
 const n=prompt("닉네임 입력"); if(!id||!n)return alert("잘못된 링크입니다.");
 window.myName=n; window.roomId=id;
 socket.emit("joinRoom",{roomId:id,nickname:n});
 document.getElementById("roomTitle").innerText=`방번호: ${id}`;
 showPage("roomPage");
};
function rand(){const c="ABCDEFGHIJKLMNOPQRSTUVWXYZ";return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join("");}
