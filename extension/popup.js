const text = document.getElementById('text');
const statusBox = document.getElementById('status');
let currentPageUrl = '';

function status(message){ statusBox.textContent = message; statusBox.classList.add('show'); }

async function readSelection(){
  try{
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    currentPageUrl = tab?.url || '';
    const [{result}] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>window.getSelection()?.toString()?.trim() || ''});
    if(result){text.value=result;statusBox.classList.remove('show');} else status('ยังไม่ได้คลุมข้อความบนหน้าเว็บ');
  }catch{status('หน้านี้ไม่อนุญาตให้ Extension อ่านข้อความ กรุณาคัดลอกมาวางแทน');}
}

document.getElementById('capture').addEventListener('click',readSelection);
document.getElementById('check').addEventListener('click',()=>{
  const value=text.value.trim(); if(!value&&!currentPageUrl){status('กรุณาคลุมข้อความหรือเปิดหน้าข่าวก่อน');return;}
  chrome.runtime.sendMessage({type:'OPEN_CHECKER',text:value,pageUrl:currentPageUrl},()=>window.close());
});

readSelection();
